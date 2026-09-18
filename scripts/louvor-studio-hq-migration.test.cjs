// Install test-only engine: npm install --prefix .cache/hq-test-deps --no-package-lock @electric-sql/pglite
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('../.cache/hq-test-deps/node_modules/@electric-sql/pglite');
(async()=>{
const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,file_size_limit bigint,allowed_mime_types text[]);INSERT INTO storage.buckets(id) VALUES('louvor-studio');
CREATE TABLE public.louvor_studio_projetos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text DEFAULT 'aguardando',progresso integer DEFAULT 0,erro text,worker_id text,criado_em timestamptz DEFAULT now(),atualizado_em timestamptz DEFAULT now(),processando_em timestamptz,expira_em timestamptz DEFAULT now()+interval '1 day');`);
const migration=fs.readFileSync('supabase/migrations/20260918_louvor_studio_hq.sql','utf8');await db.exec(migration);await db.exec(migration);
const claim=async()=> (await db.query("select claim_louvor_hq('test-worker') job")).rows[0].job;
assert.equal(await claim(),null);
await db.exec("insert into louvor_studio_projetos(pipeline_version,separation_mode) values(1,'legacy')");
assert.equal(await claim(),null);
await db.exec("insert into louvor_studio_projetos(pipeline_version,separation_mode) values(2,'bs_roformer')");
const job=await claim();assert.equal(job.kind,'separate');assert.ok(job.project.claim_token);assert.equal(job.project.tentativas,1);
assert.equal(await claim(),null);
await db.query("update louvor_studio_projetos set status='concluido' where id=$1",[job.project.id]);
await db.query("insert into louvor_studio_versions(projeto_id,semitones) values($1,2)",[job.project.id]);
const version=await claim();assert.equal(version.kind,'pitch');assert.equal(version.version.semitones,2);assert.ok(version.version.claim_token);
assert.equal(await claim(),null);
await db.exec("update louvor_studio_versions set atualizado_em=now()-interval '6 minutes'");await claim();
assert.equal((await db.query('select status,claim_token from louvor_studio_versions')).rows[0].status,'erro');
assert.equal((await db.query('select status,claim_token from louvor_studio_versions')).rows[0].claim_token,null);
await assert.rejects(db.query("insert into louvor_studio_versions(projeto_id,semitones) values($1,2)",[job.project.id]),/unique/);
await assert.rejects(db.query("insert into louvor_studio_versions(projeto_id,semitones) values($1,12)",[job.project.id]),/check/);
assert.equal((await db.query("select has_function_privilege('authenticated','claim_louvor_hq(text)','EXECUTE') allowed")).rows[0].allowed,false);
await db.query('delete from louvor_studio_projetos where id=$1',[job.project.id]);assert.equal((await db.query('select count(*) n from louvor_studio_versions')).rows[0].n,0);
console.log('PASS: migration idempotence, original projects, claims, leases, unique cache, range, permissions, cascade');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
