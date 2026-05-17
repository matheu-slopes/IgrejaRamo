/**
 * seed-recepcionamento.js
 * Cria escalas do Ministério Cantina (Recepcionamento) de Maio–Junho/2026.
 * 
 * Regras de armazenamento (não muda o ENUM):
 *   Abertura → funcao="Abertura/Oferta", observacao="Abertura"
 *   Oferta   → funcao="Abertura/Oferta", observacao="Oferta"
 *   Recepção → funcao="Recepção",        observacao=null
 */

const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");

const supabase = createClient(
  "https://qvqffkoipibgiimrlfpl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4"
);

const DEFAULT_PASSWORD = "ramo123";
const ALINE_ID  = "f3e3d3ee-9a2f-4a7b-a587-a5ebfb023659"; // Aline Fernandes (líder)

// ─── Pessoas conhecidas (já no DB) ───────────────────────────────────────────
const KNOWN = {
  "Vitória":       { id: "c7823af4-60ed-47c8-b76c-d0c0ea3b884c", nome: "Vitória Mauricio" },
  "Mauricio":      { id: "547632e3-54ff-4870-9b4e-e23330148fe6", nome: "Mauricio Steinle" },
  "Aline":         { id: "f3e3d3ee-9a2f-4a7b-a587-a5ebfb023659", nome: "Aline Fernandes" },
  "Ricardo":       { id: "af737764-2a81-4f89-8153-672571c5df16", nome: "Ricardo Bortot" },
  "Thais":         { id: "1dbd58fb-14ec-4bbf-a55d-27e3b1711b5b", nome: "Thais Igreja" },
  "Victor":        { id: "d935d257-c430-44fe-9577-2e15a2ab94fa", nome: "Victor Sabino" },
  "MatheusA":      { id: "4c646c5d-cf1a-401f-a8bf-5bc9af996cdf", nome: "Matheus Alves" },
  "MatheusL":      { id: "253ebd74-151a-405b-ba2a-87e64107ab59", nome: "Matheus Lopes" },
  "Livia":         { id: "4d729cce-d0a0-42b1-9d09-62d3cd4b7b87", nome: "Lívia Martins" },
  "Patricia":      { id: "10a78166-dffc-4540-9492-a9dec91ef63c", nome: "Patricia" },
};

// ─── Pessoas a criar (sem email real → placeholder) ──────────────────────────
const A_CRIAR = [
  { chave: "Viviane",  nome: "Viviane",  email: "viviane@recepcionamento.ramodavida.com" },
  { chave: "Luciene",  nome: "Luciene",  email: "luciene@recepcionamento.ramodavida.com" },
  { chave: "Cleuber",  nome: "Cleuber",  email: "cleuber@recepcionamento.ramodavida.com" },
  { chave: "Alisson",  nome: "Alisson",  email: "alissonpierce@gmail.com" },
  { chave: "Marcos",   nome: "Marcos",   email: "marcos@recepcionamento.ramodavida.com"  },
  { chave: "Ana",      nome: "Ana",      email: "ana@recepcionamento.ramodavida.com"     },
  { chave: "Juliano",  nome: "Juliano",  email: "juliano@recepcionamento.ramodavida.com" },
];

// ─── Schedule ─────────────────────────────────────────────────────────────────
// Helpers: ref(chave) → item usando KNOWN[chave] ou criado dinamicamente
function ab(chave) { return { tipo: "Abertura", ref: chave }; }
function of(chave) { return { tipo: "Oferta",   ref: chave }; }
function re(chave) { return { tipo: "Recepção",  ref: chave }; }

