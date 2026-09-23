import "server-only";

import { createClient, User as SupabaseUser } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const louvorStudioAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function getLouvorStudioUser(req: NextRequest): Promise<SupabaseUser | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await louvorStudioAdmin.auth.getUser(token);
  return error ? null : data.user;
}

type StudioAccess = { podeVer: boolean; podeGerenciar: boolean };

export async function getLouvorStudioAccess(userId: string): Promise<StudioAccess> {
  const { data: perfil } = await louvorStudioAdmin
    .from("perfis")
    .select("role, ativo, ministerios, lider_ministerios")
    .eq("id", userId)
    .maybeSingle();

  if (!perfil?.ativo) return { podeVer: false, podeGerenciar: false };
  const administrador = ["admin", "pastor"].includes(String(perfil.role));
  const ministerios = (perfil.ministerios as string[] | null) ?? [];
  const liderMinisterios = (perfil.lider_ministerios as string[] | null) ?? [];

  const { data: membro } = await louvorStudioAdmin
    .from("membros_ministerio")
    .select("funcao")
    .eq("usuario_id", userId)
    .eq("ministerio", "Louvor")
    .maybeSingle();

  const funcao = String(membro?.funcao ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const membroLouvor = Boolean(membro) || ministerios.includes("Louvor") || liderMinisterios.includes("Louvor");
  const gestorLouvor = liderMinisterios.includes("Louvor") || ["ministro", "lider", "colider"].includes(funcao);

  return {
    podeVer: administrador || membroLouvor,
    podeGerenciar: administrador || gestorLouvor,
  };
}

export async function podeVerLouvorStudio(userId: string) {
  return (await getLouvorStudioAccess(userId)).podeVer;
}

export async function podeGerenciarLouvorStudio(userId: string) {
  return (await getLouvorStudioAccess(userId)).podeGerenciar;
}

export function workerConfigurado(): boolean {
  return Boolean(process.env.LOUVOR_STUDIO_WORKER_SECRET);
}

export function youtubeConfigurado(): boolean {
  // Name search is available through the public search page without an API key.
  return true;
}

export function validarWorker(req: NextRequest): boolean {
  const esperado = process.env.LOUVOR_STUDIO_WORKER_SECRET ?? "";
  const recebido = req.headers.get("x-worker-secret") ?? "";
  if (!esperado || esperado.length !== recebido.length) return false;
  return timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido));
}

/**
 * Turns abandoned HQ jobs into visible, retryable failures.
 *
 * The worker normally performs this cleanup while claiming its next job. That
 * is not sufficient when the computer running it is switched off: no one is
 * left to claim a job, so the UI would otherwise keep showing a spinner
 * forever. This function is safe to call on every library read because a
 * healthy worker heartbeat wins the timestamp predicate.
 */
export async function recuperarProcessamentosLouvorTravados(): Promise<void> {
  const agora = Date.now();
  const limite = new Date(agora - 5 * 60 * 1000).toISOString();
  // A heartbeat proves that a process exists, not that the audio engine is
  // advancing. Never let it keep one task alive beyond the worker time limit.
  const limiteMaximo = new Date(agora - 2 * 60 * 60 * 1000).toISOString();
  const mensagem = "O processador de áudio parou de responder. Inicie o worker e tente novamente.";
  const atualizadoEm = new Date().toISOString();

  await Promise.all([
    louvorStudioAdmin
      .from("louvor_studio_projetos")
      .update({
        status: "erro",
        erro: mensagem,
        claim_token: null,
        worker_id: null,
        atualizado_em: atualizadoEm,
      })
      .eq("pipeline_version", 2)
      .in("status", ["baixando", "analisando", "separando"])
      .or(`atualizado_em.lt.${limite},processando_em.lt.${limiteMaximo}`),
    louvorStudioAdmin
      .from("louvor_studio_versions")
      .update({
        status: "erro",
        erro: mensagem,
        claim_token: null,
        worker_id: null,
        atualizado_em: atualizadoEm,
      })
      .eq("status", "processando")
      .lt("atualizado_em", limite),
  ]);
}

export async function limparProjetosExpirados(): Promise<number> {
  const { listarAudios, removerAudios } = await import("@/lib/louvorStudioStorage");
  const { data } = await louvorStudioAdmin
    .from("louvor_studio_projetos")
    .select("id")
    .lt("expira_em", new Date().toISOString())
    .limit(20);

  let removidos = 0;
  for (const projeto of data ?? []) {
    const paths = await listarAudios(projeto.id);
    try { await removerAudios(paths); } catch { continue; }
    const { error } = await louvorStudioAdmin.from("louvor_studio_projetos").delete().eq("id", projeto.id);
    if (!error) removidos += 1;
  }
  return removidos;
}
