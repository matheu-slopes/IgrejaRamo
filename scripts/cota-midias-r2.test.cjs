const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function setup({measure=true,reserve=true}={}) {
  const calls=[];
  const source=fs.readFileSync('lib/cotaMidiasR2.ts','utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  new Function('exports','module','require',js)(m.exports,m,(name)=>{
    if(name==='server-only') return {};
    if(name==='@/lib/armazenamentoMidiasR2') return {medirMidiasPrivadas:async()=>{if(!measure)throw Error('falha');return 10}};
    return require(name);
  });
  const admin={rpc:async(name,args)=>{calls.push({name,args});if(name==='midias_r2_inicio_medicao')return {data:'2026-01-01T00:00:00Z',error:null};if(name==='reservar_espaco_midias_r2')return {data:{permitido:reserve},error:null};return {error:null}}};
  return {api:m.exports,admin,calls};
}
test('não autoriza envio sem medir armazenamento ou sem reserva',async()=>{
  const medicao=setup({measure:false});await assert.rejects(()=>medicao.api.reservarMidia(medicao.admin,'id',2),/verificar/);
  assert.equal(medicao.calls.length,1);
  const cheio=setup({reserve:false});await assert.rejects(()=>cheio.api.reservarMidia(cheio.admin,'id',2),/limite/);
});
test('recusa arquivo acima do máximo antes de consultar serviços',async()=>{
  const s=setup();await assert.rejects(()=>s.api.reservarMidia(s.admin,'id',4*1024*1024+1),/4 MB/);assert.equal(s.calls.length,0);
});
