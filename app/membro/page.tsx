"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Church,
  User,
  Mail,
  Phone,
  Calendar,
  LogOut,
  MapPin,
  Info,
} from "lucide-react";

export default function MembroPortalPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.nome}</h1>
            <p className="text-sm text-gray-400 mt-0.5">Bem-vindo(a) ao portal de membros</p>
          </div>
        </div>

        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Seus dados</p>
          </div>
          <div className="divide-y divide-gray-50">
            <InfoRow icon={<User className="w-4 h-4 text-vine-600" />} label="Nome" value={user.nome} />
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

        {/* Info sobre a situação */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 space-y-1">
            <p className="font-semibold">Acesso limitado</p>
            <p className="text-xs leading-relaxed">
              Seu cadastro está registrado como <strong>membro</strong>. Para acessar escalas,
              canais de ministério e outras funções internas, entre em contato com a liderança
              para ser vinculado a um ministério.
            </p>
          </div>
        </div>

        {/* Informações da Igreja */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Igreja Ramo da Vida</p>
          </div>
          <div className="divide-y divide-gray-50">
            <InfoRow icon={<MapPin className="w-4 h-4 text-vine-600" />} label="Endereço" value="Rua das Palmeiras, 123 — Centro" />
            <InfoRow icon={<Calendar className="w-4 h-4 text-vine-600" />} label="Culto de Quinta" value="Quintas-feiras às 20h" />
            <InfoRow icon={<Calendar className="w-4 h-4 text-vine-600" />} label="Culto de Domingo" value="Domingos às 18h30" />
            <InfoRow icon={<Church className="w-4 h-4 text-vine-600" />} label="Pastor" value="Pastor João Silva" />
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
