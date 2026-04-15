"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { mockUsers } from "@/lib/mockData";
import { User } from "@/types";
import { Search, CheckCircle, XCircle } from "lucide-react";

export default function CadastroPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const membros = mockUsers.filter(
    (u) =>
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Membros</h1>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar membro..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
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
      </main>
    </>
  );
}

function MemberRow({ member }: { member: User }) {
  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    pastor: "bg-blue-100 text-blue-700",
    lider: "bg-indigo-100 text-indigo-700",
    voluntario: "bg-green-100 text-green-700",
    membro: "bg-gray-100 text-gray-600",
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-800">{member.nome}</td>
      <td className="px-4 py-3 text-gray-500">{member.email}</td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
            roleColors[member.role] ?? "bg-gray-100 text-gray-600"
          }`}
        >
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
