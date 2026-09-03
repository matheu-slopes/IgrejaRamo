import { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function authenticatedChatUser(req: NextRequest, admin: SupabaseClient): Promise<User | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: { user }, error } = await admin.auth.getUser(token);
  return error ? null : user;
}

export async function chatWriteAccess(
  admin: SupabaseClient,
  conversaId: string,
  userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const [{ data: membership, error: membershipError }, { data: conversa, error: conversaError }] = await Promise.all([
    admin.from("chat_participantes").select("user_id").eq("conversa_id", conversaId).eq("user_id", userId).maybeSingle(),
    admin.from("chat_conversas").select("tipo, admin_id, somente_admin").eq("id", conversaId).maybeSingle(),
  ]);

  if (membershipError || conversaError) return { allowed: false, reason: "Não foi possível validar a conversa" };
  if (!membership || !conversa) return { allowed: false, reason: "Você não participa desta conversa" };
  if (!conversa.somente_admin || conversa.tipo === "direto" || conversa.admin_id === userId) return { allowed: true };

  const { data: perfil } = await admin.from("perfis").select("role").eq("id", userId).maybeSingle();
  const privileged = perfil?.role === "admin" || perfil?.role === "pastor" || perfil?.role === "lider";
  return privileged ? { allowed: true } : { allowed: false, reason: "Somente líderes podem enviar neste grupo" };
}

export async function isChatMember(admin: SupabaseClient, conversaId: string, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("chat_participantes")
    .select("user_id")
    .eq("conversa_id", conversaId)
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}
