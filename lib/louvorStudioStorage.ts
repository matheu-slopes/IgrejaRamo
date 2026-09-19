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
import { louvorStudioAdmin as db } from "@/lib/louvorStudioServer";

const bucket = process.env.CLOUDFLARE_R2_BUCKET?.trim();
const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();

const r2Enabled = Boolean(bucket && accountId && accessKeyId && secretAccessKey);

const r2 = r2Enabled
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    })
  : null;

function safePath(path: string) {
  if (!path || path.includes("..") || path.startsWith("/"))
    throw new Error("Caminho de áudio inválido.");
  return path;
}

export function louvorStudioR2Configurado() {
  return r2Enabled;
}

export async function criarUrlDeEnvio(path: string) {
  path = safePath(path);
  if (r2) {
    return getSignedUrl(r2, new PutObjectCommand({ Bucket: bucket!, Key: path }), {
      expiresIn: 60 * 30,
    });
  }
  const { data, error } = await db.storage
    .from("louvor-studio")
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw error ?? new Error("Não foi possível assinar o envio.");
  return data.signedUrl;
}

export async function existeAudio(path: string) {
  path = safePath(path);
  if (r2) {
    try {
      await r2.send(new HeadObjectCommand({ Bucket: bucket!, Key: path }));
      return true;
    } catch {
      return false;
    }
  }
  const slash = path.lastIndexOf("/");
  const { data, error } = await db.storage
    .from("louvor-studio")
    .list(slash < 0 ? "" : path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  return !error && Boolean(data?.some((object) => object.name === path.slice(slash + 1) && Number(object.metadata?.size) > 0));
}

export async function criarUrlDeLeitura(path: string, expiresIn = 6 * 60 * 60) {
  path = safePath(path);
  if (r2 && (await existeAudio(path))) {
    return getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket!, Key: path }), { expiresIn });
  }
  // Existing Supabase objects remain playable after the migration.
  const { data, error } = await db.storage
    .from("louvor-studio")
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error("Não foi possível assinar o download.");
  return data.signedUrl;
}

async function r2Paths(prefix: string) {
  if (!r2) return [];
  const paths: string[] = [];
  let token: string | undefined;
  do {
    const page = await r2.send(
      new ListObjectsV2Command({ Bucket: bucket!, Prefix: prefix, ContinuationToken: token }),
    );
    paths.push(...(page.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : [])));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return paths;
}

export async function listarAudios(prefix: string) {
  prefix = safePath(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix) + "/";
  const paths = new Set<string>();
  if (r2) for (const path of await r2Paths(prefix)) paths.add(path);
  // Include old files while the project migrates; this also makes deletion complete.
  const { data } = await db.storage.from("louvor-studio").list(prefix.slice(0, -1), { limit: 1000 });
  for (const object of data ?? []) if (object.name && !object.name.includes("..")) paths.add(prefix + object.name);
  return [...paths];
}

export async function removerAudios(paths: string[]) {
  const valid = [...new Set(paths.map(safePath))];
  if (!valid.length) return;
  if (r2) {
    await r2.send(
      new DeleteObjectsCommand({ Bucket: bucket!, Delete: { Objects: valid.map((Key) => ({ Key })) } }),
    );
  }
  // No error if the object only existed in R2.
  await db.storage.from("louvor-studio").remove(valid);
}
