const LIMIT = 4 * 1024 * 1024;

const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav",
  "application/pdf": "pdf", "text/plain": "txt",
  "application/msword": "doc", "application/vnd.ms-excel": "xls", "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

function begins(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  return expected.every((value, i) => bytes[i + offset] === value);
}

/** Verificação básica de assinatura; documentos devem ser entregues como anexo. */
export function validarArquivoMidia(tipo: string, bytes: Uint8Array): { extensao: string } | null {
  const mime = tipo.split(";")[0].trim().toLowerCase();
  const ext = extensions[mime];
  if (!ext || !bytes.length || bytes.length > LIMIT) return null;
  const ascii = (s: string, offset = 0) => begins(bytes, [...s].map((c) => c.charCodeAt(0)), offset);
  let valido = false;
  if (mime === "image/jpeg") valido = begins(bytes, [0xff, 0xd8, 0xff]);
  else if (mime === "image/png") valido = begins(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  else if (mime === "image/webp") valido = ascii("RIFF") && ascii("WEBP", 8);
  else if (mime === "image/gif") valido = ascii("GIF87a") || ascii("GIF89a");
  else if (mime === "audio/webm") valido = begins(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  else if (mime === "audio/ogg") valido = ascii("OggS");
  else if (mime === "audio/mp4") valido = ascii("ftyp", 4);
  else if (mime === "audio/mpeg") valido = ascii("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  else if (mime === "audio/wav") valido = ascii("RIFF") && ascii("WAVE", 8);
  else if (mime === "application/pdf") valido = ascii("%PDF-");
  else if (mime === "text/plain") {
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); valido = !bytes.includes(0); } catch { valido = false; }
  } else if (mime.includes("openxmlformats-officedocument")) valido = begins(bytes, [0x50, 0x4b, 0x03, 0x04]);
  else valido = begins(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  return valido ? { extensao: ext } : null;
}
