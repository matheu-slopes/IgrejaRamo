const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('lib/chatUnreadWindow.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const modulo = { exports: {} };
new Function('exports', 'module', 'require', js)(modulo.exports, modulo, require);
const { inicioSeguroDeMensagens: inicio } = modulo.exports;

test('usa o limite mais antigo necessário entre conversas e preserva o instante de leitura', () => {
  const participantes = [{ conversa_id: 'a', historico_desde: '2026-01-01T00:00:00Z' }, { conversa_id: 'b', historico_desde: '2026-02-01T00:00:00Z' }];
  const cursores = [{ conversa_id: 'a', last_read_message_id: 'ma' }, { conversa_id: 'b', last_read_message_id: 'mb' }];
  const lidas = new Map([['ma', { criado_em: '2026-03-01T00:00:00Z' }], ['mb', { criado_em: '2026-02-15T00:00:00Z' }]]);
  assert.equal(inicio(participantes, cursores, lidas), '2026-02-15T00:00:00.000Z');
});

test('não limita a consulta quando uma conversa não possui data segura', () => {
  assert.equal(inicio([{ conversa_id: 'a' }, { conversa_id: 'b', historico_desde: '2026-01-01T00:00:00Z' }], [], new Map()), null);
  assert.equal(inicio([{ conversa_id: 'a', historico_desde: 'inválida' }], [], new Map()), null);
  assert.equal(inicio([], [], new Map()), null);
});

test('respeita a data em que a conversa foi ocultada', () => {
  assert.equal(inicio([{ conversa_id: 'a', historico_desde: '2026-01-01', ocultado_em: '2026-05-01' }], [], new Map()), '2026-05-01T00:00:00.000Z');
});
