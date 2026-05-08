import { createClient } from "@supabase/supabase-js";

const URL = "https://qvqffkoipibgiimrlfpl.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4";
const SENHA = "ramo123";

const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: perfis } = await sb.from("perfis").select("id, nome, email");
console.log(`${perfis.length} usuarios encontrados\n`);

let ok = 0, fail = 0;
for (const p of perfis) {
  const { error } = await sb.auth.admin.updateUserById(p.id, { password: SENHA });
  if (error) { console.log(`ERRO  ${p.nome}: ${error.message}`); fail++; }
  else { console.log(`OK    ${p.nome}`); ok++; }
}
console.log(`\n${ok} resetados, ${fail} erros`);
