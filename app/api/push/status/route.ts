import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/push/status
 * Diagnóstico: verifica configuração VAPID e subscriptions do usuário.
 * Requer usuário autenticado.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  const runtimePublicKey = (process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)?.trim();

  const diagnostico: Record<string, unknown> = {
    vapid_public_key_set: !!process.env.VAPID_PUBLIC_KEY,
    vapid_private_key_set: !!process.env.VAPID_PRIVATE_KEY,
    next_public_vapid_key_set: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    runtime_vapid_public_key_set: !!runtimePublicKey,
    vapid_subject: (process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || "https://igreja-ramo.vercel.app").trim(),
    service_role_key_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  if (!token) {
    return NextResponse.json({ ...diagnostico, autenticado: false, subscriptions: [] });
  }

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ ...diagnostico, autenticado: false, erro_auth: authErr?.message });
  }

  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, criado_em")
    .eq("user_id", user.id);

  const { count } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });

  const hosts = Array.from(
    new Set(
      (subs ?? [])
        .map((s: { endpoint: string }) => {
          try {
            return new URL(s.endpoint).host;
          } catch {
            return "endpoint_invalido";
          }
        })
        .filter(Boolean)
    )
  );

  return NextResponse.json({
    ...diagnostico,
    autenticado: true,
    user_id: user.id,
    suas_subscriptions: subs ?? [],
    suas_subscriptions_count: subs?.length ?? 0,
    suas_subscriptions_hosts: hosts,
    total_subscriptions_sistema: count ?? 0,
    erro_subs: subsErr?.message ?? null,
  });
}
