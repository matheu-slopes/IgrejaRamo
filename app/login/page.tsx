"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const ok = await login(email, password);
      if (ok) {
        router.push("/dashboard");
      } else {
        setError("E-mail ou senha incorretos. Verifique e tente novamente.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vine-500 bg-gray-50 placeholder:text-gray-400";

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Igreja Ramo da Vida"
              width={160}
              height={54}
              priority
              className="w-[160px] h-auto mx-auto"
            />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-vine-100 overflow-hidden">
          <div className="px-7 pt-6 pb-1">
            <h1 className="text-lg font-bold text-gray-800">Entrar</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Acesse com as credenciais fornecidas pelo administrador.
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-7 pt-5 flex flex-col gap-4">
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
              disabled={loading}
              className="bg-vine-700 text-white py-2.5 rounded-xl font-semibold hover:bg-vine-800 transition mt-1 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/" className="hover:text-vine-600 transition">
            ← Voltar ao site
          </Link>
        </p>
      </div>
    </main>
  );
}


