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

export async function limparProjetosExpirados(): Promise<number> {
  const { data } = await louvorStudioAdmin
    .from("louvor_studio_projetos")
    .select("id")
    .lt("expira_em", new Date().toISOString())
    .limit(20);

  let removidos = 0;
  for (const projeto of data ?? []) {
    const { data: objetos, error: listError } = await louvorStudioAdmin.storage.from("louvor-studio").list(projeto.id, { limit: 1000 });
    if (listError) continue;
    const paths = (objetos ?? []).map((objeto) => projeto.id + "/" + objeto.name);
    if (paths.length) {
      const {error: storageError}=await louvorStudioAdmin.storage.from("louvor-studio").remove(paths);
      if(storageError || paths.length === 1000) continue;
    }
    const { error } = await louvorStudioAdmin.from("louvor_studio_projetos").delete().eq("id", projeto.id);
    if (!error) removidos += 1;
  }
  return removidos;
}
