// Script para criar as 8 escalas de Louvor de Maio/2026
// Equipe 1 (Pr Flávio): Isa, Tudes, Ricardo  →  07/mai E1 → N/A, 14/mai E1, 24/mai E1
// Equipe 2 (Matheus Alves): Lívia, Edeni, Victor, Thainá  →  07/mai, 17/mai, 28/mai
// Equipe 3 (Matheus Lopes): Luisa, Mel, Larissa  →  10/mai, 21/mai, 31/mai

const https = require("https");
const KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4";
const HOST = "qvqffkoipibgiimrlfpl.supabase.co";

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

// Equipe 1
const E1 = [
  { id: "093a4e47-e3b6-4ffe-9ac0-efcdf0800bf9", nome: "Pastor Flavio",      funcao: "Ministro",      obs: null },
  { id: "2a5a89e6-0452-4643-af64-c17f7881e7e5", nome: "Isadora Fernandes",  funcao: "Backing Vocal", obs: null },
  { id: null,                                   nome: "Tudes",              funcao: "Backing Vocal", obs: null },
  { id: "af737764-2a81-4f89-8153-672571c5df16", nome: "Ricardo Bortot",     funcao: "Bateria",       obs: "Cajón" },
];
// Equipe 2
const E2 = [
  { id: "4c646c5d-cf1a-401f-a8bf-5bc9af996cdf", nome: "Matheus Alves",     funcao: "Ministro",      obs: null },
  { id: "4d729cce-d0a0-42b1-9d09-62d3cd4b7b87", nome: "Lívia Martins",     funcao: "Backing Vocal", obs: null },
  { id: null,                                   nome: "Edeni",             funcao: "Backing Vocal", obs: null },
  { id: null,                                   nome: "Victor",            funcao: "Bateria",       obs: "Cajón" },
  { id: "ad69a900-1be0-41fa-943b-20c30a5bfb3c", nome: "Thaíná Victoria",   funcao: "Backing Vocal", obs: null },
];
// Equipe 3
const E3 = [
  { id: "253ebd74-151a-405b-ba2a-87e64107ab59", nome: "Matheus Lopes",     funcao: "Ministro",      obs: null },
  { id: "01c938ee-69b0-430b-9fe3-cd6632d70982", nome: "Luisa Lopes",       funcao: "Backing Vocal", obs: null },
  { id: "d153862e-bdc6-4769-8bbd-4814b10b3846", nome: "Melissa Vaz",       funcao: "Backing Vocal", obs: null },
  { id: "c9db7bdf-0d50-4698-8728-d45b91e09c63", nome: "Larissa Pedro",     funcao: "Bateria",       obs: "Cajón" },
];

const ESCALAS = [
  { data: "2026-05-07", horario: "20:00", culto: "Culto de Quinta",  obs: "Equipe 2", membros: E2 },
  { data: "2026-05-10", horario: "18:30", culto: "Culto de Domingo", obs: "Equipe 3", membros: E3 },
  { data: "2026-05-14", horario: "20:00", culto: "Culto de Quinta",  obs: "Equipe 1", membros: E1 },
  { data: "2026-05-17", horario: "18:30", culto: "Culto de Domingo", obs: "Equipe 2", membros: E2 },
  { data: "2026-05-21", horario: "20:00", culto: "Culto de Quinta",  obs: "Equipe 3", membros: E3 },
  { data: "2026-05-24", horario: "18:30", culto: "Culto de Domingo", obs: "Equipe 1", membros: E1 },
  { data: "2026-05-28", horario: "20:00", culto: "Culto de Quinta",  obs: "Equipe 2", membros: E2 },
  { data: "2026-05-31", horario: "18:30", culto: "Culto de Domingo", obs: "Equipe 3", membros: E3 },
];

(async () => {
  for (const esc of ESCALAS) {
    // 1. Criar a escala
    const r1 = await req("POST", "/rest/v1/escalas", [{
      ministerio: "Louvor",
      data: esc.data,
      horario: esc.horario,
      culto: esc.culto,
      observacoes: esc.obs,
      visivel: true,
      confirmacao_participantes: false,
    }]);
    if (r1.status !== 201) {
      console.error(`ERRO escala ${esc.data}:`, r1.body);
      continue;
    }
    const escalaId = JSON.parse(r1.body)[0].id;
    console.log(`✓ Escala ${esc.data} (${esc.obs}): ${escalaId}`);

    // 2. Inserir itens
    const itens = esc.membros.map((m) => ({
      escala_id: escalaId,
      funcao: m.funcao,
      voluntario_id: m.id || null,
      voluntario_nome: m.nome,
      observacao: m.obs || null,
    }));
    const r2 = await req("POST", "/rest/v1/escala_itens", itens);
    if (r2.status !== 201) {
      console.error(`  ERRO itens:`, r2.body);
    } else {
      console.log(`  ✓ ${itens.length} participantes inseridos`);
    }
  }
  console.log("\nConcluído!");
})();
