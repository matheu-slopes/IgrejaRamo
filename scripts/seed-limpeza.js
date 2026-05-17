// Cria os membros ainda não existentes no DB para a escala de Limpeza
// e em seguida insere as 16 escalas de Limpeza (mai+jun/2026)

const https = require("https");
const KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4";
const HOST = "qvqffkoipibgiimrlfpl.supabase.co";
const NEXT_URL = "http://localhost:3000";

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: HOST, path, method,
      headers: {
        apikey: KEY, Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function criarUsuario(nome, email, senha) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    const body = JSON.stringify({ nome, email, senha, role: "membro", ministerios: ["Limpeza"], ativo: true });
    const opts = {
      hostname: "localhost", port: 3000,
      path: "/api/criar-usuario", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const r = http.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    r.on("error", reject);
    r.write(body);
    r.end();
  });
}

// Membros já existentes (id => nome de exibição)
const EXISTENTES = {
  "c9db7bdf-0d50-4698-8728-d45b91e09c63": "Larissa Pedro",
  "2a5a89e6-0452-4643-af64-c17f7881e7e5": "Isadora Fernandes",
  "af737764-2a81-4f89-8153-672571c5df16": "Ricardo Bortot",
  "4d729cce-d0a0-42b1-9d09-62d3cd4b7b87": "Lívia Martins",
  "ad69a900-1be0-41fa-943b-20c30a5bfb3c": "Thaíná Victoria",
  "d153862e-bdc6-4769-8bbd-4814b10b3846": "Melissa Vaz",
  "253ebd74-151a-405b-ba2a-87e64107ab59": "Matheus Lopes",
  "01c938ee-69b0-430b-9fe3-cd6632d70982": "Luisa Lopes",
  "d935d257-c430-44fe-9577-2e15a2ab94fa": "Victor Sabino",
};

// Membros a criar
const CRIAR = [
  { nome: "Thaís",        email: "thaisadv.garcia@gmail.com" },
  { nome: "Pra Bruna",    email: "prabruna.limpeza@ramodavida.com" },
  { nome: "Luan",         email: "luan.limpeza@ramodavida.com" },
  { nome: "Julia",        email: "julia.limpeza@ramodavida.com" },
  { nome: "Beatriz",      email: "beatriz.limpeza@ramodavida.com" },
  { nome: "Aline Fernandes", email: "alinerfb1982@gmail.com" },
  { nome: "Matheusão",    email: "matheusao.limpeza@ramodavida.com" },
  { nome: "Tudes",        email: "tudes.limpeza@ramodavida.com" },
  { nome: "Maria",        email: "maria.limpeza@ramodavida.com" },
  { nome: "Maria Eduarda",email: "mariaeduarda.limpeza@ramodavida.com" },
  { nome: "Kauan",        email: "kauan.limpeza@ramodavida.com" },
  { nome: "Wesley",       email: "wesley.limpeza@ramodavida.com" },
  { nome: "Gabriel Pedro",email: "gabrielpedro.limpeza@ramodavida.com" },
  { nome: "Patricia",     email: "patriciazanni83@gmail.com" },
  { nome: "Fernanda",     email: "fernanda.limpeza@ramodavida.com" },
];

// IDs mapeados (alias curtos → id do DB)
// Preenchidos após criar usuários
const ID = {
  Larissa:       "c9db7bdf-0d50-4698-8728-d45b91e09c63",
  Isa:           "2a5a89e6-0452-4643-af64-c17f7881e7e5",
  Ricardo:       "af737764-2a81-4f89-8153-672571c5df16",
  Livia:         "4d729cce-d0a0-42b1-9d09-62d3cd4b7b87",
  Thaina:        "ad69a900-1be0-41fa-943b-20c30a5bfb3c",
  Mel:           "d153862e-bdc6-4769-8bbd-4814b10b3846",
  MatheusL:      "253ebd74-151a-405b-ba2a-87e64107ab59",
  Luisa:         "01c938ee-69b0-430b-9fe3-cd6632d70982",
  Victor:        "d935d257-c430-44fe-9577-2e15a2ab94fa",
};

