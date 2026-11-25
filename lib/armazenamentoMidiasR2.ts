import "server-only";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Espaço privado separado do Louvor Studio. Só é usado por código no servidor. */
type Config = { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string };

function config(): Config {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
  const bucket = process.env.CLOUDFLARE_R2_MEDIA_BUCKET?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Armazenamento privado de mídias não configurado.");
  if (bucket === process.env.CLOUDFLARE_R2_BUCKET?.trim()) throw new Error("O armazenamento de mídias deve ser separado do Louvor Studio.");
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

function validarChave(key: string): string {
  if (!/^(perfis|chat)\/[a-zA-Z0-9/_-]+\.[a-z0-9]{1,8}$/.test(key) || key.includes("//") || key.includes("..")) {
    throw new Error("Caminho de mídia inválido.");
  }
  return key;
}

function client(c: Config): S3Client {
  return new S3Client({ region: "auto", endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } });
}

/** Mede o bucket inteiro, incluindo objetos sem referência, para não subestimar o uso. */
export async function medirMidiasPrivadas(): Promise<number> {
  const c = config();
  const storage = client(c);
  let total = 0;
  let token: string | undefined;
  try {
    do {
      const page = await storage.send(new ListObjectsV2Command({ Bucket: c.bucket, ContinuationToken: token }));
      for (const item of page.Contents ?? []) {
        if (!Number.isSafeInteger(item.Size) || item.Size! < 0) throw new Error("Não foi possível medir as mídias.");
        total += item.Size!;
        if (!Number.isSafeInteger(total)) throw new Error("Não foi possível medir as mídias.");
      }
      if (page.IsTruncated && !page.NextContinuationToken) throw new Error("A medição das mídias ficou incompleta.");
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return total;
  } finally { storage.destroy(); }
}

/** Somente chame após validar sessão, tipo, tamanho e permissão no servidor. */
export async function salvarMidiaPrivada(key: string, body: Uint8Array, contentType: string): Promise<void> {
  key = validarChave(key);
  if (!body.byteLength || !contentType || contentType.includes("\n") || contentType.includes("\r")) throw new Error("Mídia inválida.");
  const c = config();
  const storage = client(c);
  const isInline = /\.(jpg|png|webp|gif|webm|ogg|m4a|mp3|wav)$/.test(key);
  try {
    await storage.send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, no-store", ...(!isInline ? { ContentDisposition: "attachment" } : {}) }));
    const metadata = await storage.send(new HeadObjectCommand({ Bucket: c.bucket, Key: key }));
    if (metadata.ContentLength !== body.byteLength) throw new Error("Não foi possível confirmar o tamanho da mídia.");
  } finally { storage.destroy(); }
}

/** A URL é temporária e deve ser emitida apenas depois de autorizar o usuário. */
export async function urlTemporariaDeMidia(key: string, seconds = 300): Promise<string> {
  key = validarChave(key);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 300) throw new Error("Validade de mídia inválida.");
  const c = config();
  const storage = client(c);
  const isInline = /\.(jpg|png|webp|gif|webm|ogg|m4a|mp3|wav)$/.test(key);
  try {
    return await getSignedUrl(storage, new GetObjectCommand({
      Bucket: c.bucket, Key: key,
      ...(!isInline ? { ResponseContentDisposition: "attachment", ResponseContentType: "application/octet-stream" } : {}),
    }), { expiresIn: seconds });
  }
  finally { storage.destroy(); }
}

/** Limpeza restrita à chave informada; não use para remoção em lote. */
export async function removerMidiaPrivada(key: string): Promise<void> {
  key = validarChave(key);
  const c = config();
  const storage = client(c);
  try { await storage.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key })); }
  finally { storage.destroy(); }
}
