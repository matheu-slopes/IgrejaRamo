import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isChatMember } from "@/lib/chatServerAuth";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Limite: 4 MB após compressão client-side (imagens chegam ~100-300 KB)
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Autenticação
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const conversaId = formData.get("conversa_id") as string | null;

  if (!file || !conversaId) {
    return NextResponse.json({ error: "Arquivo e conversa_id obrigatórios" }, { status: 400 });
  }
  if (!(await isChatMember(admin, conversaId, user.id))) {
    return NextResponse.json({ error: "Você não participa desta conversa" }, { status: 403 });
  }

  // Valida tipo MIME
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo não suportado" }, { status: 400 });
  }

  // Valida tamanho (não deve ultrapassar 4 MB — client já comprimiu)
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx 4 MB)" }, { status: 413 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${user.id}/${conversaId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("chat-imagens")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("upload error:", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from("chat-imagens")
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
