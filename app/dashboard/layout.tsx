"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ChatUnreadProvider } from "@/contexts/ChatUnreadContext";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/dashboard/BottomNav";
import NotificationBell from "@/components/dashboard/NotificationBell";
import PushSubscriber from "@/components/PushSubscriber";
import Image from "next/image";
import { User, Permissao } from "@/types";
import {
  LogOut, Pencil, Check, X, Camera, ChevronRight, User as UserIcon,
  Mail, Phone, Calendar, Layers, Shield, Settings, HelpCircle,
  KeyRound, Eye, EyeOff,
} from "lucide-react";
import clsx from "clsx";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", pastor: "Pastor", lider: "Líder",
  voluntario: "Voluntário", membro: "Membro",
};
const ROLE_COR: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  pastor: "bg-purple-100 text-purple-700",
  lider: "bg-gold-100 text-gold-800",
  voluntario: "bg-gray-100 text-gray-700",
  membro: "bg-gray-100 text-gray-600",
};

function ProfileDropdown({
  user, onLogout, onUpdate,
}: {
  user: User;
  onLogout: () => void;
  onUpdate: (dados: Partial<User>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "perfil" | "dados" | "senha">("menu");
  const [editingName, setEditingName] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState("");
  const [okSenha, setOkSenha] = useState(false);
  const [newName, setNewName] = useState(user.nome);
  const photoRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function close() { setOpen(false); setView("menu"); setEditingName(false); setNovaSenha(""); setErroSenha(""); setOkSenha(false); }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpdate({ foto: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function saveName() {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== user.nome) onUpdate({ nome: trimmed });
    setEditingName(false);
    setNewName(trimmed || user.nome);
  }

  const initials = user.nome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const Avatar = ({ size = "sm" }: { size?: "sm" | "lg" }) => {
    const cls = size === "lg"
      ? "w-16 h-16 text-2xl ring-4 ring-white/20"
      : "w-8 h-8 text-sm ring-2 ring-[#0a0a0a] ring-offset-1";
    return user.foto
      ? <img src={user.foto} alt={user.nome} className={clsx("rounded-full object-cover", cls)} />
      : <div className={clsx("rounded-full bg-[#0a0a0a] flex items-center justify-center text-white font-bold", cls)}>{initials}</div>;
  };

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); setView("menu"); }} className="focus:outline-none" title="Perfil">
        <Avatar />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute right-0 top-11 z-40 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

            {/* ─── VIEW: MENU PRINCIPAL ─── */}
            {view === "menu" && (
              <>
                {/* Cabeçalho */}
                <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100">
                  <div className="relative shrink-0">
                    <Avatar size="sm" />
                    <button
                      onClick={() => photoRef.current?.click()}
                      className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#1a1a1a] rounded-full flex items-center justify-center shadow hover:bg-gray-600 transition"
                      title="Trocar foto"
                    >
                      <Camera className="w-2.5 h-2.5 text-white" />
                    </button>
                    <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.nome.split(" ").slice(0, 2).join(" ")}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <span className={clsx("shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full", ROLE_COR[user.role])}>
                    {ROLE_LABEL[user.role]}
                  </span>
                </div>

                {/* Grupo 1 — Conta */}
                <div className="py-1">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Conta</p>
                  {[
                    { icon: UserIcon, label: "Meu perfil",       action: () => setView("perfil") },
                    { icon: Layers,   label: "Meus ministérios", action: () => setView("dados")  },
                    { icon: KeyRound, label: "Trocar senha",      action: () => setView("senha")  },
                  ].map(({ icon: Icon, label, action }) => (
                    <button key={label} onClick={action}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                    >
                      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                      {label}
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-100" />

                {/* Grupo 2 — Sistema */}
                <div className="py-1">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sistema</p>
                  {[
                    { icon: Settings,     label: "Configurações",   action: () => {} },
                    { icon: HelpCircle,   label: "Ajuda & suporte", action: () => {} },
                  ].map(({ icon: Icon, label, action }) => (
                    <button key={label} onClick={action}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                    >
                      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-100" />

                {/* Sair */}
                <div className="py-1">
                  <button
                    onClick={() => { close(); onLogout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition text-left"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    Sair da conta
                  </button>
                </div>
              </>
            )}

            {/* ─── VIEW: TROCAR SENHA ─── */}
            {view === "senha" && (
              <>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <button onClick={() => { setView("menu"); setNovaSenha(""); setErroSenha(""); setOkSenha(false); }} className="text-gray-400 hover:text-gray-600 transition">
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </button>
                  <p className="text-sm font-semibold text-gray-800">Trocar senha</p>
                </div>
                <div className="px-4 py-4 space-y-3">
                  <div className="relative">
                    <input
                      type={showSenha ? "text" : "password"}
                      value={novaSenha}
                      onChange={(e) => { setNovaSenha(e.target.value); setErroSenha(""); setOkSenha(false); }}
                      placeholder="Nova senha (mín. 6 caracteres)"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100 pr-10"
                    />
                    <button type="button" onClick={() => setShowSenha((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {erroSenha && <p className="text-xs text-red-500">{erroSenha}</p>}
                  <button
                    disabled={salvandoSenha || !novaSenha}
                    onClick={async () => {
                      if (novaSenha.length < 6) { setErroSenha("Mínimo 6 caracteres."); return; }
                      setSalvandoSenha(true); setErroSenha("");
                      const res = await fetch("/api/alterar-senha", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: user.id, novaSenha }),
                      });
                      const json = await res.json().catch(() => ({}));
                      setSalvandoSenha(false);
                      if (res.ok) { setOkSenha(true); setNovaSenha(""); }
                      else setErroSenha(json.error ?? "Erro ao alterar senha.");
                    }}
                    className={okSenha ? "w-full py-2.5 rounded-xl text-sm font-semibold border bg-green-50 text-green-700 border-green-200" : "w-full py-2.5 rounded-xl text-sm font-semibold border bg-[#0a0a0a] text-white border-gray-800 hover:bg-[#111] disabled:opacity-50"}
                  >
                    {salvandoSenha ? "Salvando..." : okSenha ? "Senha alterada!" : "Salvar nova senha"}
                  </button>
                </div>
              </>
            )}

            {/* ─── VIEW: MEU PERFIL ─── */}
            {view === "perfil" && (
              <>
                {/* Sub-header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <button onClick={() => setView("menu")} className="text-gray-400 hover:text-gray-600 transition">
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </button>
                  <p className="text-sm font-semibold text-gray-800">Meu perfil</p>
                </div>

                {/* Avatar grande + editar foto */}
                <div className="flex flex-col items-center gap-2 py-5 bg-gray-50">
                  <div className="relative">
                    <Avatar size="lg" />
                    <button
                      onClick={() => photoRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#0a0a0a] rounded-full flex items-center justify-center shadow-lg hover:bg-[#1a1a1a] transition"
                    >
                      <Camera className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <button
                    onClick={() => photoRef.current?.click()}
                    className="text-xs text-gray-700 font-medium hover:underline"
                  >
                    Trocar foto
                  </button>
                </div>

                {/* Campos */}
                <div className="px-4 py-3 space-y-3">
                  {/* Nome */}
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Nome</p>
                    {editingName ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={nameInputRef}
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNewName(user.nome); } }}
                          className="flex-1 border border-gray-400 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-gray-300"
                          autoFocus
                        />
                        <button onClick={saveName} className="w-7 h-7 bg-[#0a0a0a] rounded-lg flex items-center justify-center text-white hover:bg-[#1a1a1a] transition"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setEditingName(false); setNewName(user.nome); }} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 transition"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between group">
                        <p className="text-sm text-gray-800 font-medium">{user.nome}</p>
                        <button onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0); }}
                          className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-gray-700"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">E-mail</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>

                  {/* Telefone */}
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Telefone</p>
                    <p className="text-sm text-gray-600">{user.telefone ?? "—"}</p>
                  </div>

                  {/* Membro desde */}
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Membro desde</p>
                    <p className="text-sm text-gray-600">{new Date(user.dataIngresso).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              </>
            )}

            {/* ─── VIEW: MEUS MINISTÉRIOS ─── */}
            {view === "dados" && (
              <>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <button onClick={() => setView("menu")} className="text-gray-400 hover:text-gray-600 transition">
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </button>
                  <p className="text-sm font-semibold text-gray-800">Meus ministérios</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {user.ministerios.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhum ministério atribuído.</p>
                  ) : user.ministerios.map((m) => {
                    const MIN_LABEL: Record<string, string> = { Cantina: "Recepcionamento", Ensino: "Pregação" };
                    return (
                      <div key={m} className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                        <Layers className="w-4 h-4 text-gray-600 shrink-0" />
                        <p className="text-sm font-medium text-gray-900">{MIN_LABEL[m] ?? m}</p>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-gray-400 text-center pt-1">Para alterar ministérios, fale com um administrador.</p>
                </div>
              </>
            )}

          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout, atualizarUsuario } = useAuth();
  const router = useRouter();

  const [senhaModal, setSenhaModal] = useState(false);
  const [novaSenhaPrimeiro, setNovaSenhaPrimeiro] = useState("");
  const [nomeForm, setNomeForm] = useState("");
  const [telefoneForm, setTelefoneForm] = useState("");
  const [showSenhaPrimeiro, setShowSenhaPrimeiro] = useState(false);
  const [salvandoPrimeiro, setSalvandoPrimeiro] = useState(false);
  const [erroPrimeiro, setErroPrimeiro] = useState("");

  function handleLogout() {
    logout();
    router.push("/login");
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!isLoading && user?.primeiroAcesso) {
      setNomeForm(user.nome ?? "");
      setTelefoneForm(user.telefone ?? "");
      setSenhaModal(true);
    }
  }, [isLoading, user?.primeiroAcesso]);

  async function salvarPrimeiraSenha() {
    if (!user) return;
    const nomeTrimmed = nomeForm.trim();
    const telTrimmed = telefoneForm.trim();
    if (!nomeTrimmed) { setErroPrimeiro("Digite seu nome completo."); return; }
    if (!telTrimmed) { setErroPrimeiro("Digite seu telefone."); return; }
    if (novaSenhaPrimeiro.length < 6) { setErroPrimeiro("A nova senha deve ter no mínimo 6 caracteres."); return; }
    setSalvandoPrimeiro(true); setErroPrimeiro("");
    const res = await fetch("/api/alterar-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, novaSenha: novaSenhaPrimeiro }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setErroPrimeiro(json.error ?? "Erro ao alterar senha."); setSalvandoPrimeiro(false); return; }
    await atualizarUsuario(user.id, { primeiroAcesso: false, nome: nomeTrimmed, telefone: telTrimmed });
    setSenhaModal(false);
    setNovaSenhaPrimeiro("");
    setSalvandoPrimeiro(false);
  }

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ChatUnreadProvider>
    <PushSubscriber />
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      {/* Sidebar — apenas desktop */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="h-14 px-4 md:px-6 flex items-center justify-between">
            {/* Mobile: logo + nome da igreja */}
            <div className="flex items-center gap-2 md:hidden">
              <Image src="/logo.png" alt="Logo Ramo da Vida" width={28} height={28} className="w-7 h-7 object-contain" />
              <span className="font-bold text-black text-base">Ramo da Vida</span>
            </div>
            {/* Desktop: espaço vazio (título fica no conteúdo) */}
            <div className="hidden md:block" />
            <div className="flex items-center gap-2 md:gap-3">
              <NotificationBell />
              <ProfileDropdown
                user={user}
                onLogout={handleLogout}
                onUpdate={(dados) => atualizarUsuario(user.id, dados)}
              />
            </div>
          </div>
        </header>

        {/* Conteúdo principal */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav — apenas mobile */}
      <BottomNav />

      {/* Modal primeiro acesso — troca de senha obrigatória */}
      {senhaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6 text-gray-700" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Complete seu cadastro</h2>
              <p className="text-sm text-gray-500">Confirme seus dados e crie uma senha pessoal para continuar.</p>
            </div>

            <div className="space-y-3">
              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nome completo</label>
                <input
                  type="text"
                  value={nomeForm}
                  onChange={(e) => { setNomeForm(e.target.value); setErroPrimeiro(""); }}
                  placeholder="Seu nome completo"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100"
                  autoFocus
                />
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  value={telefoneForm}
                  onChange={(e) => { setTelefoneForm(e.target.value); setErroPrimeiro(""); }}
                  placeholder="(00) 00000-0000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100"
                />
              </div>

              {/* Nova senha */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nova senha</label>
                <div className="relative">
                  <input
                    type={showSenhaPrimeiro ? "text" : "password"}
                    value={novaSenhaPrimeiro}
                    onChange={(e) => { setNovaSenhaPrimeiro(e.target.value); setErroPrimeiro(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") salvarPrimeiraSenha(); }}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100 pr-10"
                  />
                  <button type="button" onClick={() => setShowSenhaPrimeiro((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSenhaPrimeiro ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {erroPrimeiro && <p className="text-xs text-red-500 -mt-2">{erroPrimeiro}</p>}
            <button
              onClick={salvarPrimeiraSenha}
              disabled={salvandoPrimeiro || !nomeForm || !telefoneForm || !novaSenhaPrimeiro}
              className="w-full py-3 bg-[#0a0a0a] text-white rounded-xl text-sm font-semibold hover:bg-[#111] transition disabled:opacity-50"
            >
              {salvandoPrimeiro ? "Salvando..." : "Confirmar e entrar"}
            </button>
          </div>
        </div>
      )}
    </div>
    </ChatUnreadProvider>
  );
}
