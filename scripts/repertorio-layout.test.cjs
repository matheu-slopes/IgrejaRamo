const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function carregar(arquivo) {
  const mod = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'module', codigo)(mod.exports, mod);
  return mod.exports;
}
const { materiaisDaMusica, musicaDoBanco, transporCifra } = carregar('lib/repertorioMusic.ts');
const { periodoDeCultos, moverPeriodoDeCultos } = carregar('lib/louvorSchedule.ts');

test('letra sem acordes permanece no catálogo e não anuncia cifra ou transposição', () => {
  assert.deepEqual(materiaisDaMusica({ cifra: '[Verso]\nEspírito, enche a minha vida\nEnche-me do teu poder', tom: 'D' }), {
    letra: true, cifra: false, transposicao: false,
  });
  assert.deepEqual(materiaisDaMusica({ cifra: '', tom: 'D' }), { letra: false, cifra: false, transposicao: false });
});
test('acordes salvos habilitam cifra, mas transposição exige tom original', () => {
  const cifra = 'D    A/C#   Bm7\nEspírito, enche a minha vida';
  assert.deepEqual(materiaisDaMusica({ cifra }), { letra: true, cifra: true, transposicao: false });
  assert.deepEqual(materiaisDaMusica({ cifra, tom: 'D' }), { letra: true, cifra: true, transposicao: true });
  assert.equal(materiaisDaMusica({ cifra: 'e|--0--2--|\nB|--1--3--|', tom: 'C' }).cifra, false);
});
test('transpõe acordes e baixo invertido sem modificar letra e tablatura', () => {
  const cifra = 'C   G/B   Am7\nA vida que eu tenho\ne|--0--2--|';
  assert.equal(transporCifra(cifra, 'C', 'D'), 'D   A/C#   Bm7\nA vida que eu tenho\ne|--0--2--|');
  assert.equal(transporCifra('[C]Cantai ao [G/B]Senhor', 'C', 'Bb'), '[Bb]Cantai ao [F/A]Senhor');
  assert.equal(transporCifra('Am  Dm  E7\nMinha canção', 'Am', 'Bm'), 'Bm  Em  F#7\nMinha canção');
  assert.equal(transporCifra(cifra, '', 'D'), cifra);
});
test('mapeia referências permanentes vindas do banco ao carregar e salvar', () => {
  const musica = musicaDoBanco({ id: 'm1', titulo: 'Cantai', artista: 'fhop', cifra: 'Cantai ao Senhor',
    link_youtube: 'https://youtu.be/referencia', cifra_url: 'https://example.com/cifra', cifra_artista_slug: 'fhop' });
  assert.equal(musica.linkYoutube, 'https://youtu.be/referencia');
  assert.equal(musica.cifraUrl, 'https://example.com/cifra');
  assert.equal(musica.cifraArtistaSlug, 'fhop');
});
test('filtra semanas de segunda a domingo, inclusive na troca do ano', () => {
  assert.deepEqual(periodoDeCultos('2026-10-08', 'semana').inicio, '2026-10-05');
  assert.equal(periodoDeCultos('2026-10-11', 'semana').fim, '2026-10-11');
  assert.equal(periodoDeCultos('2027-01-01', 'semana').inicio, '2026-12-28');
  assert.equal(periodoDeCultos('2027-01-01', 'semana').fim, '2027-01-03');
});
test('navega meses sem saltar fevereiro quando a referência é dia 31', () => {
  assert.equal(moverPeriodoDeCultos('2026-01-31', 'mes', 1), '2026-02-01');
  assert.equal(periodoDeCultos('2028-02-15', 'mes').fim, '2028-02-29');
  assert.equal(moverPeriodoDeCultos('2026-12-30', 'semana', 1), '2027-01-06');
});
