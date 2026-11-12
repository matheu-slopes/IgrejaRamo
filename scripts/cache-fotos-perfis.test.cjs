const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('lib/cacheFotosPerfis.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const modulo = { exports: {} };
new Function('exports', 'module', 'require', js)(modulo.exports, modulo, require);
const { obterFotosEmCache, guardarFotosEmCache, limparCacheDeFotos } = modulo.exports;

test('o cache de fotos é limitado ao usuário e é apagado ao sair', () => {
  limparCacheDeFotos();
  guardarFotosEmCache('pessoa-a', { x: 'imagem' });
  assert.deepEqual(obterFotosEmCache('pessoa-a'), { x: 'imagem' });
  assert.equal(obterFotosEmCache('pessoa-b'), null);
  limparCacheDeFotos();
  assert.equal(obterFotosEmCache('pessoa-a'), null);
});

test('fotos antigas deixam de ser usadas depois de um minuto', () => {
  const original = Date.now;
  try {
    Date.now = () => 1000;
    guardarFotosEmCache('pessoa-a', { x: 'imagem' });
    Date.now = () => 61000;
    assert.equal(obterFotosEmCache('pessoa-a'), null);
  } finally {
    Date.now = original;
    limparCacheDeFotos();
  }
});
