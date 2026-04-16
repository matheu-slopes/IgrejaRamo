"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { mockUsers } from "@/lib/mockData";
import { User } from "@/types";
import { Search, CheckCircle, XCircle } from "lucide-react";

export default function MembrosPage() {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");

  if (!user) return null;

  const membros = mockUsers.filter(
    (u) =>
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membros</h1>
          <p className="text-sm text-gray-500 mt-1">Lista de membros cadastrados na igreja.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar membro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vine-400 bg-white"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
