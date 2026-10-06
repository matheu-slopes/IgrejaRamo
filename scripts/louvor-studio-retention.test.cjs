const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

function loadTs(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => Object.hasOwn(mocks, id) ? mocks[id]
    : id === '@/lib/louvorStudioQuota' ? { reservarEspacoStudio: async () => {}, finalizarReservaStudio: async () => {} }
    : originalRequire(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const retention = loadTs('lib/louvorStudioRetention.ts');
test('audio expires after the full service day in Brasilia, including month/year rollover', () => {
  assert.equal(retention.expiracaoAposCulto('2026-10-08'), '2026-10-09T03:00:00.000Z');
  assert.equal(retention.expiracaoAposCulto('2026-10-31'), '2026-11-01T03:00:00.000Z');
  assert.equal(retention.expiracaoAposCulto('2026-12-31'), '2027-01-01T03:00:00.000Z');
  assert.equal(retention.expiracaoAposCulto('2028-02-29'), '2028-03-01T03:00:00.000Z');
  assert.throws(() => retention.expiracaoAposCulto('2026-02-29'));
  assert.throws(() => retention.expiracaoAposCulto('invalid'));
});
test('linking an earlier service does not shorten a preparation needed by a later one', () => {
  assert.equal(retention.expiracaoAoVincularCulto('2026-10-08', '2026-10-12T03:00:00.000Z'), '2026-10-12T03:00:00.000Z');
  assert.equal(retention.expiracaoAoVincularCulto('2026-10-15', '2026-10-12T03:00:00.000Z'), '2026-10-16T03:00:00.000Z');
});

test('opening linked audio does not renew expiry; free/personal rehearsals still renew', async () => {
  const id = 'a007fe56-8080-4924-b79d-b7fd429edddb';
  for (const project of [
    { id, escala_id: 'service', escala_musicas: [] },
    { id, escala_id: null, escala_musicas: [{ id: 'linked' }] },
    { id, escala_id: null, escala_musicas: [], visibilidade: 'pessoal' },
  ]) {
    let update;
    const db = { from: () => ({
      select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: { criado_por: 'leader', ...project } }),
      update(value) { update = value; return this; },
    }) };
    const route = loadTs('app/api/louvor-studio/projects/[id]/route.ts', {
      'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
      '@/lib/louvorStudioServer': {
        getLouvorStudioUser: async () => ({ id: 'leader' }),
        getLouvorStudioAccess: async () => ({ podeVer: true, podeGerenciar: true }), louvorStudioAdmin: db,
      },
      '@/lib/louvorStudioStorage': {},
    });
    const response = await route.PATCH(new Request('http://localhost/project', {
      method: 'PATCH', body: JSON.stringify({ action: 'usar' }),
    }), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 200);
    assert.ok(update.ultimo_uso_em);
    assert.equal(Object.hasOwn(update, 'expira_em'), project.visibilidade === 'pessoal');
  }
});

function cleanupSubject({ uploadRunning = false, storageFailure = false, changedExpiry = false, databaseFailure = false } = {}) {
  const files = ['p/base_vocals.mp3', 'p/base_vocals.flac', 'p/v_example_mix.flac'];
  const removed = []; let deleted = false;
  const oldExpiry = '2000-01-01T03:00:00+00:00';
  const db = {
    rpc: async () => ({ data: uploadRunning || changedExpiry ? null : '2000-01-02T03:00:00+00:00' }),
    from(table) {
    let deleting = false;
    return {
      select() { return this; }, eq() { return this; }, lt() { return this; }, in() { return this; },
      limit: async () => ({ data: [{ id: 'p', expira_em: oldExpiry }], error: databaseFailure ? { message: 'unavailable' } : null }),
      maybeSingle: async () => ({ data: { status: 'concluido', expira_em: changedExpiry ? '2099-01-01T03:00:00+00:00' : oldExpiry } }),
      delete() { deleting = true; deleted = true; return this; },
      then(resolve, reject) {
        return Promise.resolve(table === 'louvor_studio_versions' ? { count: uploadRunning ? 1 : 0 }
          : { data: deleting ? [{ id: 'p' }] : [] }).then(resolve, reject);
      },
    };
  } };
  const server = loadTs('lib/louvorStudioServer.ts', {
    'server-only': {}, '@supabase/supabase-js': { createClient: () => db },
    '@/lib/louvorStudioStorage': {
      listarAudios: async () => files,
      removerAudios: async (paths) => { if (storageFailure) throw new Error('R2 unavailable'); removed.push(...paths); },
    },
  });
  return { call: server.limparProjetosExpirados, removed, deleted: () => deleted };
}
test('expiry removes the whole audio prefix (base and prepared downloads), then only the Studio row', async () => {
  const subject = cleanupSubject();
  assert.equal(await subject.call(), 1);
  assert.deepEqual(subject.removed, ['p/base_vocals.mp3', 'p/base_vocals.flac', 'p/v_example_mix.flac']);
  assert.equal(subject.deleted(), true);
});
test('cleanup defers running uploads, rescheduled audio and storage failures; database failures fail closed', async () => {
  for (const options of [{ uploadRunning: true }, { changedExpiry: true }, { storageFailure: true }]) {
    const subject = cleanupSubject(options);
    assert.equal(await subject.call(), 0);
    assert.equal(subject.deleted(), false);
  }
  await assert.rejects(cleanupSubject({ databaseFailure: true }).call(), /unavailable/);
});

test('daily cleanup runs after cron authentication and before an empty-service early return', () => {
  const source = fs.readFileSync('app/api/push/escalas-reminder/route.ts', 'utf8');
  assert.ok(source.indexOf('secret !== process.env.CRON_SECRET') < source.indexOf('await limparProjetosExpirados()'));
  assert.ok(source.indexOf('await limparProjetosExpirados()') < source.indexOf('if (!escalas?.length)'));
  assert.match(source, /if \(type === "hoje"\)/);
});

function storageSubject({ errors = false } = {}) {
  const calls = [];
  class DeleteObjectsCommand { constructor(input) { this.input = input; } }
  const storage = loadTs('lib/louvorStudioStorage.ts', {
    'server-only': {},
    '@aws-sdk/client-s3': { S3Client: class { async send(command) { calls.push(command.input); return errors ? { Errors: [{ Code: 'AccessDenied' }] } : {}; } }, DeleteObjectsCommand },
    '@aws-sdk/s3-request-presigner': {},
  });
  return { storage, calls };
}
test('R2 deletion batches at most 1000 objects and rejects partial failures', async () => {
  const names = ['CLOUDFLARE_R2_BUCKET', 'CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY'];
  const previous = names.map(name => process.env[name]);
  try {
    names.forEach(name => { process.env[name] = 'test-only'; });
    const subject = storageSubject();
    await subject.storage.removerAudios(Array.from({ length: 1001 }, (_, i) => `project/${i}.mp3`));
    assert.deepEqual(subject.calls.map(call => call.Delete.Objects.length), [1000, 1]);
    await assert.rejects(storageSubject({ errors: true }).storage.removerAudios(['project/base.mp3']), /todos os arquivos/);
  } finally {
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
  }
});
