import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { prefixoDaConversa } from "@/lib/midiaDeMensagem";
import { validarArquivoMidia } from "@/lib/validarArquivoMidia";
import { reservarMidia, finalizarReservaMidia, CotaMidiasError } from "@/lib/cotaMidiasR2";
import { salvarMidiaPrivada } from "@/lib/armazenamentoMidiasR2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  return user ?? null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const conversaId = formData.get("conversa_id") as string | null;

  if (!file || !conversaId) {
    return NextResponse.json({ error: "Arquivo e conversa_id sao obrigatorios" }, { status: 400 });
  }

  if (!IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de imagem nao suportado" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (max 4 MB)" }, { status: 413 });
  }

  const { data: conversa, error: convErr } = await admin
    .from("chat_conversas")
    .select("id, tipo, admin_id")
    .eq("id", conversaId)
    .single();

  if (convErr || !conversa) {
    return NextResponse.json({ error: convErr?.message ?? "Grupo nao encontrado" }, { status: 404 });
  }

  if ((conversa as { tipo: string }).tipo !== "grupo") {
    return NextResponse.json({ error: "Avatar customizado so esta disponivel para grupos" }, { status: 400 });
  }

  const { data: perfil } = await admin
    .from("perfis")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (perfil as { role?: string } | null)?.role;
  const isOwner = (conversa as { admin_id?: string | null }).admin_id === user.id;
  const canManage = isOwner || role === "admin" || role === "pastor";

  if (!canManage) {
    return NextResponse.json({ error: "Sem permissao para alterar a foto deste grupo" }, { status: 403 });
  }

  if (process.env.NEXT_PUBLIC_MIDIAS_R2_ATIVAS === "true") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversaId)) return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validado = validarArquivoMidia(file.type, bytes);
    if (!validado) return NextResponse.json({ error: "Imagem inválida" }, { status: 400 });
    const id = randomUUID();
    const chave = `${prefixoDaConversa("conversa", conversaId)}avatar/${id}.${validado.extensao}`;
    let reservado = false;
    try {
      await reservarMidia(admin, id, bytes.byteLength); reservado = true;
      await salvarMidiaPrivada(chave, bytes, file.type);
      const url = `r2midia:${chave}`;
      const { error } = await admin.from("chat_conversas").update({ avatar_url: url, emoji: null }).eq("id", conversaId);
      if (error) throw new Error("Não foi possível atualizar a foto do grupo");
      return NextResponse.json({ url });
    } catch (error) {
      return NextResponse.json({ error: error instanceof CotaMidiasError ? error.message : "Não foi possível salvar a foto do grupo" }, { status: error instanceof CotaMidiasError ? error.status : 500 });
    } finally { if (reservado) await finalizarReservaMidia(admin, id); }
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `avatars/${conversaId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("chat-imagens")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from("chat-imagens")
    .getPublicUrl(path);

  const { error: updateErr } = await admin
    .from("chat_conversas")
    .update({ avatar_url: publicUrl, emoji: null })
    .eq("id", conversaId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl });
}
