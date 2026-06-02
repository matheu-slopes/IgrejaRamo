import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// POST /api/ministerio/membro — adicionar membro ao ministério
export async function POST(req: NextRequest) {
  const { usuarioId, ministerio, funcao } = await req.json();
  if (!usuarioId || !ministerio || !funcao) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  const admin = adminClient();

  // Busca os ministérios atuais do usuário
  const { data: perfil, error: fetchError } = await admin
    .from("perfis")
    .select("ministerios")
    .eq("id", usuarioId)
    .single();

  if (fetchError || !perfil) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const ministeriosAtuais: string[] = perfil.ministerios ?? [];
  if (ministeriosAtuais.includes(ministerio)) {
    return NextResponse.json({ ok: true, jaEra: true });
  }

  // Atualiza array de ministérios
  const { error: updateError } = await admin
    .from("perfis")
    .update({ ministerios: [...ministeriosAtuais, ministerio] })
    .eq("id", usuarioId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Salva função em membros_ministerio
  const { error: mmError } = await admin
    .from("membros_ministerio")
    .upsert({ usuario_id: usuarioId, ministerio, funcao }, { onConflict: "usuario_id,ministerio" });

  if (mmError) {
    return NextResponse.json({ error: mmError.message }, { status: 500 });
  }

  await admin
    .from("notificacoes")
    .insert({
      usuario_id: usuarioId,
      titulo: `Voce entrou no ministerio ${ministerio}`,
      corpo: "Acesse o canal para acompanhar mensagens, eventos e escalas.",
      tipo: "ministerio",
      link: `/dashboard/ministerio/${encodeURIComponent(ministerio)}`,
      ministerio,
    });

  return NextResponse.json({ ok: true });
}

// DELETE /api/ministerio/membro — remover membro do ministério
export async function DELETE(req: NextRequest) {
  const { usuarioId, ministerio } = await req.json();
  if (!usuarioId || !ministerio) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  const admin = adminClient();

  const { data: perfil } = await admin
    .from("perfis")
    .select("ministerios")
    .eq("id", usuarioId)
    .single();

  const ministeriosAtuais: string[] = perfil?.ministerios ?? [];

  await admin
    .from("perfis")
    .update({ ministerios: ministeriosAtuais.filter((m) => m !== ministerio) })
    .eq("id", usuarioId);

  await admin
    .from("membros_ministerio")
    .delete()
    .eq("usuario_id", usuarioId)
    .eq("ministerio", ministerio);

  return NextResponse.json({ ok: true });
}
