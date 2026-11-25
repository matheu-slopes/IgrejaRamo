const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync('lib/navegacaoMinisterios.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};
new Function('exports','module','require',js)(m.exports,m,(name)=>name==='@/lib/userMinistries'?{sameMinisterio:(a,b)=>a.trim().toLocaleLowerCase('pt-BR')===b.trim().toLocaleLowerCase('pt-BR')}:require(name));
const {ministeriosNoMenu,caminhoMinisterio}=m.exports;
test('administrador vê todos os canais cadastrados, inclusive Oração e novos ministérios',()=>{
  const canais=['Louvor','Oração','Novo Ministério','Infantil','Mídias','Jovens','Ensino','Ação Social','Limpeza','Recepcionamento'];
  const result=ministeriosNoMenu(canais,[],true);
  assert.equal(result.length,10);assert.ok(result.includes('Oração'));assert.ok(result.includes('Novo Ministério'));
  assert.deepEqual(result,[...canais].sort((a,b)=>a.localeCompare(b,'pt-BR')));
});
test('membro vê apenas seus ministérios cadastrados, inclusive nomes novos',()=>{
  assert.deepEqual(ministeriosNoMenu(['Louvor','Oração','Acolhimento'],['oração','ACOLHIMENTO','Excluído'],false),['Acolhimento','Oração']);
  assert.equal(caminhoMinisterio('Oração'),'/dashboard/ministerio/Ora%C3%A7%C3%A3o');
});
test('em falha de carregamento mantém ministérios associados acessíveis',()=>{
  assert.deepEqual(ministeriosNoMenu(null,['Oração','Novo Ministério'],false),['Novo Ministério','Oração']);
  assert.deepEqual(ministeriosNoMenu(null,[],true),[]);
});
test('igreja sem ministérios não apresenta nomes fictícios',()=>{
  assert.deepEqual(ministeriosNoMenu([],[],true),[]);
  assert.deepEqual(ministeriosNoMenu([],['Louvor'],false),[]);
});
