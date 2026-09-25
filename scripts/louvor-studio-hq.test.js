const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Run the actual TypeScript modules without adding a test runner dependency.
function loadTs(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : originalRequire(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const music=loadTs('lib/louvorStudioMusic.ts');
test('all 12 keys preserve major/minor and obey all directions',()=>{
  let combinations=0;
  for(const minor of ['', 'm'])for(const from of music.NOTES)for(const to of music.NOTES)for(const direction of ['auto','up','down']){
    const n=music.transposeSemitones(from.value+minor,to.value+minor,direction);
    assert.equal(music.keyAt(from.value+minor,n),to.value+minor);
    if(direction==='auto')assert.ok(n>=-5&&n<=6);
    if(direction==='up')assert.ok(n>=0&&n<=11);
    if(direction==='down')assert.ok(n>=-11&&n<=0);
    combinations++;
  }
  assert.equal(combinations,864);
  assert.equal(music.transposeSemitones('Bb','C','up'),2);
  assert.equal(music.transposeSemitones('C','Bb','down'),-2);
  assert.throws(()=>music.transposeSemitones('C','Cm'));
  assert.throws(()=>music.transposeSemitones('C','D','invalid'));
});
test('Studio lists only a member’s published assigned services and keeps song order', async () => {
  const services = [
    { id: 'assigned', culto: 'Domingo', data: '2099-01-01', horario: '18:30', visivel: true,
      escala_itens: [{ voluntario_id: 'member' }],
      escala_musicas: [
        { musica_id: 'second', titulo: 'Segunda', artista: 'A', ordem: 2, tom: 'D', bpm: 120, studio_projeto_id: null },
        { musica_id: 'first', titulo: 'Primeira', artista: 'B', ordem: 1, tom: 'E', bpm: 130, studio_projeto_id: 'base' },
      ] },
    { id: 'other', culto: 'Quinta', data: '2099-01-02', horario: '20:00', visivel: true,
      escala_itens: [{ voluntario_id: 'other' }], escala_musicas: [] },
    { id: 'draft', culto: 'Rascunho', data: '2099-01-03', horario: '20:00', visivel: false,
      escala_itens: [{ voluntario_id: 'member' }], escala_musicas: [] },
  ];
  for (const manager of [false, true]) {
    const db = { from(table) {
      const filters = {};
      return {
        select() { return this; }, or() { return this; }, order() { return this; },
        limit() { return this; }, in() { return this; }, gte() { return this; },
        eq(key, value) { filters[key] = value; return this; },
        then(resolve, reject) {
          const data = table === 'louvor_studio_projetos'
            ? [{ id: 'base', titulo: 'Primeira', stems: {}, visibilidade: 'equipe' }]
            : table === 'escala_musicas'
              ? [{ escala_id: 'assigned', musica_id: 'first', studio_projeto_id: 'base' }]
              : services.filter((service) => filters.visivel !== true || service.visivel);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
    } };
    const { GET } = loadTs('app/api/louvor-studio/projects/route.ts', {
      'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
      '@/lib/youtubeSearch': { youtubeId: () => null },
      '@/lib/louvorStudioServer': {
        getLouvorStudioUser: async () => ({ id: 'member' }),
        getLouvorStudioAccess: async () => ({ podeVer: true, podeGerenciar: manager }),
        limparProjetosExpirados: async () => {},
        recuperarProcessamentosLouvorTravados: async () => {},
        louvorStudioAdmin: db,
      },
      '@/lib/louvorStudioStorage': { criarUrlDeLeitura: async () => '' },
    });
    const response = await GET(new Request('http://localhost/projects'));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.escalas.map((service) => service.id), manager ? ['assigned', 'other', 'draft'] : ['assigned']);
    assert.deepEqual(result.escalas[0].escala_musicas.map((song) => song.musica_id), ['first', 'second']);
    assert.equal('escala_itens' in result.escalas[0], false);
    assert.deepEqual(result.projetos[0].escala_usos, [{ escala_id: 'assigned', musica_id: 'first', studio_projeto_id: 'base' }]);
  }
});
const projectId='a007fe56-8080-4924-b79d-b7fd429edddb';
test('only users with Studio management permission can add a music processing job',async()=>{
 for(const [manager,status] of [[false,403],[true,503]]){
  const {POST}=loadTs('app/api/louvor-studio/projects/route.ts',{
   'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
   '@/lib/louvorStudioServer':{
    getLouvorStudioUser:async()=>({id:'member'}),
    getLouvorStudioAccess:async()=>({podeVer:true,podeGerenciar:manager}),
    workerConfigurado:()=>false,
   },
   '@/lib/youtubeSearch':{youtubeId:()=>null},
   '@/lib/louvorStudioStorage':{},
  });
  assert.equal((await POST(new Request('http://localhost/projects',{method:'POST'}))).status,status);
 }
});
function route({user=true,member=true,manager=true,status='concluido',existing=null,expired=false}={}){
 let inserted;
 const db={from(table){
   const query={select(){return this;},eq(){return this;},in:async()=>({count:0}),
     insert(data){inserted=data;return this;},
     async single(){return {data:{id:'version',...inserted,status:'aguardando'}};},
     async maybeSingle(){return {data:table==='louvor_studio_projetos'?{id:projectId,status,expira_em:expired?'2000-01-01':'2099-01-01'}:existing};}};
   return query;
 }};
 const mod=loadTs('app/api/louvor-studio/projects/[id]/versions/route.ts',{
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '@/lib/louvorStudioMusic':music,
  '@/lib/louvorStudioServer':{getLouvorStudioUser:async()=>user?{id:'user'}:null,podeVerLouvorStudio:async()=>member,getLouvorStudioAccess:async()=>({podeGerenciar:manager}),louvorStudioAdmin:db},
  '@/lib/louvorStudioHqServer':{uuidValid:id=>id===projectId,signedVersion:async v=>v}
 });
 return {call:body=>mod.POST(new Request('http://localhost/versions',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:projectId})}),inserted:()=>inserted};
}
test('version API preserves auth, membership, project completion and expiration',async()=>{
 for(const [options,status] of [[{user:false},401],[{member:false},403],[{status:'separando'},409],[{expired:true},404]])assert.equal((await route(options).call({original:'C',target:'D'})).status,status);
});
test('a member without preparation permission cannot queue an exported version',async()=>{
 const subject=route({manager:false});
 assert.equal((await subject.call({original:'C',target:'D'})).status,403);
 assert.equal(subject.inserted(),undefined);
});
test('version API derives semitones on the server and caches identical pitch/speed',async()=>{
 const r=route();assert.equal((await r.call({original:'Em',target:'Dm',direction:'auto',speed:1,semitones:8})).status,202);
 assert.equal(r.inserted().semitones,-2);assert.equal(r.inserted().speed,1);
 const hit=route({existing:{id:'cached',status:'concluido',semitones:-2,speed:1}});
 assert.equal((await (await hit.call({original:'Em',target:'Dm'})).json()).cached,true);assert.equal(hit.inserted(),undefined);
});
test('version API accepts BPM-derived speeds and rejects unsafe values or bad keys',async()=>{
 const custom=route();assert.equal((await custom.call({original:'C',target:'D',speed:.833333})).status,202);assert.equal(custom.inserted().speed,.833333);
 for(const body of [{original:'C',target:'Dm'},{original:'C',target:'D',speed:2},{original:'X',target:'D'},null])assert.equal((await route().call(body)).status,400);
});
test('failed versions have bounded retries',async()=>{
 assert.equal((await route({existing:{status:'erro',tentativas:3}}).call({original:'C',target:'D'})).status,409);
});

const versionId='11111111-1111-4111-8111-111111111111';
const claimToken='22222222-2222-4222-8222-222222222222';
function workerRoute({authorized=true,missing=false}={}){
 const uploads=[];let update;
 const row={id:versionId,projeto_id:projectId,claim_token:claimToken,worker_id:'worker',status:'processando',progresso:20};
 const db={from(table){const filters={};return {select(){return update?Promise.resolve({data:[{id:versionId}]}):this;},eq(k,v){filters[k]=v;return this;},update(value){update=value;return this;},async maybeSingle(){return {data:table==='louvor_studio_projetos'&&!filters.claim_token?{id:projectId,separation_mode:'bs_roformer',expira_em:'2099-01-01'}:filters.claim_token===claimToken&&filters.worker_id==='worker'?row:null};}};},storage:{from(){return {
  async createSignedUploadUrl(path){uploads.push(path);return {data:{signedUrl:'https://storage.example/'+path}};},
  async list(){return {data:missing?[]:uploads.map(path=>({name:path.split('/').pop(),metadata:{size:123}}))};},
  async remove(){return {};}
 };}}};
 const {POST}=loadTs('app/api/louvor-studio/worker/hq/route.ts',{
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '@/lib/louvorStudioMusic':music,
  '@/lib/louvorStudioServer':{validarWorker:()=>authorized,louvorStudioAdmin:db},
  '@/lib/louvorStudioHqServer':{uuidValid:value=>/^[a-f0-9-]{36}$/.test(value)},
  '@/lib/louvorStudioStorage':{
   criarUrlDeEnvio:async path=>{uploads.push(path);return 'https://storage.example/'+path;},
   existeAudio:async()=>!missing,
   removerAudios:async()=>{},
  },
 });
 return {call:(action,extra={},kind='pitch')=>POST(new Request('http://localhost/worker/hq',{method:'POST',headers:{'x-worker-id':'worker'},body:JSON.stringify({kind,id:versionId,claimToken,action,...extra})})),uploads,update:()=>update};
}
test('worker rejects unauthorized/stale claims and isolates upload paths by attempt',async()=>{
 assert.equal((await workerRoute({authorized:false}).call('uploads')).status,401);
 const stale=workerRoute();assert.equal((await stale.call('uploads',{claimToken:versionId})).status,409);assert.equal(stale.uploads.length,0);
 const r=workerRoute();assert.equal((await r.call('uploads',{path:'another-project/file.mp3'})).status,200);
 assert.equal(r.uploads.length,4);assert.ok(r.uploads.every(p=>p.startsWith(projectId+'/v_'+versionId+'_'+claimToken+'_')));
});
test('worker cannot complete missing files and preserves monotonic progress',async()=>{
 assert.equal((await workerRoute({missing:true}).call('complete')).status,409);
 const r=workerRoute();assert.equal((await r.call('heartbeat',{progress:10})).status,200);assert.equal(r.update().progresso,20);
 const done=workerRoute();assert.equal((await done.call('uploads',{},'separate')).status,200);assert.equal((await done.call('complete',{bpm:120,beat_offset_seg:.18},'separate')).status,200);assert.equal(done.update().status,'concluido');assert.equal(done.update().beat_offset_seg,.18);assert.equal(done.update().claim_token,null);
});
