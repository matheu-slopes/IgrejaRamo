const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Executa os handlers reais com estado controlado e consultas atrasadas.
const source = ts.createSourceFile('EscalasTab.tsx', fs.readFileSync('components/dashboard/EscalasTab.tsx', 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, state) {
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, name);
  const js = ts.transpileModule(found.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('state', `with (state) { ${js}; return ${name}; }`)(state);
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
function harness() {
  const state = {
    form: { musicas: [{ musicaId: 'a', tom: 'C' }, { musicaId: 'b' }] },
    musicas: [], cifraFormRequest: { current: 0 }, cifraInlineRequest: { current: 0 },
    cifraFormCache: {}, cifraFormAberta: null, loadingCifraForm: null,
    cifraAberta: null, cifraInline: null, loadingCifraInline: false,
  };
  for (const name of ['cifraFormCache', 'cifraFormAberta', 'loadingCifraForm', 'cifraAberta', 'cifraInline', 'loadingCifraInline']) {
    state['set' + name[0].toUpperCase() + name.slice(1)] = (value) => {
      state[name] = typeof value === 'function' ? value(state[name]) : value;
    };
  }
  state.setAvisoMusica = () => {};
  state.carregarCifraDoRepertorio = async (id) => ({ cifra: ['Letra ' + id], tom_original: '' });
  return state;
}

test('letras sem slugs externos abrem e seguem o ID ao reordenar/remover', async () => {
  const s = harness();
  const open = handler('toggleCifraForm', s);
  await open(0);
  assert.deepEqual(s.cifraFormCache.a.lines, ['Letra a']);
  s.form.musicas.reverse();
  await open(0);
  assert.equal(s.cifraFormAberta, 'b');
  assert.deepEqual(s.cifraFormCache.b.lines, ['Letra b']);
  s.form.musicas.shift();
  await open(0);
  assert.equal(s.cifraFormAberta, 'a');
  assert.deepEqual(s.cifraFormCache.a.lines, ['Letra a']);
});

test('resposta antiga não troca a letra nem encerra o carregamento da música atual', async () => {
  const s = harness(), a = deferred(), b = deferred();
  s.carregarCifraDoRepertorio = (id) => id === 'a' ? a.promise : b.promise;
  const open = handler('toggleCifraForm', s);
  const first = open(0), second = open(1);
  a.resolve({ cifra: ['Letra a'] });
  await first;
  assert.equal(s.loadingCifraForm, 'b');
  assert.equal(s.cifraFormCache.a, undefined);
  b.resolve({ cifra: ['Letra b'] });
  await second;
  assert.deepEqual(s.cifraFormCache.b.lines, ['Letra b']);
  assert.equal(s.loadingCifraForm, null);
});

test('abrir outra escala limpa cache e invalida consultas anteriores', async () => {
  const s = harness(), pending = deferred();
  s.carregarCifraDoRepertorio = () => pending.promise;
  const result = handler('toggleCifraForm', s)(0);
  handler('resetarCifras', s)();
  pending.resolve({ cifra: ['Letra antiga'] });
  await result;
  assert.deepEqual(s.cifraFormCache, {});
  assert.equal(s.cifraFormAberta, null);
});

test('consulta inline atrasada não substitui a música aberta mais recentemente', async () => {
  const s = harness(), a = deferred(), b = deferred();
  s.carregarCifraDoRepertorio = (id) => id === 'a' ? a.promise : b.promise;
  const open = handler('abrirCifraInline', s);
  const first = open('escala', 0, s.form.musicas[0]);
  const second = open('escala', 1, s.form.musicas[1]);
  b.resolve({ cifra: ['Letra b'] });
  await second;
  a.resolve({ cifra: ['Letra a'] });
  await first;
  assert.equal(s.cifraAberta.musicaId, 'b');
  assert.deepEqual(s.cifraInline, ['Letra b']);
});
