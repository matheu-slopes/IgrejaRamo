import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processChatNotificationJobs } from "@/lib/chatNotifications";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAuthorized(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return false;
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  const { data: { user } } = await admin.auth.getUser(token);
  return Boolean(user);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { limit?: number };
  const limit = Math.min(Math.max(Number(body.limit ?? 25), 1), 100);
  const result = await processChatNotificationJobs(limit);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50), 1), 100);
  const result = await processChatNotificationJobs(limit);
  return NextResponse.json({ ok: true, ...result });
}