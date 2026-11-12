const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const source = fs.readFileSync("lib/funcoesLista.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const modulo = { exports: {} };
new Function("exports", "module", js)(modulo.exports, modulo);
const { correspondePesquisa, compararNomes } = modulo.exports;

test("encontra trechos, acentos e erros comuns de digitação", () => {
  assert.equal(correspondePesquisa("Violão", "violao"), true);
  assert.equal(correspondePesquisa("Guitarra", "guitara"), true);
  assert.equal(correspondePesquisa("Teclado", "tecaldo"), true);
  assert.equal(correspondePesquisa("Backing Vocal", "backng vocal"), true);
  assert.equal(correspondePesquisa("Guitarra", "gutara"), true);
});

test("buscas curtas não viram aproximações aleatórias", () => {
  assert.equal(correspondePesquisa("Violão", "vi"), true);
  assert.equal(correspondePesquisa("Baixo", "vi"), false);
  assert.equal(correspondePesquisa("Guitarra", "teclado"), false);
  assert.equal(correspondePesquisa("Backing Vocal", "backng guitarra"), false);
});

test("a lista permanece em ordem alfabética portuguesa", () => {
  assert.deepEqual(["Violão", "Ministro", "Backing Vocal", "Áudio"].sort(compararNomes), ["Áudio", "Backing Vocal", "Ministro", "Violão"]);
});
