import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qvqffkoipibgiimrlfpl.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4";
const SENHA_PADRAO = "ramo123";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Busca todos os usuários da tabela perfis
const { data: perfis, error } = await admin.from("perfis").select("id, nome, email");
if (error) { console.error("Erro ao buscar perfis:", error.message); process.exit(1); }

console.log(`Encontrados ${perfis.length} usuários. Resetando senhas para "${SENHA_PADRAO}"...\n`);

for (const p of perfis) {
  const { error: err } = await admin.auth.admin.updateUserById(p.id, { password: SENHA_PADRAO });
  if (err) {
    console.error(`  ✗ ${p.nome} (${p.email}): ${err.message}`);
  } else {
    console.log(`  ✓ ${p.nome} (${p.email})`);
  }
}

// Marca todos como primeiro_acesso = true
const { error: errUpdate } = await admin.from("perfis").update({ primeiro_acesso: true }).neq("id", "00000000-0000-0000-0000-000000000000");
if (errUpdate) {
  console.warn("\nAviso: não foi possível marcar primeiro_acesso (coluna pode não existir ainda):", errUpdate.message);
} else {
  console.log("\nTodos marcados como primeiro_acesso = true.");
}

console.log("\nPronto!");