// Escalas: DATA / DIA / [voluntarios por nome curto]
// Usamos "Escala de Limpeza" como funcao (está no enum)
const SCHEDULE = [
  // MAIO
  { data: "2026-05-07", dia: "Quinta-Feira", vs: ["Thaís", "Mel"] },
  { data: "2026-05-10", dia: "Domingo",      vs: ["Pra Bruna", "Thaíná Victoria", "Luan"] },
  { data: "2026-05-14", dia: "Quinta-Feira", vs: ["Julia", "Beatriz", "Larissa Pedro"] },
  { data: "2026-05-17", dia: "Domingo",      vs: ["Aline Fernandes", "Isadora Fernandes", "Ricardo Bortot"] },
  { data: "2026-05-21", dia: "Quinta-Feira", vs: ["Lívia Martins", "Matheusão"] },
  { data: "2026-05-24", dia: "Domingo",      vs: ["Tudes", "Maria", "Maria Eduarda"] },
  { data: "2026-05-28", dia: "Quinta-Feira", vs: ["Kauan", "Wesley", "Gabriel Pedro"] },
  { data: "2026-05-31", dia: "Domingo",      vs: ["Patricia", "Victor Sabino"] },
  // JUNHO
  { data: "2026-06-04", dia: "Quinta-Feira", vs: ["Thaís", "Mel"] },
  { data: "2026-06-07", dia: "Domingo",      vs: ["Pra Bruna", "Thaíná Victoria", "Luan"] },
  { data: "2026-06-11", dia: "Quinta-Feira", vs: ["Julia", "Beatriz", "Larissa Pedro"] },
  { data: "2026-06-14", dia: "Domingo",      vs: ["Aline Fernandes", "Isadora Fernandes", "Ricardo Bortot"] },
  { data: "2026-06-18", dia: "Quinta-Feira", vs: ["Matheus Lopes", "Luisa Lopes", "Fernanda"] },
  { data: "2026-06-21", dia: "Domingo",      vs: ["Tudes", "Maria", "Maria Eduarda"] },
  { data: "2026-06-25", dia: "Quinta-Feira", vs: ["Kauan", "Wesley", "Gabriel Pedro"] },
  { data: "2026-06-28", dia: "Domingo",      vs: ["Patricia", "Victor Sabino"] },
];

(async () => {
  // 1. Criar usuários e coletar IDs
  const nomeParaId = { ...Object.fromEntries(Object.entries(EXISTENTES).map(([id,n])=>[n,id])) };
  // Aliases extras
  nomeParaId["Larissa Pedro"]       = ID.Larissa;
  nomeParaId["Mel"]                 = ID.Mel;
  nomeParaId["Isa"]                 = ID.Isa;
  nomeParaId["Isadora Fernandes"]   = ID.Isa;
  nomeParaId["Ricardo Bortot"]      = ID.Ricardo;
  nomeParaId["Lívia Martins"]       = ID.Livia;
  nomeParaId["Thaíná Victoria"]     = ID.Thaina;
  nomeParaId["Matheus Lopes"]       = ID.MatheusL;
  nomeParaId["Luisa Lopes"]         = ID.Luisa;
  nomeParaId["Victor Sabino"]       = ID.Victor;

  for (const m of CRIAR) {
    const r = await criarUsuario(m.nome, m.email, "ramo123");
    if (r.status === 200 && r.body.id) {
      console.log(`✓ Criado: ${m.nome} (${r.body.id})`);
      nomeParaId[m.nome] = r.body.id;
    } else {
      console.error(`✗ Erro ${m.nome}:`, r.body);
      // Salva null para usar nome sem id
      nomeParaId[m.nome] = null;
    }
  }

  // 2. Inserir escalas
  for (const esc of SCHEDULE) {
    const culto = esc.dia === "Quinta-Feira" ? "Culto de Quinta" : "Culto de Domingo";
    const horario = esc.dia === "Quinta-Feira" ? "20:00" : "18:30";
    const r1 = await req("POST", "/rest/v1/escalas", [{
      ministerio: "Limpeza",
      data: esc.data,
      horario,
      culto,
      observacoes: null,
      visivel: true,
      confirmacao_participantes: false,
    }]);
    if (r1.status !== 201) { console.error(`ERRO escala ${esc.data}:`, r1.body); continue; }
    const escalaId = JSON.parse(r1.body)[0].id;
    console.log(`✓ Escala Limpeza ${esc.data}: ${escalaId}`);

    const itens = esc.vs.map((nome) => ({
      escala_id: escalaId,
      funcao: "Escala de Limpeza",
      voluntario_id: nomeParaId[nome] || null,
      voluntario_nome: nome,
      observacao: null,
    }));
    const r2 = await req("POST", "/rest/v1/escala_itens", itens);
    if (r2.status !== 201) console.error(`  ERRO itens:`, r2.body);
    else console.log(`  ✓ ${itens.length} voluntários`);
  }
  console.log("\nConcluído!");
})();
