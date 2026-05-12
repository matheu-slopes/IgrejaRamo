// Cria membros novos do Mídias + 12 escalas de maio/2026
const http = require("http");
const https = require("https");

const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4";
const HOST = "qvqffkoipibgiimrlfpl.supabase.co";

function dbReq(method, path, body) {
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

function criarUsuario(nome, email, senha, ministerio) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ nome, email, senha, role: "membro", ministerios: [ministerio], ativo: true });
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

// Membros já existentes relevantes para Mídias
const EXISTENTES = {
  Wallace:  null, // novo
  Vitoria:  null, // novo
  Mauricio: null, // novo
  Wesley:   "d5a0dd9f-55cd-49a5-884f-b9384554f106",
  "Thaís":  "566e38fa-af2c-40f5-abd4-c92ccacc0680",
  Gabriel:  "e0865d88-744f-4fa2-8632-5a6c5f3b7266", // Gabriel Pedro
  Julia:    "055a714c-650d-41e6-bb7c-7487bf8fdbea",
  Luan:     "94eed748-4bc9-415d-bc43-e30bf701bb71",
  Kauan:    "a3e1eb53-c0eb-4341-ae25-3559fdd09462",
  Maria:    "62b058d5-7bbc-4b66-80db-100a11bc7f39",
  Beatriz:  "72e7e02c-56e5-46c3-ac40-6e45b0d18b50",
  Fernanda: "bef81a4f-919f-45a7-a14a-04f544607bcd",
};

// CULTOS: data / tipo / [midia, live] (null = só uma pessoa, coluna mesclada)
// MIDIA = "Transmissão", LIVE = "Projeção/Letras"
const ESCALAS = [
  { data: "2026-05-03", dia: "Domingo",       culto: "Culto de Domingo (Ceia - Manhã)",   horario: "09:00", midia: "Wallace",  live: "Wesley"   },
  { data: "2026-05-05", dia: "Terça",         culto: "Culto de Mulheres",                  horario: "20:00", midia: "Thaís",   live: null        },
  { data: "2026-05-07", dia: "Quinta-Feira",  culto: "Culto de Quinta",                    horario: "20:00", midia: "Gabriel", live: "Thaís"     },
  { data: "2026-05-09", dia: "Sábado",        culto: "Culto de Jovens",                    horario: "19:00", midia: "Julia",   live: null        },
  { data: "2026-05-10", dia: "Domingo",       culto: "Culto de Domingo",                   horario: "18:30", midia: "Vitória", live: "Mauricio"  },
  { data: "2026-05-14", dia: "Quinta-Feira",  culto: "Culto de Quinta",                    horario: "20:00", midia: "Luan",    live: "Kauan"     },
  { data: "2026-05-17", dia: "Domingo",       culto: "Culto de Domingo",                   horario: "18:30", midia: "Wallace", live: "Maria"     },
  { data: "2026-05-21", dia: "Quinta-Feira",  culto: "Culto de Quinta",                    horario: "20:00", midia: "Beatriz", live: "Julia"     },
  { data: "2026-05-23", dia: "Sábado",        culto: "Culto de Jovens",                    horario: "19:00", midia: "Kauan",   live: null        },
  { data: "2026-05-24", dia: "Domingo",       culto: "Culto de Domingo",                   horario: "18:30", midia: "Gabriel", live: "Thaís"     },
  { data: "2026-05-28", dia: "Quinta-Feira",  culto: "Culto de Quinta",                    horario: "20:00", midia: "Fernanda",live: "Wesley"    },
  { data: "2026-05-31", dia: "Domingo",       culto: "Culto de Domingo",                   horario: "18:30", midia: "Vitória", live: "Mauricio"  },
];

(async () => {
  const NID = { ...EXISTENTES };

  // 1. Criar novos membros
  const novos = [
    { key: "Wallace",  nome: "Wallace",  email: "wallace.midias@ramodavida.com" },
    { key: "Vitoria",  nome: "Vitória",  email: "vitoria.midias@ramodavida.com" },
    { key: "Mauricio", nome: "Mauricio", email: "mauricio.midias@ramodavida.com" },
  ];
  for (const m of novos) {
    const r = await criarUsuario(m.nome, m.email, "ramo123", "Mídias");
    if (r.status === 200 && r.body.id) {
      console.log(`✓ Criado: ${m.nome} (${r.body.id})`);
      NID[m.key] = r.body.id;
      NID[m.nome] = r.body.id;
    } else {
      console.error(`✗ Erro ${m.nome}:`, r.body);
    }
  }

  // 2. Inserir perfis manualmente (trigger issue)
  const perfisNovos = novos.filter(m => NID[m.key]).map(m => ({
    id: NID[m.key],
    nome: m.nome,
    email: m.email,
    role: "membro",
    ministerios: ["Mídias"],
    lider_ministerios: [],
    ativo: true,
  }));
  if (perfisNovos.length > 0) {
    const rp = await dbReq("POST", "/rest/v1/perfis", perfisNovos);
    console.log("Perfis:", rp.status, rp.body.substring(0, 80));
  }

  // 3. Inserir membros_ministerio
  const todos_ids = novos.filter(m => NID[m.key]).map(m => NID[m.key]);
  // Também vincular os já existentes ao ministério Mídias
  const existentes_ids = Object.entries(EXISTENTES)
    .filter(([, v]) => v !== null)
    .map(([, v]) => v);
  const todos = [...new Set([...todos_ids, ...existentes_ids])];
  const membros = todos.map(id => ({ usuario_id: id, ministerio: "Mídias", funcao: "Membro", ativo: true }));
  const rm = await dbReq("POST", "/rest/v1/membros_ministerio", membros);
  console.log("membros_ministerio:", rm.status);

  // 4. Inserir escalas
  for (const esc of ESCALAS) {
    const r1 = await dbReq("POST", "/rest/v1/escalas", [{
      ministerio: "Mídias",
      data: esc.data,
      horario: esc.horario,
      culto: esc.culto,
      observacoes: null,
      visivel: true,
      confirmacao_participantes: false,
    }]);
    if (r1.status !== 201) { console.error(`ERRO escala ${esc.data}:`, r1.body); continue; }
    const escalaId = JSON.parse(r1.body)[0].id;
    console.log(`✓ Escala Mídias ${esc.data}: ${escalaId}`);

    const itens = [];
    // MIDIA sempre existe
    itens.push({
      escala_id: escalaId, funcao: "Transmissão",
      voluntario_id: NID[esc.midia] || NID[esc.midia.replace("í","i")] || null,
      voluntario_nome: esc.midia, observacao: null,
    });
    // LIVE (quando há)
    if (esc.live) {
      itens.push({
        escala_id: escalaId, funcao: "Projeção/Letras",
        voluntario_id: NID[esc.live] || NID[esc.live.replace("í","i")] || null,
        voluntario_nome: esc.live, observacao: null,
      });
    }

    const r2 = await dbReq("POST", "/rest/v1/escala_itens", itens);
    if (r2.status !== 201) console.error(`  ERRO itens:`, r2.body);
    else console.log(`  ✓ ${itens.length} voluntário(s): ${esc.midia}${esc.live ? " + " + esc.live : ""}`);
  }
  console.log("\nConcluído!");
})();
