import { createClient } from "@supabase/supabase-js";
import { sendPushToUsers, type PushDispatchResult } from "@/lib/sendPush";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ChatNotificationJob = {
  message_id: string;
  conversa_id: string;
  autor_id: string;
  autor_nome: string;
  conteudo: string | null;
  tipo: string | null;
  attempts: number;
};

export async function enqueueChatNotificationJob(job: Omit<ChatNotificationJob, "attempts">) {
  // ignoreDuplicates: não sobrescreve jobs já em processing/sent (evita push duplo
  // e evita resetar um job que está sendo processado ao mesmo tempo).
  const { error } = await admin
    .from("chat_notification_jobs")
    .upsert({
      ...job,
      conteudo: job.conteudo ?? "",
      tipo: job.tipo ?? "texto",
      status: "pending",
      updated_at: new Date().toISOString(),
    }, { onConflict: "message_id", ignoreDuplicates: true });

  if (error) throw error;
}

export async function processChatNotificationJobs(limit = 25) {
  // Recupera pending/failed E jobs presos em processing há mais de 5 minutos
  // (ocorre quando a função serverless sofre timeout entre o lock e a conclusão).
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: jobs, error } = await admin
    .from("chat_notification_jobs")
    .select("message_id, conversa_id, autor_id, autor_nome, conteudo, tipo, attempts")
    .or(`status.in.(pending,failed),and(status.eq.processing,locked_at.lt.${staleThreshold})`)
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  let processed = 0;
  let failed = 0;

  for (const job of (jobs ?? []) as ChatNotificationJob[]) {
    const result = await processLockedJob(job);
    if (result === "processed") processed += 1;
    if (result === "failed") failed += 1;
  }

  return { processed, failed, picked: jobs?.length ?? 0 };
}

export async function processChatNotificationJob(messageId: string) {
  const { data: job, error } = await admin
    .from("chat_notification_jobs")
    .select("message_id, conversa_id, autor_id, autor_nome, conteudo, tipo, attempts")
    .eq("message_id", messageId)
    .maybeSingle();

  if (error) throw error;
  if (!job) return { processed: 0, failed: 0, picked: 0 };

  const result = await processLockedJob(job as ChatNotificationJob);
  return {
    processed: result === "processed" ? 1 : 0,
    failed: result === "failed" ? 1 : 0,
    picked: 1,
  };
}

export async function dispatchChatNotificationNow(job: Omit<ChatNotificationJob, "attempts">) {
  await dispatchChatNotification({ ...job, attempts: 0 });
}

async function processLockedJob(job: ChatNotificationJob): Promise<"processed" | "failed" | "skipped"> {
  const locked = await lockJob(job.message_id);
  if (!locked) return "skipped";

  try {
    await dispatchChatNotification(job);
    await admin
      .from("chat_notification_jobs")
      .update({ status: "sent", last_error: null, updated_at: new Date().toISOString() })
      .eq("message_id", job.message_id);
    return "processed";
  } catch (err) {
    await admin
      .from("chat_notification_jobs")
      .update({
        status: "failed",
        attempts: (job.attempts ?? 0) + 1,
        last_error: String((err as Error)?.message ?? err).slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("message_id", job.message_id);
    return "failed";
  }
}

async function lockJob(messageId: string) {
  // Para jobs presos em "processing" (serverless timeout), usamos o mesmo
  // staleThreshold do select para evitar race com outra instância ativa.
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("chat_notification_jobs")
    .update({ status: "processing", locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("message_id", messageId)
    .or(`status.in.(pending,failed),and(status.eq.processing,locked_at.lt.${staleThreshold})`)
    .select("message_id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.message_id);
}

async function dispatchChatNotification(job: ChatNotificationJob) {
  const userIds = (await resolveRecipientIds(job.conversa_id, job.autor_id)).filter((uid) => uid !== job.autor_id);
  if (!userIds.length) {
    throw new Error("chat sem destinatarios para notificar");
  }

  const conversa = await resolveConversationInfo(job.conversa_id);
  const nome = job.autor_nome?.split(" ")[0] ?? "Alguém";
  const tipo = job.tipo ?? "texto";
  const preview =
    tipo === "imagem"
      ? "enviou uma foto"
      : tipo === "audio"
      ? "enviou um áudio"
      : tipo === "arquivo" || tipo === "documento"
      ? "enviou um arquivo"
      : job.conteudo?.slice(0, 120) ?? "";
  const isGrupo = conversa?.tipo && conversa.tipo !== "direto";
  const title = isGrupo ? conversa?.nome || "Grupo" : nome;
  const body = isGrupo ? `${nome}: ${preview}` : preview;

  let delivery: PushDispatchResult | null = null;
  try {
    delivery = await sendPushToUsers(userIds, {
      title,
      body,
      url: "/dashboard/chat",
      tag: `chat-${job.conversa_id}-${job.message_id}`,
    });
    if (delivery.attempted === 0) {
      throw new Error(`destinatarios sem subscription push (${userIds.length})`);
    }
    if (delivery.sent === 0 && delivery.attempted > 0) {
      console.warn("chat push zero sent:", {
        conversa_id: job.conversa_id,
        destinatarios: userIds.length,
        attempted: delivery.attempted,
        failed: delivery.failed,
        sampleError: delivery.errors[0]?.message ?? null,
      });
      throw new Error(delivery.errors[0]?.message ?? "push nao entregue para nenhuma subscription");
    }
  } catch (pushErr) {
    console.error("chat push dispatch error:", pushErr);
    throw pushErr;
  }

  // Chat usa push + contador proprio de Conversas. Nao alimenta o sininho geral.
}

async function resolveConversationInfo(conversaId: string): Promise<{ tipo: string | null; nome: string | null } | null> {
  const { data, error } = await admin
    .from("chat_conversas")
    .select("tipo, nome")
    .eq("id", conversaId)
    .maybeSingle();

  if (error) {
    console.error("chat_conversas notification info error:", error);
    return null;
  }

  return data as { tipo: string | null; nome: string | null } | null;
}

async function resolveRecipientIds(conversaId: string, autorId: string): Promise<string[]> {
  const { data: participantes, error: partErr } = await admin
    .from("chat_participantes")
    .select("user_id")
    .eq("conversa_id", conversaId)
    .neq("user_id", autorId);

  if (partErr) console.error("chat_participantes select error:", partErr);

  const directIds = [...new Set((participantes ?? []).map((p: { user_id: string }) => p.user_id).filter((id) => Boolean(id) && id !== autorId))];
  if (directIds.length) return directIds;

  const { data: historico, error: histErr } = await admin
    .from("chat_mensagens")
    .select("autor_id")
    .eq("conversa_id", conversaId)
    .neq("autor_id", autorId)
    .order("criado_em", { ascending: false })
    .limit(20);

  if (histErr) {
    console.error("chat_mensagens fallback error:", histErr);
    return [];
  }

  return [...new Set((historico ?? []).map((m: { autor_id: string }) => m.autor_id).filter((id) => Boolean(id) && id !== autorId))];
}
