const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const { PGlite }=require('../.cache/team-check/node_modules/@electric-sql/pglite');

test('reservas respeitam limite, concorrência e não ficam abertas para usuários',async()=>{
  const db=new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.perfis(id uuid PRIMARY KEY, foto text);');
    const sql=fs.readFileSync('supabase/migrations/20261124_cota_midias_r2.sql','utf8');
    await db.exec(sql); await db.exec(sql);
    const a='00000000-0000-4000-8000-000000000001';
    const b='00000000-0000-4000-8000-000000000002';
    const snapshot=(await db.query('SELECT midias_r2_inicio_medicao() t')).rows[0].t;
    const reserve=async(id,bytes,used,start=snapshot)=>(await db.query('SELECT reservar_espaco_midias_r2($1,$2,$3,$4) r',[id,bytes,used,start])).rows[0].r;
    assert.equal((await reserve(a,4_000_000,996_000_000)).permitido,true);
    assert.equal((await reserve(b,1,996_000_000)).permitido,false);
    await db.query('SELECT finalizar_reserva_midias_r2($1)',[a]);
    assert.equal((await reserve(b,1,996_000_000)).permitido,false,'a medição antiga não ignora upload concluído');
    assert.equal((await reserve(b,1,1_000_000_000)).permitido,false);
    await assert.rejects(reserve(a,4_194_305,0),/inválida/);
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','reservar_espaco_midias_r2(uuid,bigint,bigint,timestamptz)','EXECUTE') ok")).rows[0].ok,false);
    await db.query('INSERT INTO public.perfis(id,foto) VALUES ($1,$2)',[a,'data:image/png;base64,AAAA']);
    const nova=`r2midia:perfis/${a}/11111111-1111-4111-8111-111111111111.png`;
    assert.equal((await db.query('SELECT migrar_foto_perfil_r2($1,$2,$3) ok',[a,'data:image/png;base64,AAAA',nova])).rows[0].ok,true);
    assert.equal((await db.query('SELECT migrar_foto_perfil_r2($1,$2,$3) ok',[a,'data:image/png;base64,AAAA',nova])).rows[0].ok,false);
    assert.deepEqual((await db.query('SELECT foto_original,referencia_nova FROM public.midias_r2_fotos_backup')).rows,[{foto_original:'data:image/png;base64,AAAA',referencia_nova:nova}]);
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','migrar_foto_perfil_r2(uuid,text,text)','EXECUTE') ok")).rows[0].ok,false);
  } finally { await db.close(); }
});
