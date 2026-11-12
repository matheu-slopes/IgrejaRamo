import { SupabaseClient } from "@supabase/supabase-js";

export async function acessoMinisterio(admin: SupabaseClient, usuarioId: string, ministerio: string) {
  const [membro, lider] = await Promise.all([
    admin.rpc("pertence_ministerio", { p_user: usuarioId, p_ministerio: ministerio }),
    admin.rpc("eh_lider_ministerio", { p_user: usuarioId, p_ministerio: ministerio }),
  ]);
  if (membro.error || lider.error) throw new Error("Não foi possível verificar o acesso ao ministério.");
  return { membro: membro.data === true, lider: lider.data === true };
}

export async function temPermissaoMinisterio(admin: SupabaseClient, usuarioId: string, ministerio: string, permissao: string) {
  const { data, error } = await admin.rpc("tem_permissao_ministerio", { p_user: usuarioId, p_ministerio: ministerio, p_permissao: permissao });
  if (error) throw new Error("Não foi possível verificar a permissão.");
  return data === true;
}
