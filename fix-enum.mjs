import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://qvqffkoipibgiimrlfpl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Use the Supabase Management API to run SQL
// The service role key allows running raw SQL via /rest/v1/rpc if we have a helper function
// Or we can use the pg endpoint directly

const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWZma29pcGliZ2lpbXJsZnBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NTQ4OCwiZXhwIjoyMDkzNjcxNDg4fQ.VhCe3Ttwymzv6J-cPJejq_xTZ_N8RxXGl1KK0w-RwI4';
const PROJECT_REF = 'qvqffkoipibgiimrlfpl';

const sqls = [
  "ALTER TYPE funcao_escala ADD VALUE IF NOT EXISTS 'Voluntário'",
  "ALTER TYPE funcao_escala ADD VALUE IF NOT EXISTS 'Câmera'",
  "ALTER TYPE funcao_escala ADD VALUE IF NOT EXISTS 'Recepção'",
  "ALTER TYPE funcao_escala ADD VALUE IF NOT EXISTS 'Auxiliar'",
  "ALTER TYPE funcao_escala ADD VALUE IF NOT EXISTS 'Líder'",
  "ALTER TYPE funcao_escala ADD VALUE IF NOT EXISTS 'Coordenação'",
];

// Try using the Supabase Management API
for (const sql of sqls) {
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    console.log(`[${res.status}] ${sql.slice(0, 50)} -> ${text.slice(0, 100)}`);
  } catch (e) {
    console.log(`ERROR: ${sql.slice(0, 50)} -> ${e.message}`);
  }
}
