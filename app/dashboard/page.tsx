"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  mockEventos,
  mockAvisos,
  mockMinhaProximaEscala,
} from "@/lib/mockData";
import {
  CalendarCheck,
  Bell,
  Music,
  MapPin,
  Clock,
  ChevronRight,
  Megaphone,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";

// TODO (Supabase): Replace mock imports with server fetches:
// const escalas = await supabase.from('escalas').select().eq('voluntarioId', user.id).gte('data', today);
// const avisos = await supabase.from('avisos').select().order('criadoEm', { ascending: false });

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];
  const proximosEventos = mockEventos
    .filter((e) => e.data >= today)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 4);

  const avisosFiltrados = mockAvisos
    .filter(
      (a) =>
        a.destinatarios === "todos" ||
        (Array.isArray(a.destinatarios) && a.destinatarios.includes(user.role))
    )
    .slice(0, 3);

  const escala = mockMinhaProximaEscala;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {user.nome.split(" ")[0]}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Aqui está um resumo da sua semana na igreja.
        </p>
      </div>

      {/* ── Minha Próxima Escala ─────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">
          Minha Próxima Escala
        </h2>
        <div className="bg-gradient-to-r from-vine-800 to-vine-950 rounded-2xl p-6 text-white shadow-lg border border-vine-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-vine-300 text-sm">
                <CalendarCheck className="w-4 h-4" />
                <span>{escala.data}</span>
              </div>
              <p className="text-2xl font-bold">{escala.funcao}</p>
              <div className="flex flex-wrap gap-4 text-sm text-vine-300">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {escala.horario}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {escala.local}
                </span>
                <span className="flex items-center gap-1">
                  <Music className="w-3.5 h-3.5" /> {escala.ministerio}
                </span>
              </div>
              {escala.observacao && (
                <p className="text-xs bg-white/15 rounded-lg px-3 py-1.5 inline-block mt-1">
                  📌 {escala.observacao}
                </p>
              )}
            </div>
            <Link
              href="/dashboard/escalas"
              className="flex items-center gap-1 bg-gold-400 text-vine-950 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-gold-300 transition shrink-0"
            >
              Ver todas as escalas
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Two-column grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Próximos Eventos */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-vine-600" />
              Próximos Eventos
            </h2>
            <Link href="/eventos" className="text-xs text-vine-600 hover:underline font-medium">
              Ver todos
            </Link>
          </div>
          <ul className="space-y-3">
            {proximosEventos.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition"
              >
                <div className="w-10 h-10 bg-vine-50 rounded-xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-vine-700 text-xs font-bold leading-tight">
                    {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit" })}
                  </span>
                  <span className="text-vine-400 text-[10px] uppercase leading-tight">
                    {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{e.titulo}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {e.horario} · {e.local}
                  </p>
                </div>
                {e.ministerio && (
                  <span className="text-xs bg-vine-50 text-vine-700 font-medium px-2 py-0.5 rounded-full shrink-0">
                    {e.ministerio}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Avisos */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-amber-500" />
              Avisos para você
            </h2>
            <span className="text-xs bg-amber-50 text-amber-600 font-semibold px-2 py-0.5 rounded-full">
              {avisosFiltrados.length} novo{avisosFiltrados.length !== 1 ? "s" : ""}
            </span>
          </div>
          <ul className="space-y-3">
            {avisosFiltrados.map((a) => (
              <li
                key={a.id}
                className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition"
              >
                <Bell className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{a.titulo}</p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-relaxed line-clamp-2">
                    {a.conteudo}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {formatDate(a.criadoEm)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ── Quick access ministry cards ──────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">
          Meus Ministérios
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {(["Louvor", "Mídias", "Ensino", "Infantil", "Ação Social"] as const).map(
            (min) => {
              const active = user.ministerios.includes(min);
              return (
                <Link
                  key={min}
                  href={`/dashboard/mural?min=${min}`}
                  className={[
                    "flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center text-sm font-semibold transition border",
                    active
                      ? "bg-vine-700 text-white border-vine-700 shadow-md"
                      : "bg-white text-gray-500 border-gray-100 hover:border-vine-200 hover:text-vine-700",
                  ].join(" ")}
                >
                  <span className="text-xl">
                    {min === "Louvor" ? "🎸" : min === "Mídias" ? "📹" : min === "Ensino" ? "📖" : min === "Infantil" ? "🧒" : "🤝"}
                  </span>
                  {min}
                </Link>
              );
            }
          )}
        </div>
      </section>
    </div>
  );
}
