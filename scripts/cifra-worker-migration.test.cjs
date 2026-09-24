const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../.cache/hq-test-deps/node_modules/@electric-sql/pglite");

(async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.musicas(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  `);
  const migration = fs.readFileSync(
    "supabase/migrations/20260924_cifra_worker_queue.sql",
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);

  const userId = crypto.randomUUID();
  await db.query("INSERT INTO auth.users(id) VALUES($1)", [userId]);
  await db.query(
    "INSERT INTO cifra_jobs(user_id,artista_slug,musica_slug) VALUES($1,'morada','e-tudo-sobre-voce')",
    [userId],
  );
  const first = (await db.query("SELECT claim_cifra_job('lenovo-loq') AS job")).rows[0].job;
  assert.equal(first.artista_slug, "morada");
  assert.equal(first.musica_slug, "e-tudo-sobre-voce");
  assert.ok(first.claim_token);
  assert.equal((await db.query("SELECT claim_cifra_job('outro') AS job")).rows[0].job, null);

  await db.exec("UPDATE cifra_jobs SET atualizado_em=now()-interval '3 minutes'");
  const reclaimed = (await db.query("SELECT claim_cifra_job('lenovo-loq') AS job")).rows[0].job;
  assert.ok(reclaimed.claim_token);
  assert.notEqual(reclaimed.claim_token, first.claim_token);
  assert.equal(
    (await db.query("SELECT has_function_privilege('authenticated','claim_cifra_job(text)','EXECUTE') allowed")).rows[0].allowed,
    false,
  );
  await assert.rejects(
    db.query(
      "INSERT INTO cifra_jobs(user_id,artista_slug,musica_slug) VALUES($1,'slug invalido','musica')",
      [userId],
    ),
    /check/i,
  );
  console.log("PASS: cifra queue migration, idempotence, claim, lease, permissions and validation");
  await db.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
