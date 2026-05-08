"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Church,
  User,
  Mail,
  Phone,
  Calendar,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
} from "lucide-react";
import clsx from "clsx";

export default function MembroPortalPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const { atualizarUsuario } = useAuth();

  const [novaSenha, setNovaSenha]         = useState("");
  const [showSenha, setShowSenha]         = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha]         = useState("");
  const [okSenha, setOkSenha]             = useState(false);

  const [editandoNome, setEditandoNome]   = useState(false);
  const [novoNome, setNovoNome]           = useState("");
  const [salvandoNome, setSalvandoNome]   = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
    if (!isLoading && user && user.role !== "membro") router.push("/dashboard");
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-vine-950">
        <div className="w-8 h-8 border-4 border-vine-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function trocarSenha() {
    if (!user) return;
    if (novaSenha.length < 6) { setErroSenha("Mínimo 6 caracteres."); return; }
    setErroSenha(""); setSalvandoSenha(true); setOkSenha(false);
    const res = await fetch("/api/alterar-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, novaSenha }),
    });
    const json = await res.json().catch(() => ({}));
    setSalvandoSenha(false);
    if (res.ok) { setOkSenha(true); setNovaSenha(""); setTimeout(() => setOkSenha(false), 3000); }
    else setErroSenha(json.error ?? "Erro ao alterar senha.");
  }

  async function salvarNome() {
    if (!user || !novoNome.trim()) return;
    setSalvandoNome(true);
    await atualizarUsuario(user.id, { nome: novoNome.trim() });
    setSalvandoNome(false);
    setEditandoNome(false);
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const iniciais = user.nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-vine-950 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Church className="w-6 h-6 text-gold-400" />
          <span className="font-bold text-lg">Ramo da Vida</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-vine-300 hover:text-white transition"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 space-y-6">

        {/* Avatar + boas-vindas */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-20 h-20 bg-vine-700 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {iniciais}
          </div>
          <div className="flex flex-col items-center gap-1">
            {editandoNome ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") salvarNome(); if (e.key === "Escape") setEditandoNome(false); }}
                  className="border border-vine-400 rounded-xl px-3 py-1.5 text-base font-bold text-gray-900 outline-none focus:ring-1 focus:ring-vine-300"
                />
                <button onClick={salvarNome} disabled={salvandoNome} className="w-7 h-7 bg-vine-700 rounded-full flex items-center justify-center text-white hover:bg-vine-800 transition"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditandoNome(false)} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{user.nome}</h1>
                <button onClick={() => { setNovoNome(user.nome); setEditandoNome(true); }} className="text-gray-400 hover:text-vine-600 transition" title="Editar nome">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-gray-400">Bem-vindo(a) ao portal de membros</p>
          </div>
        </div>

        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Seus dados</p>
          </div>
          <div className="divide-y divide-gray-50">
            <InfoRow icon={<Mail className="w-4 h-4 text-vine-600" />} label="E-mail" value={user.email} />
            {user.telefone && (
              <InfoRow icon={<Phone className="w-4 h-4 text-vine-600" />} label="Telefone" value={user.telefone} />
            )}
            <InfoRow
              icon={<Calendar className="w-4 h-4 text-vine-600" />}
              label="Membro desde"
              value={new Date(user.dataIngresso + "T00:00:00").toLocaleDateString("pt-BR", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            />
          </div>
        </div>

        {/* Trocar senha */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Trocar senha</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="relative">
              <input
                type={showSenha ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => { setNovaSenha(e.target.value); setErroSenha(""); setOkSenha(false); }}
                placeholder="Nova senha (mín. 6 caracteres)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400 focus:ring-1 focus:ring-vine-100 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {erroSenha && <p className="text-xs text-red-500">{erroSenha}</p>}
            <button
              onClick={trocarSenha}
              disabled={salvandoSenha || !novaSenha}
              className={clsx(
                "w-full py-2.5 rounded-xl text-sm font-semibold border transition",
                okSenha
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-vine-700 text-white border-vine-700 hover:bg-vine-800 disabled:opacity-50"
              )}
            >
              {salvandoSenha ? "Salvando..." : okSenha ? "Senha alterada!" : "Salvar nova senha"}
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
