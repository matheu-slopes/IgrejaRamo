const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltam variaveis de ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function main() {
  const { data: perfis, error: perfisErr } = await admin
    .from("perfis")
    .select("id,nome,email,ministerios,ativo")
    .order("nome", { ascending: true });
  if (perfisErr) throw perfisErr;

  const { data: escalas, error: escalasErr } = await admin
    .from("escalas")
    .select("id,ministerio,data,culto")
    .order("data", { ascending: true });
  if (escalasErr) throw escalasErr;

  const escalaIds = (escalas || []).map((e) => e.id);

  let itens = [];
  if (escalaIds.length > 0) {
    const { data: itensData, error: itensErr } = await admin
      .from("escala_itens")
      .select("escala_id,voluntario_id,voluntario_nome,funcao,observacao")
      .in("escala_id", escalaIds);
    if (itensErr) throw itensErr;
    itens = itensData || [];
  }

  const escalaPorId = new Map((escalas || []).map((e) => [e.id, e]));
  const perfilPorId = new Map((perfis || []).map((p) => [p.id, p]));

  const perfisPorNomeNorm = new Map();
  for (const p of perfis || []) {
    const n = normalize(p.nome);
    if (!n) continue;
    if (!perfisPorNomeNorm.has(n)) perfisPorNomeNorm.set(n, []);
    perfisPorNomeNorm.get(n).push(p);
  }

  const itensSemPerfilPorId = [];
  const itensComNomeSemPerfil = [];
  const itensComIdNomeInconsistente = [];
  const itensComIdSemMinisterioNoPerfil = [];

  for (const it of itens) {
    const escala = escalaPorId.get(it.escala_id);
    const ministerioEscala = escala?.ministerio || null;

    if (it.voluntario_id) {
      const perfil = perfilPorId.get(it.voluntario_id);
      if (!perfil) {
        itensSemPerfilPorId.push({
          escala_id: it.escala_id,
          data: escala?.data || null,
          ministerio: ministerioEscala,
          culto: escala?.culto || null,
          voluntario_id: it.voluntario_id,
          voluntario_nome: it.voluntario_nome || null,
          funcao: it.funcao,
          observacao: it.observacao || null,
        });
        continue;
      }

      if (it.voluntario_nome && normalize(it.voluntario_nome) && normalize(it.voluntario_nome) !== normalize(perfil.nome)) {
        itensComIdNomeInconsistente.push({
          escala_id: it.escala_id,
          data: escala?.data || null,
          ministerio: ministerioEscala,
          culto: escala?.culto || null,
          voluntario_id: it.voluntario_id,
          nome_no_item: it.voluntario_nome,
          nome_no_perfil: perfil.nome,
          funcao: it.funcao,
        });
      }

      const mins = Array.isArray(perfil.ministerios) ? perfil.ministerios : [];
      if (ministerioEscala && !mins.includes(ministerioEscala)) {
        itensComIdSemMinisterioNoPerfil.push({
          escala_id: it.escala_id,
          data: escala?.data || null,
          ministerio: ministerioEscala,
          culto: escala?.culto || null,
          perfil_id: perfil.id,
          perfil_nome: perfil.nome,
          perfil_email: perfil.email,
          perfil_ministerios: mins,
          funcao: it.funcao,
        });
      }

      continue;
    }

    const nomeItem = String(it.voluntario_nome || "").trim();
    if (!nomeItem) continue;

    const candidatos = perfisPorNomeNorm.get(normalize(nomeItem)) || [];
    if (candidatos.length === 0) {
      itensComNomeSemPerfil.push({
        escala_id: it.escala_id,
        data: escala?.data || null,
        ministerio: ministerioEscala,
        culto: escala?.culto || null,
        voluntario_nome: nomeItem,
        funcao: it.funcao,
        observacao: it.observacao || null,
      });
    }
  }

  const pessoasEmEscalaPorNome = new Set();
  const pessoasEmEscalaPorId = new Set();

  for (const it of itens) {
    if (it.voluntario_id) {
      pessoasEmEscalaPorId.add(it.voluntario_id);
      const perfil = perfilPorId.get(it.voluntario_id);
      if (perfil?.nome) pessoasEmEscalaPorNome.add(normalize(perfil.nome));
      else if (it.voluntario_nome) pessoasEmEscalaPorNome.add(normalize(it.voluntario_nome));
    } else if (it.voluntario_nome) {
      pessoasEmEscalaPorNome.add(normalize(it.voluntario_nome));
    }
  }

  const perfisSemEscala = (perfis || [])
    .filter((p) => !pessoasEmEscalaPorId.has(p.id) && !pessoasEmEscalaPorNome.has(normalize(p.nome)))
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      ativo: p.ativo,
      ministerios: p.ministerios || [],
    }));

  const nomesDuplicadosEmPerfis = [];
  for (const [nomeNorm, arr] of perfisPorNomeNorm.entries()) {
    if (arr.length > 1) {
      nomesDuplicadosEmPerfis.push({
        nome_normalizado: nomeNorm,
        perfis: arr.map((p) => ({ id: p.id, nome: p.nome, email: p.email, ativo: p.ativo })),
      });
    }
  }

  const nomeSemPerfilUnico = uniqueBy(itensComNomeSemPerfil, (x) => `${normalize(x.voluntario_nome)}|${x.ministerio || ""}`);

  const relatorio = {
    resumo: {
      total_perfis: (perfis || []).length,
      total_escalas: (escalas || []).length,
      total_itens_escala: itens.length,
      itens_sem_perfil_por_id: itensSemPerfilPorId.length,
      itens_com_nome_sem_perfil: itensComNomeSemPerfil.length,
      itens_com_id_nome_inconsistente: itensComIdNomeInconsistente.length,
      itens_com_id_sem_ministerio_no_perfil: itensComIdSemMinisterioNoPerfil.length,
      perfis_sem_escala: perfisSemEscala.length,
      nomes_duplicados_em_perfis: nomesDuplicadosEmPerfis.length,
    },
    itens_sem_perfil_por_id: uniqueBy(itensSemPerfilPorId, (x) => `${x.escala_id}|${x.voluntario_id}|${x.funcao}`),
    itens_com_nome_sem_perfil: nomeSemPerfilUnico,
    itens_com_id_nome_inconsistente: uniqueBy(itensComIdNomeInconsistente, (x) => `${x.escala_id}|${x.voluntario_id}|${x.funcao}|${normalize(x.nome_no_item)}`),
    itens_com_id_sem_ministerio_no_perfil: uniqueBy(itensComIdSemMinisterioNoPerfil, (x) => `${x.escala_id}|${x.perfil_id}|${x.funcao}`),
    perfis_sem_escala: perfisSemEscala,
    nomes_duplicados_em_perfis: nomesDuplicadosEmPerfis,
  };

  console.log(JSON.stringify(relatorio, null, 2));
}

main().catch((err) => {
  console.error("Erro na auditoria:", err.message || err);
  process.exit(1);
});
