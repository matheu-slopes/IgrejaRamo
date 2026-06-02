import { supabase } from "@/lib/supabase";

type NotificarInAppOpts = {
  usuarioIds?: string[];
  todos?: boolean;
  roles?: string[];
  ministerios?: string[];
  titulo: string;
  corpo: string;
  tipo: "aviso" | "escala" | "evento" | "ministerio" | "sistema";
  link?: string;
  ministerio?: string;
  excluirUsuarioId?: string;
};

async function getFreshToken(forceRefresh = false): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "";
  const expiresAt = session.expires_at ?? 0;
  if (forceRefresh || Date.now() / 1000 > expiresAt - 60) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? "";
  }
  return session.access_token;
}

export async function notificarInApp(opts: NotificarInAppOpts) {
  try {
    let token = await getFreshToken();
    if (!token) return { ok: false, error: "Sem sessao" };

    let res = await fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(opts),
    });

    if (res.status === 401) {
      token = await getFreshToken(true);
      res = await fetch("/api/notificacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(opts),
      });
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error ?? res.statusText };
    return { ok: true, inserted: json.inserted ?? 0 };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
