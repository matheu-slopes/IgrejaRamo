// npm install --prefix .cache/studio-retention-test --no-save --no-package-lock @electric-sql/pglite
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.LOUVOR_STUDIO_TEST_PGLITE || '../.cache/studio-retention-test/node_modules/@electric-sql/pglite');
const migration = fs.readFileSync('supabase/migrations/20261005_louvor_studio_retencao_por_culto.sql', 'utf8');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE escalas(id uuid PRIMARY KEY, data date NOT NULL);
      CREATE TABLE musicas(id uuid PRIMARY KEY, letra text, cifra text);
      CREATE TABLE louvor_studio_projetos(id uuid PRIMARY KEY,
        escala_id uuid REFERENCES escalas(id) ON DELETE CASCADE,
        musica_id uuid REFERENCES musicas(id) ON DELETE SET NULL, expira_em timestamptz,
        status text NOT NULL DEFAULT 'concluido');
      CREATE TABLE escala_musicas(id uuid PRIMARY KEY, escala_id uuid REFERENCES escalas(id) ON DELETE CASCADE,
        musica_id uuid REFERENCES musicas(id), tom text, bpm numeric,
        studio_projeto_id uuid REFERENCES louvor_studio_projetos(id) ON DELETE SET NULL);
      CREATE TABLE louvor_studio_versions(id uuid PRIMARY KEY,
        projeto_id uuid REFERENCES louvor_studio_projetos(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'aguardando');
      INSERT INTO escalas VALUES
        ('00000000-0000-4000-8000-000000000001','2026-10-08'),
        ('00000000-0000-4000-8000-000000000002','2026-10-11'),
        ('00000000-0000-4000-8000-000000000003','2026-10-15');
      INSERT INTO musicas VALUES ('00000000-0000-4000-8000-000000000004','letra permanente','cifra permanente');
      INSERT INTO louvor_studio_projetos(id,escala_id,musica_id,expira_em) VALUES
        ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','2099-01-01'),
        ('00000000-0000-4000-8000-000000000006',NULL,NULL,'2099-01-01');
    `);
    const project = '00000000-0000-4000-8000-000000000005';
    const expiry = async () => new Date((await db.query('SELECT expira_em FROM louvor_studio_projetos WHERE id=$1', [project])).rows[0].expira_em).toISOString();
    const freeExpiry = (await db.query("SELECT expira_em FROM louvor_studio_projetos WHERE escala_id IS NULL")).rows[0].expira_em;
    await db.exec(migration);
    await db.exec(migration);
    assert.equal(await expiry(), '2026-10-09T03:00:00.000Z');
    assert.deepEqual((await db.query("SELECT expira_em FROM louvor_studio_projetos WHERE escala_id IS NULL")).rows[0].expira_em, freeExpiry);
    await db.exec(`INSERT INTO escala_musicas VALUES
      ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','D',120,'${project}');`);
    assert.equal(await expiry(), '2026-10-12T03:00:00.000Z');
    // Opening/reusing the player cannot extend retention to another 90 days.
    await db.query("UPDATE louvor_studio_projetos SET expira_em='2099-01-01' WHERE id=$1", [project]);
    assert.equal(await expiry(), '2026-10-12T03:00:00.000Z');
    await db.exec("UPDATE escalas SET data='2026-10-18' WHERE id='00000000-0000-4000-8000-000000000002'");
    assert.equal(await expiry(), '2026-10-19T03:00:00.000Z');
    await db.exec("UPDATE escala_musicas SET escala_id='00000000-0000-4000-8000-000000000003'");
    assert.equal(await expiry(), '2026-10-16T03:00:00.000Z');
    await db.exec("DELETE FROM escalas WHERE id='00000000-0000-4000-8000-000000000001'");
    assert.equal(await expiry(), '2026-10-16T03:00:00.000Z');
    assert.equal((await db.query('SELECT escala_id FROM louvor_studio_projetos WHERE id=$1', [project])).rows[0].escala_id, null);
    await db.query("INSERT INTO louvor_studio_versions(id,projeto_id) VALUES ('00000000-0000-4000-8000-000000000008',$1)", [project]);
    // Use dates in the past so this regression never depends on the test day.
    await db.exec("UPDATE escalas SET data='2000-01-01' WHERE id='00000000-0000-4000-8000-000000000003'");
    const past = await expiry();
    const claim = async () => (await db.query('SELECT claim_louvor_studio_cleanup($1,$2) t', [project, past])).rows[0].t;
    await db.exec("UPDATE louvor_studio_versions SET status='processando'");
    assert.equal(await claim(), null);
    await db.exec("UPDATE louvor_studio_versions SET status='aguardando'");
    assert.ok(await claim());
    assert.equal(await claim(), null, 'a second cleanup cannot delete concurrently');
    await assert.rejects(db.exec("UPDATE escalas SET data='2099-01-01' WHERE id='00000000-0000-4000-8000-000000000003'"), /prepare o audio novamente/);
    assert.equal(await expiry(), past, 'rescheduling during deletion must roll back');
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','claim_louvor_studio_cleanup(uuid,timestamptz)','EXECUTE') allowed")).rows[0].allowed, false);
    await db.exec("UPDATE louvor_studio_projetos SET limpeza_em=now()-interval '16 minutes' WHERE limpeza_em IS NOT NULL");
    assert.ok(await claim(), 'an interrupted deletion can be reclaimed');
    await db.query('DELETE FROM louvor_studio_projetos WHERE id=$1', [project]);
    assert.deepEqual((await db.query('SELECT letra,cifra FROM musicas')).rows, [{ letra: 'letra permanente', cifra: 'cifra permanente' }]);
    assert.deepEqual((await db.query('SELECT tom,bpm,studio_projeto_id FROM escala_musicas')).rows, [{ tom: 'D', bpm: '120', studio_projeto_id: null }]);
    assert.equal((await db.query('SELECT count(*) n FROM louvor_studio_versions')).rows[0].n, 0);
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','louvor_studio_expiracao_cultos(uuid,uuid)','EXECUTE') allowed")).rows[0].allowed, false);
    console.log('PASS: idempotence, service-day expiry, reuse, rescheduling, player renewal, shared audio, permanent repertoire/key and version cleanup');
    const quota = fs.readFileSync('supabase/migrations/20261006_louvor_studio_cota_r2.sql', 'utf8');
    await db.exec(quota); await db.exec(quota);
    const snapshot = async () => (await db.query('SELECT louvor_studio_inicio_medicao() t')).rows[0].t;
    const reserve = async (id, bytes, used, start) => (await db.query(
      'SELECT reservar_espaco_louvor_studio($1,$2,$3,$4) r', [id, bytes, used, start ?? await snapshot()])).rows[0].r;
    const first = '00000000-0000-4000-8000-000000000011';
    const second = '00000000-0000-4000-8000-000000000012';
    const third = '00000000-0000-4000-8000-000000000013';
    const start = await snapshot();
    assert.equal((await reserve(first, 1_100_000_000, 6_000_000_000, start)).permitido, true);
    assert.equal((await reserve(second, 1_100_000_000, 6_000_000_000, start)).permitido, false);
    assert.equal((await reserve(first, 200_000_000, 6_000_000_000, start)).permitido, true);
    assert.equal((await reserve(second, 1_100_000_000, 6_000_000_000, start)).permitido, true);
    await db.query('SELECT finalizar_reserva_louvor_studio($1)', [first]);
    assert.equal((await reserve(third, 1_100_000_000, 6_000_000_000, start)).permitido, false,
      'stale R2 snapshots must keep space reserved for newly completed uploads');
    assert.equal((await reserve(third, 500_000_000, 6_200_000_000)).permitido, true);
    await assert.rejects(reserve(first, 1_100_000_001, 0), /invalida/);
    await assert.rejects(reserve(first, 1, -1), /invalida/);
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','reservar_espaco_louvor_studio(uuid,bigint,bigint,timestamptz)','EXECUTE') allowed")).rows[0].allowed, false);
    await db.exec('DELETE FROM louvor_studio_reservas_espaco');
    assert.equal((await reserve(first, 1_100_000_000, 6_900_000_000)).permitido, true);
    assert.equal((await reserve(second, 1, 6_900_000_000)).permitido, false);
    console.log('PASS: quota idempotence, hard 8 GB cap, concurrent reservations, exact-size replacement, stale-snapshot protection and private permissions');
  } finally {
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
