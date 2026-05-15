const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = "ramo123";

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function primeiroNome(nome) {
  return normalizarTexto(nome).split(" ")[0] || "usuario";
}

function emailPadrao(nome) {
  return `${primeiroNome(nome)}@ramodavida.com`;
}

async function obterPessoasRecepcionamento() {
  const { data: escalas, error: erroEscalas } = await admin
    .from("escalas")
    .select("id")
    .eq("ministerio", "Cantina");

  if (erroEscalas) throw erroEscalas;

  const escalaIds = (escalas || []).map((e) => e.id);
  if (escalaIds.length === 0) return [];

  const { data: itens, error: erroItens } = await admin
    .from("escala_itens")
    .select("voluntario_nome")
    .in("escala_id", escalaIds);

  if (erroItens) throw erroItens;

  const nomes = new Map();
  for (const item of itens || []) {
    const nomeOriginal = String(item.voluntario_nome || "").trim();
    if (!nomeOriginal) continue;
    const chave = normalizarTexto(nomeOriginal);
    if (!chave) continue;
    if (!nomes.has(chave)) {
      nomes.set(chave, { nome: nomeOriginal, email: null });
    }
  }

  return [...nomes.values()];
}

async function main() {
  const PESSOAS = await obterPessoasRecepcionamento();
  if (PESSOAS.length === 0) {
    console.log("Nenhuma pessoa encontrada nas escalas de Recepcionamento (Cantina).");
    return;
  }

  const { data: perfis, error } = await admin.from("perfis").select("id, nome, email, ministerios, primeiro_acesso");
  if (error) throw error;

  for (const pessoa of PESSOAS) {
    const nomeBusca = normalizarTexto(pessoa.nome);
    let perfil = perfis.find((p) => normalizarTexto(p.nome) === nomeBusca);

    if (!perfil && pessoa.email) {
      perfil = perfis.find((p) => p.email && p.email.toLowerCase() === pessoa.email.toLowerCase());
    }

    let email = pessoa.email || emailPadrao(pessoa.nome);
    if (!perfil) {
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { nome: pessoa.nome },
      });
      if (authErr || !authData.user) {
        console.error(`Erro ao criar usuário ${pessoa.nome}:`, authErr?.message);
        continue;
      }
      const novoId = authData.user.id;
      await admin.from("perfis").upsert({
        id: novoId,
        nome: pessoa.nome,
        email,
        ministerios: ["Cantina"],
        role: "membro",
        ativo: true,
        primeiro_acesso: true,
      });
      console.log(`Criado: ${pessoa.nome} (${email})`);
      continue;
    }

    const emailCorrigido = emailPadrao(pessoa.nome);

    if (perfil.email !== emailCorrigido) {
      const { error: authUpdateErr } = await admin.auth.admin.updateUserById(perfil.id, {
        email: emailCorrigido,
        email_confirm: true,
      });

      if (authUpdateErr) {
        console.error(`Erro ao atualizar email de login para ${pessoa.nome}:`, authUpdateErr.message);
      }
    }

    const mins = new Set(perfil.ministerios || []);
    mins.add("Cantina");
    await admin.from("perfis").update({
      ministerios: [...mins],
      email: emailCorrigido,
      primeiro_acesso: true,
    }).eq("id", perfil.id);
    console.log(`Atualizado: ${pessoa.nome} (${emailCorrigido})`);
  }
}

main().catch((err) => {
  console.error("Erro ao sincronizar recepcionamento:", err.message ?? err);
  process.exit(1);
});
