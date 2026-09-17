import "server-only";

import { createClient, User as SupabaseUser } from "@supabase/supabase-js";
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

export async function podeUsarLouvorStudio(userId: string): Promise<boolean> {
  const { data: perfil } = await louvorStudioAdmin
    .from("perfis")
    .select("role, ativo, lider_ministerios")
    .eq("id", userId)
    .maybeSingle();

  if (!perfil?.ativo) return false;
  if (["admin", "pastor"].includes(String(perfil.role))) return true;
  if (((perfil.lider_ministerios as string[] | null) ?? []).includes("Louvor")) return true;

  const { data: membro } = await louvorStudioAdmin
    .from("membros_ministerio")
    .select("funcao")
    .eq("usuario_id", userId)
    .eq("ministerio", "Louvor")
    .in("funcao", ["Ministro", "Líder", "Colíder"])
    .maybeSingle();

  return Boolean(membro);
}

export function workerConfigurado(): boolean {
  return Boolean(process.env.LOUVOR_STUDIO_WORKER_URL && process.env.LOUVOR_STUDIO_WORKER_SECRET);
}

export async function chamarLouvorStudioWorker(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = process.env.LOUVOR_STUDIO_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.LOUVOR_STUDIO_WORKER_SECRET;
  if (!baseUrl || !secret) throw new Error("Louvor Studio ainda não foi configurado no servidor.");

  return fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Secret": secret,
      ...(init?.headers ?? {}),
    },
  });
}

