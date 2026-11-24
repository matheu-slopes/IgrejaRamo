// Auditoria somente de leitura: não imprime nomes de usuários, arquivos, URLs ou credenciais.
// Execute com: node --env-file=.env.local scripts/auditar-armazenamento.cjs
const { createClient } = require('@supabase/supabase-js');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'CLOUDFLARE_R2_BUCKET'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  process.stderr.write(`Configuração ausente: ${missing.join(', ')}\n`);
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const r2 = new S3Client({ region: 'auto', endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY } });

async function supabaseFiles(bucket) {
  const queue = [''];
  const files = new Map();
  while (queue.length) {
    const folder = queue.shift();
    let offset = 0;
    for (;;) {
      const { data, error } = await db.storage.from(bucket).list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error || !data) throw new Error(`Não foi possível listar o armazenamento ${bucket}.`);
      for (const item of data) {
        const path = folder ? `${folder}/${item.name}` : item.name;
        if (!item.id && !item.metadata) { queue.push(path); continue; }
        const rawSize = item.metadata?.size;
        if (rawSize === null || rawSize === undefined || rawSize === '') throw new Error(`Tamanho indisponível em ${bucket}.`);
        const size = Number(rawSize);
        if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Tamanho indisponível em ${bucket}.`);
        files.set(path, size);
      }
      if (data.length < 100) break;
      offset += data.length;
    }
  }
  return files;
}

async function r2Files() {
  const files = new Map();
  let token;
  do {
    const page = await r2.send(new ListObjectsV2Command({ Bucket: process.env.CLOUDFLARE_R2_BUCKET, ContinuationToken: token }));
    for (const item of page.Contents ?? []) {
      if (!item.Key || !Number.isSafeInteger(item.Size) || item.Size < 0) throw new Error('Informações incompletas no R2.');
      files.set(item.Key, item.Size);
    }
    if (page.IsTruncated && !page.NextContinuationToken) throw new Error('Listagem do R2 incompleta.');
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return files;
}

function total(files) { return { arquivos: files.size, bytes: [...files.values()].reduce((sum, n) => sum + n, 0) }; }
function addPath(set, value) { if (typeof value === 'string' && value && !value.includes('://')) set.add(value); }
function addMap(set, value) { if (value && typeof value === 'object' && !Array.isArray(value)) for (const item of Object.values(value)) addPath(set, item); }

async function allRows(table, columns) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await db.from(table).select(`id,${columns}`).order('id').range(offset, offset + 999);
    if (error || !data) throw new Error('Não foi possível verificar todas as referências do Studio.');
    rows.push(...data);
    if (data.length < 1000) return rows;
    offset += data.length;
  }
}

async function main() {
  const [studio, imagens, midias, r2Objects, projects, versions] = await Promise.all([
    supabaseFiles('louvor-studio'), supabaseFiles('chat-imagens'), supabaseFiles('chat-midias'), r2Files(),
    allRows('louvor_studio_projetos', 'audio_path,stems,lossless_stems'),
    allRows('louvor_studio_versions', 'stems,mix_wav,mix_mp3'),
  ]);
  const refs = new Set();
  for (const p of projects) { addPath(refs, p.audio_path); addMap(refs, p.stems); addMap(refs, p.lossless_stems); }
  for (const v of versions) { addPath(refs, v.mix_wav); addPath(refs, v.mix_mp3); addMap(refs, v.stems); }
  const studioRefs = [...refs];
  const result = {
    supabase: { studio: total(studio), chat_imagens: total(imagens), chat_midias: total(midias) },
    r2_studio: total(r2Objects),
    studio: {
      projetos: projects.length,
      versoes: versions.length,
      referencias_distintas: refs.size,
      referencias_no_supabase: studioRefs.filter((path) => studio.has(path)).length,
      referencias_no_r2: studioRefs.filter((path) => r2Objects.has(path)).length,
      referencias_nao_encontradas: studioRefs.filter((path) => !studio.has(path) && !r2Objects.has(path)).length,
    },
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
main().catch((error) => { process.stderr.write(`${error.message || 'Auditoria indisponível.'}\n`); process.exitCode = 1; }).finally(() => r2.destroy());
