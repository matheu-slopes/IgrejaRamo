"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { User } from "@/types";
import { Search, CheckCircle, XCircle } from "lucide-react";

export default function MembrosPage() {
  const { user, usuarios } = useAuth();
  const [busca, setBusca] = useState("");

  if (!user) return null;

  const membros = usuarios.filter(
    (u) =>
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Membros</h1>
          <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">Lista de membros cadastrados na igreja.</p>
        </div>
        <div className="relative self-start sm:self-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar membro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vine-400 bg-white w-full sm:w-auto"
          />
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {membros.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">Nenhum membro encontrado.</p>
        )}
        {membros.map((m) => (
          <MemberCard key={m.id} member={m} />
        ))}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">E-mail</th>
              <th className="px-4 py-3 text-left">Perfil</th>
              <th className="px-4 py-3 text-left">Ministérios</th>
              <th className="px-4 py-3 text-center">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {membros.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </tbody>
        </table>

        {membros.length === 0 && (
          <p className="text-center text-gray-400 py-8">Nenhum membro encontrado.</p>
        )}
      </div>
    </div>
  );
}

function MemberCard({ member }: { member: User }) {
  const roleColors: Record<string, string> = {
    admin:      "bg-purple-100 text-purple-700",
    pastor:     "bg-blue-100 text-blue-700",
    lider:      "bg-vine-100 text-vine-700",
    voluntario: "bg-green-100 text-green-700",
    membro:     "bg-gray-100 text-gray-600",
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-9 h-9 rounded-full bg-vine-100 flex items-center justify-center shrink-0">
        <span className="text-vine-700 font-bold text-sm">{member.nome.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800 truncate">{member.nome}</p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${roleColors[member.role] ?? "bg-gray-100 text-gray-600"}`}>
            {member.role}
          </span>
          {member.ativo
            ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
            : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          }
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">{member.email}</p>
        {member.ministerios.length > 0 && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{member.ministerios.join(", ")}</p>
        )}
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: User }) {
  const roleColors: Record<string, string> = {
    admin:      "bg-purple-100 text-purple-700",
    pastor:     "bg-blue-100 text-blue-700",
    lider:      "bg-vine-100 text-vine-700",
    voluntario: "bg-green-100 text-green-700",
    membro:     "bg-gray-100 text-gray-600",
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-800">{member.nome}</td>
      <td className="px-4 py-3 text-gray-500">{member.email}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${roleColors[member.role] ?? "bg-gray-100 text-gray-600"}`}>
          {member.role}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500">{member.ministerios.join(", ")}</td>
      <td className="px-4 py-3 text-center">
        {member.ativo ? (
          <CheckCircle className="w-4 h-4 text-green-500 inline" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400 inline" />
        )}
      </td>
    </tr>
  );
}
