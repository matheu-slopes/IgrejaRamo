const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function setup({auth=true,access=true,valid=true,quota=true,save=true,enabled=true}={}) {
  const calls=[];
  class CotaMidiasError extends Error { constructor(message,status) {super(message);this.status=status;} }
  const src=fs.readFileSync('app/api/midias/enviar/route.ts','utf8');
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  const imports=(name)=>{
    if(name==='next/server') return {NextResponse:{json:(body,options)=>({body,status:options?.status??200})}};
    if(name==='@/lib/securityAuth') return {securityAuth:async()=>auth?{admin:{},user:{id:'u'}}:{error:{status:401}}};
    if(name==='@/lib/chatUploadAuth') return {autorizarUploadChat:async()=>access?{ok:true,caminho:'x'}:{ok:false,status:403,erro:'Acesso negado.'}};
    if(name==='@/lib/chatServerAuth') return {chatWriteAccess:async()=>({allowed:access})};
    if(name==='@/lib/midiaDeMensagem') return {prefixoDaConversa:(tipo,destino)=>`chat/${tipo}-${destino}/`};
    if(name==='@/lib/validarArquivoMidia') return {validarArquivoMidia:()=>valid?{extensao:'png'}:null};
    if(name==='@/lib/cotaMidiasR2') return {CotaMidiasError,MAX_ARQUIVO_MIDIA_BYTES:4*1024*1024,reservarMidia:async()=>{calls.push('reserve');if(!quota) throw new CotaMidiasError('Sem espaço',409)},finalizarReservaMidia:async()=>{calls.push('finish')}};
    if(name==='@/lib/armazenamentoMidiasR2') return {salvarMidiaPrivada:async()=>{calls.push('save');if(!save) throw Error('erro')}};
    return require(name);
  };
  new Function('exports','module','require',js)(m.exports,m,imports);
  const execute=async()=>{const f=new FormData();f.set('file',new File(['abc'],'a.png',{type:'image/png'}));f.set('conversa_id','ministerio_Louvor');f.set('mensagem_id','00000000-0000-4000-8000-000000000001');const old=process.env.NEXT_PUBLIC_MIDIAS_R2_ATIVAS;try{process.env.NEXT_PUBLIC_MIDIAS_R2_ATIVAS=enabled?'true':'false';return await m.exports.POST({headers:new Headers(),formData:async()=>f});}finally{if(old===undefined)delete process.env.NEXT_PUBLIC_MIDIAS_R2_ATIVAS;else process.env.NEXT_PUBLIC_MIDIAS_R2_ATIVAS=old}};
  return {execute,calls};
}
test('nega envio quando não há sessão, participação ou arquivo válido',async()=>{
  for(const options of [{auth:false},{access:false},{valid:false}]) {const x=setup(options);const r=await x.execute();assert.ok(r.status>=400);assert.equal(x.calls.length,0);}
});
test('mantém a rota inativa enquanto a migração não está habilitada',async()=>{
  const x=setup({enabled:false});const r=await x.execute();assert.equal(r.status,404);assert.equal(x.calls.length,0);
});
test('não envia quando a reserva de espaço falha',async()=>{
  const x=setup({quota:false});const r=await x.execute();assert.equal(r.status,409);assert.deepEqual(x.calls,['reserve']);
});
test('só salva após reservar e finaliza a reserva',async()=>{
  const x=setup();const r=await x.execute();assert.equal(r.status,200);assert.match(r.body.referencia,/^r2midia:chat\/ministerio-Louvor\//);assert.deepEqual(x.calls,['reserve','save','finish']);
});
test('encerra a reserva mesmo se o R2 falhar',async()=>{
  const x=setup({save:false});const r=await x.execute();assert.equal(r.status,503);assert.deepEqual(x.calls,['reserve','save','finish']);
});
