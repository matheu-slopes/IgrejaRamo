const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const vars = ['CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_BUCKET', 'CLOUDFLARE_R2_MEDIA_BUCKET', 'CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID', 'CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY'];
const previous = Object.fromEntries(vars.map((key) => [key, process.env[key]]));
afterEach(() => { for (const key of vars) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });

function setup() {
  Object.assign(process.env, { CLOUDFLARE_R2_ACCOUNT_ID:'test-account', CLOUDFLARE_R2_BUCKET:'studio', CLOUDFLARE_R2_MEDIA_BUCKET:'midias', CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID:'test-key', CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY:'test-secret' });
  const calls = [];
  const command = (name) => class { constructor(input) { this.name = name; this.input = input; } };
  class S3Client { async send(cmd) { calls.push(cmd); if (cmd.name === 'head') return { ContentLength: 3 }; if (cmd.name === 'list') return { Contents: [{ Size: 12 }, { Size: 9 }] }; return {}; } destroy() {} }
  const sdk = { S3Client, PutObjectCommand:command('put'), HeadObjectCommand:command('head'), GetObjectCommand:command('get'), DeleteObjectCommand:command('delete'), ListObjectsV2Command:command('list') };
  const source = fs.readFileSync('lib/armazenamentoMidiasR2.ts','utf8');
  const js = ts.transpileModule(source, { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 } }).outputText;
  const mod={exports:{}};
  new Function('exports','module','require',js)(mod.exports,mod,(name)=> {
    if (name==='server-only') return {};
    if (name==='@aws-sdk/client-s3') return sdk;
    if (name==='@aws-sdk/s3-request-presigner') return { getSignedUrl:async (_client,cmd,options)=> { calls.push({ name:'signed', input:cmd.input, options }); return 'temporary-url'; } };
    return require(name);
  });
  return { api:mod.exports, calls };
}

test('envia para o bucket separado e verifica o tamanho', async () => {
  const {api,calls}=setup();
  await api.salvarMidiaPrivada('perfis/user/foto.webp',new Uint8Array([1,2,3]),'image/webp');
  assert.deepEqual(calls.map(x=>x.name),['put','head']);
  assert.equal(calls[0].input.Bucket,'midias');
  assert.equal(calls[0].input.CacheControl,'private, no-store');
});

test('não permite apontar para o bucket do Studio', async () => {
  const {api,calls}=setup();
  process.env.CLOUDFLARE_R2_MEDIA_BUCKET='studio';
  await assert.rejects(()=>api.salvarMidiaPrivada('perfis/u/foto.webp',new Uint8Array([1]),'image/webp'),/separado/);
  assert.equal(calls.length,0);
});

test('recusa caminhos inseguros, validade excessiva e dados vazios', async () => {
  const {api,calls}=setup();
  await assert.rejects(()=>api.urlTemporariaDeMidia('chat/../../studio.wav'),/inválido/);
  await assert.rejects(()=>api.urlTemporariaDeMidia('chat/u/a.mp3',301),/Validade/);
  await assert.rejects(()=>api.salvarMidiaPrivada('chat/u/a.mp3',new Uint8Array(), 'audio/mpeg'),/inválida/);
  assert.equal(calls.length,0);
});

test('gera leitura temporária com validade máxima de cinco minutos', async () => {
  const {api,calls}=setup();
  assert.equal(await api.urlTemporariaDeMidia('chat/u/audio.webm'),'temporary-url');
  assert.equal(calls[0].input.Bucket,'midias');
  assert.equal(calls[0].options.expiresIn,300);
});

test('mede os arquivos do bucket inteiro para contabilizar também órfãos', async () => {
  const {api,calls}=setup();
  assert.equal(await api.medirMidiasPrivadas(),21);
  assert.equal(calls[0].input.Bucket,'midias');
});
