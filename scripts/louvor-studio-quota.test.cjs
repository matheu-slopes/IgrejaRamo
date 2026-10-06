const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
function load(relative, mocks) {
  const filename = path.resolve(__dirname, '..', relative), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}
function quota({ missingMigration = false, measurementFailure = false, allowed = true } = {}) {
  const calls = [];
  return { calls, module: load('lib/louvorStudioQuota.ts', {
    'server-only': {}, '@/lib/louvorStudioServer': { louvorStudioAdmin: { rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'louvor_studio_inicio_medicao') return missingMigration ? { error: {} } : { data: '2026-10-06T12:00:00.000Z' };
      return { data: { permitido: allowed, disponivel: 100_000_000 } };
    } } },
    '@/lib/louvorStudioStorage': { medirEspacoR2: async () => { if (measurementFailure) throw Error('R2 unavailable'); return 7_000_000_000; } },
  }) };
}
test('quota measures actual R2 bytes and reserves exact upload sizes with a database snapshot', async () => {
  const subject = quota();
  await subject.module.reservarEspacoStudio('job', 12345);
  assert.deepEqual(subject.calls[1].args, { p_id: 'job', p_bytes: 12345, p_usados: 7_000_000_000, p_inicio: '2026-10-06T12:00:00.000Z' });
});
test('quota fails closed on missing migration, R2 measurement failure, full storage and invalid sizes', async () => {
  for (const options of [{ missingMigration: true }, { measurementFailure: true }]) {
    const subject = quota(options);
    await assert.rejects(subject.module.reservarEspacoStudio('job'), error => error.status === 503);
    assert.equal(subject.calls.some(call => call.name === 'reservar_espaco_louvor_studio'), false);
  }
  const full = quota({ allowed: false });
  await assert.rejects(full.module.reservarEspacoStudio('job'), error => error.status === 409 && /8 GB/.test(error.message));
  const subject = quota();
  for (const size of [0, -1, NaN, Infinity, 1.5, 1_100_000_001]) await assert.rejects(subject.module.reservarEspacoStudio('job', size), error => error.status === 400);
  assert.equal(subject.calls.length, 0);
});
test('bucket measurement follows pagination and includes unrelated/partial files without downloading them', async () => {
  const names = ['CLOUDFLARE_R2_BUCKET', 'CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY'];
  const old = names.map(name => process.env[name]); let calls = [];
  try {
    names.forEach(name => { process.env[name] = 'test-only'; });
    class ListObjectsV2Command { constructor(input) { this.input = input; } }
    const subject = load('lib/louvorStudioStorage.ts', {
      'server-only': {}, '@aws-sdk/s3-request-presigner': {}, '@aws-sdk/client-s3': {
        ListObjectsV2Command, S3Client: class { async send(command) {
          calls.push(command.input);
          return command.input.ContinuationToken ? { Contents: [{ Key: 'partial.flac', Size: 400 }] }
            : { Contents: [{ Key: 'other-folder/image', Size: 100 }], IsTruncated: true, NextContinuationToken: 'next' };
        } },
      },
    });
    assert.equal(await subject.medirEspacoR2(), 500);
    assert.equal(calls.length, 2); assert.equal(calls[1].ContinuationToken, 'next');
    assert.equal(calls[0].Prefix, undefined);
  } finally {
    names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
  }
});
