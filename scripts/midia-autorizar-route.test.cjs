const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

function route({auth=true, allowed=true, foto=null}={}) {
  let signed=0;
  const source=fs.readFileSync('app/api/midias/autorizar/route.ts','utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  const imports=(name)=>{
    if(name==='next/server') return {NextResponse:{json:(body,options)=>({body,status:options?.status??200,headers:options?.headers})}};
    if(name==='@/lib/securityAuth') return {securityAuth:async()=>auth?{admin:{from(){return {select(){const q={eq(){return q},maybeSingle:async()=>({data:foto===null?null:{foto},error:null})};return q}}}},user:{id:'u'}}:{error:{status:401}}};
    if(name==='@/lib/midiaDeMensagem') return {autorizarMidiaDeMensagem:async()=>allowed?{ok:true,chave:'chat/contexto/a.webp'}:{ok:false,status:403,erro:'Acesso negado.'}};
    if(name==='@/lib/armazenamentoMidiasR2') return {urlTemporariaDeMidia:async()=>{signed++;return 'temporary-url'}};
    return require(name);
  };
  new Function('exports','module','require',js)(m.exports,m,imports);
  return {execute:(body)=>m.exports.POST({json:async()=>body}),signed:()=>signed};
}
test('exige autenticação e permissão antes de gerar URL',async()=>{
  const semSessao=route({auth:false}); assert.equal((await semSessao.execute({})).status,401); assert.equal(semSessao.signed(),0);
  const negado=route({allowed:false}); assert.equal((await negado.execute({tipo:'conversa',mensagemId:'id'})).status,403); assert.equal(negado.signed(),0);
});
test('não guarda URL privada em cache compartilhado',async()=>{
  const autorizado=route(); const result=await autorizado.execute({tipo:'conversa',mensagemId:'id'});
  assert.equal(result.status,200); assert.equal(result.headers['Cache-Control'],'private, no-store'); assert.equal(autorizado.signed(),1);
});
test('somente assina a foto que pertence ao perfil solicitado',async()=>{
  const id='00000000-0000-4000-8000-000000000001';
  const errado=route({foto:'r2midia:perfis/outro/foto.webp'});
  assert.equal((await errado.execute({tipo:'perfil',mensagemId:id})).status,404);assert.equal(errado.signed(),0);
  const certo=route({foto:`r2midia:perfis/${id}/foto.webp`});
  assert.equal((await certo.execute({tipo:'perfil',mensagemId:id})).status,200);assert.equal(certo.signed(),1);
});
