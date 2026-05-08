import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qvqffkoipibgiimrlfpl.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Adiciona a coluna primeiro_acesso via SQL
const { error: sqlErr } = await admin.rpc("exec_sql", {
  sql: "ALTER TABLE perfis ADD COLUMN IF NOT EXISTS primeiro_acesso boolean DEFAULT true;"
}).catch(() => ({ error: null }));

// Se rpc exec_sql não existir, tenta via REST direto
const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ sql: "ALTER TABLE perfis ADD COLUMN IF NOT EXISTS primeiro_acesso boolean DEFAULT true;" }),
});

if (!res.ok) {
  console.log("rpc exec_sql não disponível, tentando outro método...");
}

// Marca todos como primeiro_acesso = true diretamente
const { error: updateErr } = await admin
  .from("perfis")
  .update({ primeiro_acesso: true })
  .not("id", "is", null);

if (updateErr) {
  console.error("Erro ao marcar primeiro_acesso:", updateErr.message);
  console.log("\nVocê precisa rodar este SQL no Supabase SQL Editor:");
  console.log("ALTER TABLE perfis ADD COLUMN IF NOT EXISTS primeiro_acesso boolean DEFAULT true;");
  console.log("UPDATE perfis SET primeiro_acesso = true;");
} else {
  console.log("Todos marcados como primeiro_acesso = true!");
}
