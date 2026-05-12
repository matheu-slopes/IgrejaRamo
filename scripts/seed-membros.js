/**
 * seed-membros.js
 * - Garante que cada pessoa esteja no(s) ministério(s) certo(s)
 * - Cria conta (email + senha ramo123) para quem ainda não tem
 * - Reseta a senha de TODOS os usuários para ramo123,
 *   EXCETO: usuários com role="admin" e Matheus Lopes (MY_ID)
 * 
 * Pessoas sem email (Beatriz, Edeni, Pastora Bruna) são buscadas pelo
 * nome no DB; se não existirem, são listadas no final para ação manual.
 */

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://qvqffkoipibgiimrlfpl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4"
);

const DEFAULT_PASSWORD = "ramo123";
const MY_ID = "253ebd74-151a-405b-ba2a-87e64107ab59"; // Matheus Lopes – nunca resetar

// ─── Lista mestre ──────────────────────────────────────────────────────────────
// Dedupliquei por email. Ministérios = union de todas as listas.
// skipPassword:true → nunca resetar esta conta.
const PESSOAS = [
  // ── Mídias + Limpeza ─────────────────────────────────────────────────────
  { nome: "Beatriz",           email: null,                               ministerios: ["Mídias", "Limpeza"] },
  { nome: "Fernanda Lopes",    email: "fer.lopes1949@gmail.com",          ministerios: ["Mídias", "Limpeza"] },
  { nome: "Gabriel Pedro",     email: "biel13v@gmail.com",                ministerios: ["Mídias", "Limpeza"] },
  { nome: "Isadora Fernandes", email: "isaferbrito@gmail.com",            ministerios: ["Mídias", "Limpeza", "Louvor"] },
  { nome: "Julia",             email: "juliasantosp25@gmail.com",         ministerios: ["Mídias", "Limpeza"] },
  { nome: "Kauan Fernandes",   email: "kauanfs999@gmail.com",             ministerios: ["Mídias", "Limpeza"] },
  { nome: "Luan Castro",       email: "luan.caastroo@gmail.com",          ministerios: ["Mídias", "Limpeza"] },
  { nome: "Maria Costa",       email: "mariaaeduardacostt@gmail.com",     ministerios: ["Mídias", "Limpeza"] },
  { nome: "Maria Rodrigues",   email: "duuda.rodrigues989@gmail.com",     ministerios: ["Mídias", "Limpeza"] },
  { nome: "Thais Igreja",      email: "thaisadv.garcia@gmail.com",        ministerios: ["Mídias", "Limpeza"] },
  { nome: "Wesley",            email: "wesleyisfe77@gmail.com",           ministerios: ["Mídias", "Limpeza"] },
  // ── Mídias somente ────────────────────────────────────────────────────────
  { nome: "Mauricio Steinle",  email: "msteinlecdm@icloud.com",           ministerios: ["Mídias"] },
  { nome: "Vitória Mauricio",  email: "steinlevitoria0@gmail.com",        ministerios: ["Mídias"] },
  { nome: "Wallace Amós",      email: "santoswallace325@gmail.com",       ministerios: ["Mídias"] },
  // ── Limpeza + Louvor ─────────────────────────────────────────────────────
  { nome: "Eduarda Tudes",     email: "eduardatudes@hotmail.com",         ministerios: ["Limpeza", "Louvor"] },
  { nome: "Larissa Pedro",     email: "larissapedro645@gmail.com",        ministerios: ["Limpeza", "Louvor"] },
  { nome: "Lívia Martins",     email: "martinslivia373@gmail.com",        ministerios: ["Limpeza", "Louvor"] },
  { nome: "Luisa Lopes",       email: "lluisalopes23@gmail.com",          ministerios: ["Limpeza", "Louvor"] },
  { nome: "Matheus Alves",     email: "matheusalvesbenedito@gmail.com",   ministerios: ["Limpeza", "Louvor"] },
  { nome: "Melissa Vaz",       email: "melissa.lovato@alu.apac.org.br",   ministerios: ["Limpeza", "Louvor"] },
  { nome: "Ricardo Bortot",    email: "ricardo.bortot17@gmail.com",       ministerios: ["Limpeza", "Louvor"] },
  { nome: "Thaína Victoria",   email: "thainavictoria1235@gmail.com",     ministerios: ["Limpeza", "Louvor"] },
  { nome: "Victor Sabino",     email: "victorsabinodossantos@gmail.com",  ministerios: ["Limpeza", "Louvor"] },
  // ── Limpeza somente ───────────────────────────────────────────────────────
  { nome: "Aline Fernandes",   email: "alinerfb1982@gmail.com",           ministerios: ["Limpeza"] },
  { nome: "Pastora Bruna",     email: null,                               ministerios: ["Limpeza"] },
  { nome: "Patricia",          email: "patriciazanni83@gmail.com",        ministerios: ["Limpeza"] },
  // ── Louvor somente ────────────────────────────────────────────────────────
  { nome: "Edeni",             email: null,                               ministerios: ["Louvor"] },
  { nome: "Pastor Flavio",     email: "fbombati@gmail.com",               ministerios: ["Louvor"] },
  // ── Matheus Lopes (dono) – nunca resetar senha ────────────────────────────
  { nome: "Matheus Lopes",     email: null,                               ministerios: ["Limpeza", "Louvor"], skipPassword: true },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Buscar todos os perfis existentes
  const { data: todasPerfis, error: perfisErr } = await supabase
    .from("perfis")
    .select("id, nome, email, ministerios, role, ativo");
  if (perfisErr) { console.error("Erro ao buscar perfis:", perfisErr); return; }
  console.log(`\n=== ${todasPerfis.length} perfis no DB ===\n`);

  // Índices de busca
  const perfilPorEmail = {};
  const perfilPorNome  = {};
  for (const p of todasPerfis) {
    if (p.email) perfilPorEmail[p.email.toLowerCase()] = p;
    perfilPorNome[p.nome.toLowerCase()] = p;
  }
  // Garantir busca pelo ID fixo de Matheus Lopes
  const matheusPerfil = todasPerfis.find((p) => p.id === MY_ID);
  if (matheusPerfil) perfilPorNome["matheus lopes"] = matheusPerfil;

  const criados    = [];
  const atualizados = [];
  const semEmail   = [];
  const erros      = [];

  for (const pessoa of PESSOAS) {
    const emailKey = pessoa.email?.toLowerCase();

    // Tentar encontrar pelo email ou pelo nome
    let existente = emailKey ? perfilPorEmail[emailKey] : null;
    if (!existente) existente = perfilPorNome[pessoa.nome.toLowerCase()];

    if (existente) {
      // ── Atualizar ministérios ──────────────────────────────────────────────
      const mins = new Set(existente.ministerios ?? []);
      const novos = pessoa.ministerios.filter((m) => !mins.has(m));
      if (novos.length > 0) {
        novos.forEach((m) => mins.add(m));
        const { error } = await supabase
          .from("perfis")
          .update({ ministerios: [...mins] })
          .eq("id", existente.id);
        if (error) erros.push({ nome: pessoa.nome, erro: error.message });
        else atualizados.push({ nome: pessoa.nome, id: existente.id, novos });
      } else {
        atualizados.push({ nome: pessoa.nome, id: existente.id, novos: [] });
      }

      // ── Resetar senha (se aplicável) ─────────────────────────────────────
      if (!pessoa.skipPassword && existente.role !== "admin") {
        const { error } = await supabase.auth.admin.updateUserById(existente.id, {
          password: DEFAULT_PASSWORD,
        });
        if (error) erros.push({ nome: pessoa.nome, erro: `senha: ${error.message}` });
      }

    } else if (pessoa.email) {
      // ── Criar novo usuário ────────────────────────────────────────────────
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: pessoa.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });
      if (authErr) {
        erros.push({ nome: pessoa.nome, erro: authErr.message });
        continue;
      }
      const newId = authData.user.id;

      // Inserir perfil (upsert por segurança)
      const { error: perfilErr } = await supabase.from("perfis").upsert({
        id: newId,
        nome: pessoa.nome,
        email: pessoa.email,
        ministerios: pessoa.ministerios,
        role: "membro",
        ativo: true,
      });
      if (perfilErr) erros.push({ nome: pessoa.nome, erro: `perfil: ${perfilErr.message}` });
      else criados.push({ nome: pessoa.nome, id: newId, email: pessoa.email });

      // Atualizar índices para não duplicar em próximas iterações
      perfilPorEmail[pessoa.email.toLowerCase()] = { id: newId, nome: pessoa.nome, email: pessoa.email, ministerios: pessoa.ministerios, role: "membro" };
      perfilPorNome[pessoa.nome.toLowerCase()] = perfilPorEmail[pessoa.email.toLowerCase()];

    } else {
      semEmail.push(pessoa.nome);
    }
  }

  // ── Relatório parcial ──────────────────────────────────────────────────────
  console.log("✅ CRIADOS:", criados.length);
  criados.forEach((c) => console.log(`  + ${c.nome} <${c.email}> → ${c.id}`));

  console.log("\n✏️  ATUALIZADOS (ministérios):", atualizados.filter((a) => a.novos.length).length);
  atualizados.filter((a) => a.novos.length).forEach((a) =>
    console.log(`  ~ ${a.nome}: +[${a.novos.join(", ")}]`)
  );

  console.log("\n⚠️  SEM EMAIL – ação manual necessária:", semEmail.join(", ") || "nenhum");

  // ── Resetar senhas de TODOS os auth users (exceto admin e MY_ID) ──────────
  console.log("\n🔑 Resetando senhas de todos os usuários restantes...");
  const adminIds = new Set([MY_ID, ...todasPerfis.filter((p) => p.role === "admin").map((p) => p.id)]);

  let page = 1;
  let resetCount = 0;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if (adminIds.has(u.id)) continue;
      // Não resetar Matheus Lopes mesmo se não estiver ainda no índice
      if (u.id === MY_ID) continue;
      const { error: pwErr } = await supabase.auth.admin.updateUserById(u.id, {
        password: DEFAULT_PASSWORD,
      });
      if (pwErr) console.warn(`  ⚠ Senha não resetada para ${u.email}: ${pwErr.message}`);
      else resetCount++;
    }
    if (data.users.length < 100) break;
    page++;
  }
  console.log(`  ${resetCount} senhas resetadas para "${DEFAULT_PASSWORD}".`);

  if (erros.length) {
    console.log("\n❌ ERROS:");
    erros.forEach((e) => console.log(`  ! ${e.nome}: ${e.erro}`));
  }

  console.log("\n✅ CONCLUÍDO!");
}

main().catch(console.error);
