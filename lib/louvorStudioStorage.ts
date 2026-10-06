import "server-only";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.CLOUDFLARE_R2_BUCKET?.trim();
const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();

const r2MissingConfig = [
  ["CLOUDFLARE_R2_BUCKET", bucket],
  ["CLOUDFLARE_R2_ACCOUNT_ID", accountId],
  ["CLOUDFLARE_R2_ACCESS_KEY_ID", accessKeyId],
  ["CLOUDFLARE_R2_SECRET_ACCESS_KEY", secretAccessKey],
].flatMap(([name, value]) => value ? [] : [name]);
const r2Enabled = r2MissingConfig.length === 0;

const r2 = r2Enabled
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    })
  : null;

function safePath(path: string) {
  if (!path || path.includes("..") || path.startsWith("/")) {
    throw new Error("Caminho de áudio inválido.");
  }
  return path;
}

function exigirR2() {
  if (!r2) {
    throw new Error(`Cloudflare R2 não está configurado para o Louvor Studio: ${r2MissingConfig.join(", ")}.`);
  }
  return r2;
}

export function louvorStudioR2Configurado() {
  return r2Enabled;
}

export async function criarUrlDeEnvio(path: string, bytes?: number) {
  path = safePath(path);
  return getSignedUrl(exigirR2(), new PutObjectCommand({ Bucket: bucket!, Key: path, ...(bytes ? { ContentLength: bytes } : {}) }), {
    expiresIn: 60 * 30,
  });
}

/** Count all objects in this bucket, including old/partial output. No downloads. */
export async function medirEspacoR2(): Promise<number> {
  const client = exigirR2();
  let bytes = 0;
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket!, ContinuationToken: token }));
    for (const object of page.Contents ?? []) {
      if (!Number.isSafeInteger(object.Size) || object.Size! < 0) throw new Error("Nao foi possivel medir o armazenamento com seguranca.");
      bytes += object.Size!;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !token) throw new Error("Medicao incompleta do armazenamento.");
  } while (token);
  return bytes;
}

export async function existeAudio(path: string) {
  path = safePath(path);
  const client = exigirR2();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket!, Key: path }));
    return true;
  } catch {
    return false;
  }
}

export async function criarUrlDeLeitura(path: string, expiresIn = 6 * 60 * 60) {
  path = safePath(path);
  if (!(await existeAudio(path))) {
    throw new Error("A faixa não está disponível no Cloudflare R2.");
  }
  return getSignedUrl(exigirR2(), new GetObjectCommand({ Bucket: bucket!, Key: path }), { expiresIn });
}

async function r2Paths(prefix: string) {
  const client = exigirR2();
  const paths: string[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket!, Prefix: prefix, ContinuationToken: token }),
    );
    paths.push(...(page.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : [])));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return paths;
}

export async function listarAudios(prefix: string) {
  prefix = safePath(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix) + "/";
  return r2Paths(prefix);
}

export async function removerAudios(paths: string[]) {
  const valid = [...new Set(paths.map(safePath))];
  if (!valid.length) return;
  const client = exigirR2();
  for (let offset = 0; offset < valid.length; offset += 1000) {
    const result = await client.send(new DeleteObjectsCommand({
      Bucket: bucket!, Delete: { Objects: valid.slice(offset, offset + 1000).map((Key) => ({ Key })) },
    }));
    if (result.Errors?.length) throw new Error("Nao foi possivel remover todos os arquivos de audio. A limpeza sera tentada novamente.");
  }
}
