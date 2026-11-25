const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const src=fs.readFileSync('lib/midiaDeMensagem.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const modulo={exports:{}};
let acesso={membro:true};
new Function('exports','module','require',js)(modulo.exports,modulo,(name)=>name==='@/lib/ministerioAcesso'?{acessoMinisterio:async()=>acesso}:require(name));
const {autorizarMidiaDeMensagem:autorizar,prefixoDaConversa:prefixo}=modulo.exports;
const id='12345678-1234-4234-8234-123456789abc';
function database(message,participant) {
  return {from(table){return {select(){const q={eq(){return q},async maybeSingle(){return {data:table==='chat_participantes'?participant:message,error:null}}};return q}}}};
}

test('autoriza arquivo da própria conversa somente para participantes',async()=>{
  const chave=prefixo('conversa','sala')+'arquivo.webp';
  const msg={conversa_id:'sala',criado_em:'2026-01-02T00:00:00Z',media_url:`r2midia:${chave}`};
  assert.deepEqual(await autorizar(database(msg,{historico_desde:'2026-01-01T00:00:00Z'}),'u','conversa',id),{ok:true,chave});
  assert.equal((await autorizar(database(msg,null),'u','conversa',id)).status,403);
});

test('nega mídia anterior ao histórico visível ou vinculada a outra conversa',async()=>{
  const chave=prefixo('conversa','outra')+'arquivo.webp';
  const msg={conversa_id:'sala',criado_em:'2026-01-01T00:00:00Z',media_url:`r2midia:${chave}`};
  assert.equal((await autorizar(database(msg,{historico_desde:'2026-01-02T00:00:00Z'}),'u','conversa',id)).status,403);
  assert.equal((await autorizar(database(msg,{}),'u','conversa',id)).status,403);
});

test('protege mídia de ministério e não emite chaves enviadas diretamente',async()=>{
  const chave=prefixo('ministerio','Louvor')+'arquivo.webm';
  const msg={ministerio:'Louvor',media_url:`r2midia:${chave}`};
  acesso={membro:false};
  assert.equal((await autorizar(database(msg,null),'u','ministerio',id)).status,403);
  acesso={membro:true};
  assert.deepEqual(await autorizar(database(msg,null),'u','ministerio',id),{ok:true,chave});
  assert.equal((await autorizar(database(msg,null),'u','ministerio','../../x')).status,400);
});
