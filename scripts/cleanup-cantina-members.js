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

async function main() {
  const { data, error } = await admin
    .from("perfis")
    .select("id, nome, ministerios, lider_ministerios");

  if (error) throw error;

  let atualizados = 0;
  for (const perfil of data ?? []) {
    const ministeriosAtuais = perfil.ministerios ?? [];
    const liderAtuais = perfil.lider_ministerios ?? [];

    const ministerios = ministeriosAtuais.filter((m) => m !== "Cantina");
    const liderMinisterios = liderAtuais.filter((m) => m !== "Cantina");

    const mudouMinisterios = ministerios.length !== ministeriosAtuais.length;
    const mudouLider = liderMinisterios.length !== liderAtuais.length;

    if (!mudouMinisterios && !mudouLider) continue;

    const { error: updateError } = await admin
      .from("perfis")
      .update({ ministerios, lider_ministerios: liderMinisterios })
      .eq("id", perfil.id);

    if (updateError) throw updateError;

    atualizados += 1;
    console.log(`Atualizado: ${perfil.nome}`);
  }

  console.log(`Total atualizados: ${atualizados}`);
}

main().catch((err) => {
  console.error("Erro ao limpar Cantina:", err.message ?? err);
  process.exit(1);
});
