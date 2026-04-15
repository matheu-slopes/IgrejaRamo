"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { mockEventos, mockAvisos } from "@/lib/mockData";
import { CalendarDays, Bell, Users, Shield } from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const proximosEventos = mockEventos
    .filter((e) => e.data >= new Date().toISOString().split("T")[0])
    .slice(0, 3);

  const avisosFiltrados = mockAvisos.filter(
    (a) =>
      a.destinatarios === "todos" ||
      (Array.isArray(a.destinatarios) && a.destinatarios.includes(user.role))
  );

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            Olá, {user.nome.split(" ")[0]}!
          </h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">
            {user.role} · {user.ministerios.join(", ")}
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<CalendarDays className="w-5 h-5 text-indigo-500" />} label="Próximos Eventos" value={mockEventos.length} />
          <StatCard icon={<Bell className="w-5 h-5 text-amber-500" />} label="Avisos para voocê" value={avisosFiltrados.length} />
          <StatCard icon={<Users className="w-5 h-5 text-green-500" />} label="Ministérios" value={user.ministerios.length} />
          <StatCard icon={<Shield className="w-5 h-5 text-purple-500" />} label="Perfil" value={user.role} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Próximos eventos */}
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-500" /> Próximos Eventos
            </h2>
            <ul className="flex flex-col gap-3">
              {proximosEventos.map((e) => (
                <li key={e.id} className="border-l-4 border-indigo-400 pl-3">
                  <p className="font-medium text-sm text-gray-800">{e.titulo}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR")} às {e.horario} · {e.local}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Avisos */}
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" /> Avisos
            </h2>
            <ul className="flex flex-col gap-3">
              {avisosFiltrados.map((a) => (
                <li key={a.id} className="border-l-4 border-amber-400 pl-3">
                  <p className="font-medium text-sm text-gray-800">{a.titulo}</p>
                  <p className="text-xs text-gray-500">{a.conteudo}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-2">
      {icon}
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-800 capitalize">{value}</p>
    </div>
  );
}
