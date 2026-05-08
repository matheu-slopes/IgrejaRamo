import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

const DOC_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
};

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOC_BYTES   = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const formData = await req.formData();
  const file       = formData.get("file")        as File   | null;
  const conversaId = formData.get("conversa_id") as string | null;
  const fileType   = formData.get("file_type")   as string | null; // "audio" | "documento"

  if (!file || !conversaId || !fileType) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const mime = file.type;
  // Normaliza MIME: remove parâmetros extras (ex: "audio/webm;codecs=opus" → "audio/webm")
  const mimeBase = mime.split(";")[0].trim();
  let ext: string | undefined;
  let prefix: string;

  if (fileType === "audio") {
    ext = AUDIO_TYPES[mimeBase];
    if (!ext) return NextResponse.json({ error: `Tipo de áudio não suportado: ${mimeBase}` }, { status: 400 });
    if (file.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Áudio muito grande (máx 10 MB)" }, { status: 413 });
    prefix = "audio";
  } else if (fileType === "documento") {
    ext = DOC_TYPES[mimeBase];
    if (!ext) return NextResponse.json({ error: `Tipo de documento não suportado: ${mimeBase}` }, { status: 400 });
    if (file.size > MAX_DOC_BYTES) return NextResponse.json({ error: "Documento muito grande (máx 20 MB)" }, { status: 413 });
    prefix = "doc";
  } else {
    return NextResponse.json({ error: "file_type inválido" }, { status: 400 });
  }

  // Sanitiza o nome original do arquivo (remove caracteres perigosos)
  const safeName = file.name.replace(/[^a-zA-Z0-9._\-\u00C0-\u024F]/g, "_").slice(0, 100);
  const path = `${user.id}/${conversaId}/${prefix}_${Date.now()}_${safeName}`;

  const { error: uploadError } = await admin.storage
    .from("chat-midias")
    .upload(path, await file.arrayBuffer(), {
      // Usa o MIME base (sem codecs) para garantir compatibilidade cross-browser
      contentType: mimeBase,
      upsert: false,
    });

  if (uploadError) {
    console.error("upload-arquivo error:", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Ambos os buckets são públicos — getPublicUrl é suficiente
  const { data: { publicUrl } } = admin.storage
    .from("chat-midias")
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, filename: safeName });
}
