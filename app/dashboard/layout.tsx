"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ChatUnreadProvider } from "@/contexts/ChatUnreadContext";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { User, Permissao } from "@/types";
import {
  LogOut, Pencil, Check, X, Camera, ChevronRight, User as UserIcon,
  Mail, Phone, Calendar, Layers, Shield, Settings, HelpCircle,
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
  voluntario: "bg-vine-100 text-vine-700",
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
  const [view, setView] = useState<"menu" | "perfil" | "dados">("menu");
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user.nome);
  const photoRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function close() { setOpen(false); setView("menu"); setEditingName(false); }

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
      : "w-8 h-8 text-sm ring-2 ring-vine-500 ring-offset-1";
    return user.foto
      ? <img src={user.foto} alt={user.nome} className={clsx("rounded-full object-cover", cls)} />
      : <div className={clsx("rounded-full bg-vine-700 flex items-center justify-center text-white font-bold", cls)}>{initials}</div>;
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
                      className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-vine-600 rounded-full flex items-center justify-center shadow hover:bg-vine-500 transition"
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
                      className="absolute -bottom-1 -right-1 w-7 h-7 bg-vine-700 rounded-full flex items-center justify-center shadow-lg hover:bg-vine-600 transition"
                    >
                      <Camera className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <button
                    onClick={() => photoRef.current?.click()}
                    className="text-xs text-vine-600 font-medium hover:underline"
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
                          className="flex-1 border border-vine-400 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-vine-300"
                          autoFocus
                        />
                        <button onClick={saveName} className="w-7 h-7 bg-vine-700 rounded-lg flex items-center justify-center text-white hover:bg-vine-600 transition"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setEditingName(false); setNewName(user.nome); }} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 transition"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between group">
                        <p className="text-sm text-gray-800 font-medium">{user.nome}</p>
                        <button onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0); }}
                          className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-vine-600"
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
                  ) : user.ministerios.map((m) => (
                    <div key={m} className="flex items-center gap-2.5 bg-vine-50 border border-vine-100 rounded-xl px-3 py-2">
                      <Layers className="w-4 h-4 text-vine-500 shrink-0" />
                      <p className="text-sm font-medium text-vine-800">{m}</p>
                    </div>
                  ))}
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

  function handleLogout() {
    logout();
    router.push("/login");
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
    // Membros só acessam o portal de membro — sem dashboard interno
    if (!isLoading && user && user.role === "membro") {
      router.push("/membro");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-vine-950">
        <div className="w-8 h-8 border-4 border-vine-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ChatUnreadProvider>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between shadow-sm">
          <div />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ProfileDropdown
              user={user}
              onLogout={handleLogout}
              onUpdate={(dados) => atualizarUsuario(user.id, dados)}
            />
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
    </ChatUnreadProvider>
  );
}
