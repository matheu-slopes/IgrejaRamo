const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const valid='00000000-0000-4000-8000-000000000001';
function setup({permitir=true,salvar=true}={}){
  const calls=[];
  class CotaMidiasError extends Error{constructor(message,status){super(message);this.status=status;}}
  const src=fs.readFileSync('lib/salvarFotoPerfilR2.ts','utf8');
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  new Function('exports','module','require',js)(m.exports,m,(name)=>{
    if(name==='server-only')return {};
    if(name==='@/lib/validarArquivoMidia')return {validarArquivoMidia:()=>permitir?{extensao:'png'}:null};
    if(name==='@/lib/cotaMidiasR2')return {CotaMidiasError,reservarMidia:async()=>calls.push('reserve'),finalizarReservaMidia:async()=>calls.push('finish')};
    if(name==='@/lib/armazenamentoMidiasR2')return {salvarMidiaPrivada:async()=>{calls.push('save');if(!salvar)throw Error('falha')}};
    return require(name);
  });
  return {api:m.exports,calls};
}
test('salva foto com referência própria após reservar espaço',async()=>{
  const x=setup();const ref=await x.api.salvarFotoPerfil({},valid,'data:image/png;base64,YWJj');
  assert.match(ref,new RegExp(`^r2midia:perfis/${valid}/[0-9a-f-]+\\.png$`));assert.deepEqual(x.calls,['reserve','save','finish']);
});
test('recusa perfil inválido, tipos fora da lista e conteúdo inválido',async()=>{
  const x=setup();await assert.rejects(()=>x.api.salvarFotoPerfil({},'../outro','data:image/png;base64,YWJj'),/inválido/);
  await assert.rejects(()=>x.api.salvarFotoPerfil({},valid,'data:image/svg+xml;base64,YWJj'),/suportado/);
  const invalida=setup({permitir:false});await assert.rejects(()=>invalida.api.salvarFotoPerfil({},valid,'data:image/png;base64,YWJj'),/inválida/);assert.deepEqual(invalida.calls,[]);
});
test('encerra reserva se o envio da foto falhar',async()=>{
  const x=setup({salvar:false});await assert.rejects(()=>x.api.salvarFotoPerfil({},valid,'data:image/png;base64,YWJj'),/salvar/);assert.deepEqual(x.calls,['reserve','save','finish']);
});