const ESCALAS = [
  { data: "2026-05-10", culto: "Culto de Domingo", horario: "18:30",
    itens: [ab("Vitória"), of("Mauricio"), re("Aline"), re("Ricardo")] },
  { data: "2026-05-14", culto: "Culto de Quinta",  horario: "20:00",
    itens: [of("Thais"), re("Viviane"), re("Patricia")] },
  { data: "2026-05-17", culto: "Culto de Domingo", horario: "18:30",
    itens: [ab("Cleuber"), of("Victor"), re("Cleuber"), re("Luciene")] },
  { data: "2026-05-21", culto: "Culto de Quinta",  horario: "20:00",
    itens: [of("MatheusA"), re("Aline"), re("Aline")] },  // Aline S / Aline (única Aline conhecida)
  { data: "2026-05-24", culto: "Culto de Domingo", horario: "18:30",
    itens: [ab("Livia"), of("Alisson"), re("Marcos"), re("Viviane")] },
  { data: "2026-05-28", culto: "Culto de Quinta",  horario: "20:00",
    itens: [of("Thais"), re("Ana"), re("Patricia")] },
  { data: "2026-05-31", culto: "Culto de Domingo", horario: "18:30",
    itens: [ab("Patricia"), of("MatheusL"), re("Ana"), re("Juliano")] },
  { data: "2026-06-04", culto: "Culto de Quinta",  horario: "20:00",
    itens: [of("Victor"), re("Viviane"), re("Aline")] },
  { data: "2026-06-07", culto: "Culto de Domingo (Santa Ceia)", horario: "18:30",
    itens: [ab("Cleuber"), of("MatheusA"), re("Aline"), re("Alisson")] },
  { data: "2026-06-11", culto: "Culto de Quinta",  horario: "20:00",
    itens: [of("Alisson"), re("Patricia"), re("Ana")] },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const pessoas = { ...KNOWN }; // chave → { id, nome }

  // 1. Criar usuários faltantes
  console.log("=== Criando novos usuários ===");
  for (const p of A_CRIAR) {
    // Verifica se já existe pelo email
    const { data: existing } = await supabase.from("perfis").select("id,nome").eq("email", p.email).maybeSingle();
    if (existing) {
      console.log(`  ~ ${p.nome} já existe: ${existing.id}`);
      pessoas[p.chave] = { id: existing.id, nome: existing.nome };
      continue;
    }
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: p.email, password: DEFAULT_PASSWORD, email_confirm: true,
    });
    if (authErr) { console.error(`  ✗ ${p.nome}: ${authErr.message}`); continue; }
    const newId = authData.user.id;
    await supabase.from("perfis").upsert({
      id: newId, nome: p.nome, email: p.email,
      ministerios: ["Cantina"], role: "membro", ativo: true,
    });
    pessoas[p.chave] = { id: newId, nome: p.nome };
    console.log(`  ✓ Criado ${p.nome} <${p.email}> → ${newId}`);
  }

  // 2. Adicionar Cantina aos membros já existentes
  console.log("\n=== Atualizando ministérios ===");
  const todosIds = [...new Set(Object.values(pessoas).map((p) => p.id))];
  for (const id of todosIds) {
    const { data: perf } = await supabase.from("perfis").select("nome,ministerios").eq("id", id).maybeSingle();
    if (!perf) continue;
    const mins = new Set(perf.ministerios ?? []);
    if (!mins.has("Cantina")) {
      mins.add("Cantina");
      await supabase.from("perfis").update({ ministerios: [...mins] }).eq("id", id);
      console.log(`  ~ ${perf.nome}: +[Cantina]`);
    }
  }

  // 3. Apagar escalas antigas do Cantina (para não duplicar)
  const { data: antigas } = await supabase.from("escalas").select("id").eq("ministerio", "Cantina");
  if (antigas?.length) {
    for (const e of antigas) {
      await supabase.from("escala_itens").delete().eq("escala_id", e.id);
      await supabase.from("escalas").delete().eq("id", e.id);
    }
    console.log(`\n  Removidas ${antigas.length} escalas antigas do Cantina.`);
  }

  // 4. Criar escalas
  console.log("\n=== Criando escalas ===");
  let ok = 0;
  for (const esc of ESCALAS) {
    const { data: inserted, error } = await supabase.from("escalas").insert({
      ministerio: "Cantina",
      data: esc.data,
      horario: esc.horario,
      culto: esc.culto,
      observacoes: null,
      visivel: true,
      criado_por: ALINE_ID,
    }).select().single();

    if (error || !inserted) { console.error(`  ✗ ${esc.data}: ${error?.message}`); continue; }

    const itensDB = esc.itens.map((it) => {
      const pessoa = pessoas[it.ref];
      return {
        escala_id: inserted.id,
        funcao: it.tipo === "Recepção" ? "Recepção" : "Abertura/Oferta",
        observacao: it.tipo === "Recepção" ? null : it.tipo, // "Abertura" ou "Oferta"
        voluntario_id: pessoa?.id || null,
        voluntario_nome: pessoa?.nome ?? it.ref,
      };
    });

    await supabase.from("escala_itens").insert(itensDB);
    console.log(`  ✓ ${esc.data} ${esc.culto} — ${itensDB.length} participantes`);
    ok++;
  }

  console.log(`\n✅ ${ok}/${ESCALAS.length} escalas criadas.`);
  console.log("\n⚠️  Usuários criados com email PLACEHOLDER:");
  A_CRIAR.forEach((p) => console.log(`   ${p.nome}: ${p.email} → senha: ramo123`));
  console.log("   Atualize os emails reais pelo painel admin quando disponíveis.");
}

main().catch(console.error);
