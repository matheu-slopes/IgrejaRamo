import { NextRequest, NextResponse } from "next/server";
import { forbidden, securityAuth } from "@/lib/securityAuth";
import { acessoMinisterio } from "@/lib/ministerioAcesso";

export async function PATCH(req: NextRequest) {
  const auth = await securityAuth(req);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.ministerio !== "string" || typeof body.bloqueado !== "boolean") return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    const acesso = await acessoMinisterio(auth.admin, auth.user.id, body.ministerio);
    if (!acesso.lider) return forbidden();
    const { data, error } = await auth.admin.from("canais_ministerio").update({ chat_bloqueado: body.bloqueado }).eq("ministerio", body.ministerio).select("chat_bloqueado").single();
    if (error) return NextResponse.json({ error: "Não foi possível atualizar o chat." }, { status: 500 });
    return NextResponse.json({ bloqueado: data.chat_bloqueado });
  } catch { return NextResponse.json({ error: "Não foi possível verificar a liderança." }, { status: 500 }); }
}
