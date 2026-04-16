"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { mockEventos } from "@/lib/mockData";
import { Evento } from "@/types";
import { CalendarDays, MapPin, Clock, Globe, Lock } from "lucide-react";

export default function EventosPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [filtro, setFiltro] = useState<"todos" | "publico" | "interno">("todos");

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const eventos = mockEventos.filter((e) => {
    if (filtro === "publico") return e.publico;
    if (filtro === "interno") return !e.publico;
    return true;
  });

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Eventos</h1>
          <div className="flex gap-2">
            {(["todos", "publico", "interno"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                  filtro === f
                    ? "bg-vine-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "todos" ? "Todos" : f === "publico" ? "Públicos" : "Internos"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {eventos.map((e) => (
            <EventoCard key={e.id} evento={e} />
          ))}
        </div>

        {eventos.length === 0 && (
          <p className="text-center text-gray-400 mt-12">Nenhum evento encontrado.</p>
        )}
      </main>
    </>
  );
}

function EventoCard({ evento }: { evento: Evento }) {
  const data = new Date(evento.data + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <h2 className="font-semibold text-gray-800">{evento.titulo}</h2>
        {evento.publico ? (
          <Globe className="w-4 h-4 text-green-500 shrink-0" />
        ) : (
          <Lock className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </div>

      <p className="text-sm text-gray-500">{evento.descricao}</p>

      <div className="flex flex-col gap-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5" /> {data}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> {evento.horario}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> {evento.local}
        </span>
      </div>

      {evento.ministerio && (
        <span className="self-start bg-vine-50 text-vine-700 text-xs px-2 py-0.5 rounded-full">
          {evento.ministerio}
        </span>
      )}
    </div>
  );
}
