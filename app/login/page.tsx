"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

type Tab = "entrar" | "cadastrar";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("entrar");

  // Login state
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");

  // Register state (mock — sem backend ainda)
  const [regNome, setRegNome]           = useState("");
  const [regEmail, setRegEmail]         = useState("");
  const [regPass, setRegPass]           = useState("");
  const [regConfirm, setRegConfirm]     = useState("");
  const [regSuccess, setRegSuccess]     = useState(false);
  const [regError, setRegError]         = useState("");

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    const ok = login(email, password);
    if (ok) {
      router.push("/dashboard");
    } else {
      setError("E-mail não encontrado. Verifique e tente novamente.");
    }
  }

  function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegError("");
    if (regPass !== regConfirm) {
      setRegError("As senhas não coincidem.");
      return;
    }
    // TODO (Supabase): supabase.auth.signUp({ email: regEmail, password: regPass, options: { data: { nome: regNome } } })
    setRegSuccess(true);
  }

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vine-500 bg-gray-50 placeholder:text-gray-400";

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-2 group">
            <div className="bg-vine-950 rounded-2xl px-6 py-4">
              <Image
                src="/logo.png"
                alt="Igreja Ramo da Vida"
                width={160}
                height={54}
                priority
                className="w-[140px] h-auto"
                style={{ filter: "invert(1)", mixBlendMode: "screen" }}
              />
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-vine-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(["entrar", "cadastrar"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); setRegError(""); setRegSuccess(false); }}
                className={[
                  "flex-1 py-3.5 text-sm font-semibold transition capitalize",
                  tab === t
                    ? "text-vine-700 border-b-2 border-vine-600 bg-vine-50"
                    : "text-gray-400 hover:text-gray-600",
                ].join(" ")}
              >
                {t === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <div className="p-7">
            {/* ── LOGIN ── */}
            {tab === "entrar" && (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputCls + " pr-10"}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="bg-vine-700 text-white py-2.5 rounded-xl font-semibold hover:bg-vine-800 transition mt-1"
                >
                  Entrar
                </button>

                <p className="text-center text-xs text-gray-400 mt-1">
                  Não tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("cadastrar")}
                    className="text-vine-600 font-semibold hover:underline"
                  >
                    Cadastre-se
                  </button>
                </p>
              </form>
            )}

            {/* ── CADASTRO ── */}
            {tab === "cadastrar" && (
              <>
                {regSuccess ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="text-4xl">🌿</div>
                    <p className="font-bold text-vine-800 text-lg">Cadastro enviado!</p>
                    <p className="text-sm text-gray-500">
                      Seu pedido foi recebido. Em breve um líder irá aprovar seu acesso.
                    </p>
                    <button
                      onClick={() => { setRegSuccess(false); setTab("entrar"); }}
                      className="mt-2 text-vine-600 text-sm font-semibold hover:underline"
                    >
                      Voltar para o login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Nome completo
                      </label>
                      <input
                        type="text"
                        required
                        value={regNome}
                        onChange={(e) => setRegNome(e.target.value)}
                        placeholder="Seu nome"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        E-mail
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Senha
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Confirmar senha
                      </label>
                      <input
                        type="password"
                        required
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        placeholder="Repita a senha"
                        className={inputCls}
                      />
                    </div>

                    {regError && (
                      <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 text-center">
                        {regError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="bg-vine-700 text-white py-2.5 rounded-xl font-semibold hover:bg-vine-800 transition mt-1"
                    >
                      Criar conta
                    </button>

                    <p className="text-center text-xs text-gray-400">
                      Já tem conta?{" "}
                      <button
                        type="button"
                        onClick={() => setTab("entrar")}
                        className="text-vine-600 font-semibold hover:underline"
                      >
                        Entrar
                      </button>
                    </p>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/" className="hover:text-vine-600 transition">
            ← Voltar ao site
          </Link>
        </p>

        {/* ── Credenciais de teste ──────────────────────────────── */}
        <DevCredentials />
      </div>
    </main>
  );
}

/** Caixa colapsável com logins de teste — remover em produção */
function DevCredentials() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-amber-900 text-xs overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between font-semibold hover:bg-amber-100 transition"
      >
        <span>🌿 Logins de teste (dev)</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-amber-200">
          <p className="text-amber-700 mb-2">
            Qualquer senha serve. Use um dos e-mails abaixo:
          </p>
          {[
            { role: "Pastor",     email: "pastor@ramo.church"   },
            { role: "Admin",      email: "admin@ramo.church"    },
            { role: "Líder",      email: "pedro@ramo.church"    },
            { role: "Voluntário", email: "ana@ramo.church"      },
            { role: "Membro",     email: "lucas@ramo.church"    },
          ].map(({ role, email }) => (
            <div key={email} className="flex items-center justify-between gap-3 py-1.5 border-b border-amber-100 last:border-0">
              <span className="font-semibold text-amber-800 w-20 shrink-0">{role}</span>
              <code className="text-[11px] text-amber-700 break-all">{email}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
