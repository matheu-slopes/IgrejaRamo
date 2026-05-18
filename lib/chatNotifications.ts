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
    const locked = await lockJob(job.message_id);
    if (!locked) continue;

    try {
      await dispatchChatNotification(job);
      await admin
        .from("chat_notification_jobs")
        .update({ status: "sent", last_error: null, updated_at: new Date().toISOString() })
        .eq("message_id", job.message_id);
      processed += 1;
    } catch (err) {
      failed += 1;
      await admin
        .from("chat_notification_jobs")
        .update({
          status: "failed",
          attempts: (job.attempts ?? 0) + 1,
          last_error: String((err as Error)?.message ?? err).slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("message_id", job.message_id);
    }
  }

  return { processed, failed, picked: jobs?.length ?? 0 };
}

async function lockJob(messageId: string) {
  const { data, error } = await admin
    .from("chat_notification_jobs")
    .update({ status: "processing", locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("message_id", messageId)
    .in("status", ["pending", "failed"])
    .select("message_id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.message_id);
}

async function dispatchChatNotification(job: ChatNotificationJob) {
  const userIds = (await resolveRecipientIds(job.conversa_id, job.autor_id)).filter((uid) => uid !== job.autor_id);
  if (!userIds.length) return;

  const nome = job.autor_nome?.split(" ")[0] ?? "Alguém";
  const tipo = job.tipo ?? "texto";
  const body =
    tipo === "imagem"
      ? `${nome} enviou uma foto`
      : tipo === "audio"
      ? `${nome} enviou um áudio`
      : tipo === "arquivo" || tipo === "documento"
      ? `${nome} enviou um arquivo`
      : `${nome}: ${job.conteudo?.slice(0, 80) ?? ""}`;

  let delivery: PushDispatchResult | null = null;
  try {
    delivery = await sendPushToUsers(userIds, {
      title: "Nova mensagem",
      body,
      url: "/dashboard/chat",
      tag: `chat-${job.conversa_id}-${job.message_id}`,
    });
    if (delivery.sent === 0 && delivery.attempted > 0) {
      console.warn("chat push zero sent:", {
        conversa_id: job.conversa_id,
        destinatarios: userIds.length,
        attempted: delivery.attempted,
        failed: delivery.failed,
        sampleError: delivery.errors[0]?.message ?? null,
      });
    }
  } catch (pushErr) {
    console.error("chat push dispatch error:", pushErr);
  }

  const notificacoes = userIds.map((uid) => ({
    usuario_id: uid,
    titulo: "Nova mensagem",
    corpo: body,
    tipo: "ministerio",
    link: "/dashboard/chat",
    chat_mensagem_id: job.message_id,
  }));

  const { error: notifError } = await admin
    .from("notificacoes")
    .upsert(notificacoes, { onConflict: "usuario_id,chat_mensagem_id" });

  if (notifError) {
    const missingTable = notifError.code === "42P01" || String(notifError.message ?? "").includes("notificacoes");
    if (missingTable) {
      console.warn("chat notificacoes table missing; skipping in-app notification");
      return;
    }

    const missingColumn = notifError.code === "42703" || String(notifError.message ?? "").includes("chat_mensagem_id");
    if (!missingColumn) throw notifError;

    const fallback = userIds.map((uid) => ({
      usuario_id: uid,
      titulo: "Nova mensagem",
      corpo: body,
      tipo: "ministerio",
      link: "/dashboard/chat",
    }));
    const { error: fallbackError } = await admin.from("notificacoes").insert(fallback);
    if (fallbackError) {
      const fallbackMissingTable = fallbackError.code === "42P01" || String(fallbackError.message ?? "").includes("notificacoes");
      if (fallbackMissingTable) {
        console.warn("chat notificacoes table missing; skipping fallback in-app notification");
        return;
      }
      throw fallbackError;
    }
  }
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