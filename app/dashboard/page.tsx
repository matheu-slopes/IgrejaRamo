"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Evento, Aviso } from "@/types";
import {
  CalendarCheck,
  Bell,
  Music,
  MapPin,
  Clock,
  ChevronRight,
  Megaphone,
  CalendarDays,
  Pin,
} from "lucide-react";
import Link from "next/link";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

type MinhaEscala = {
  data: string;
  horario: string;
  culto: string;
  ministerio: string;
  funcao: string;
  local: string;
  observacao: string;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [avisoFixado, setAvisoFixado] = useState<{ conteudo: string; ativo: boolean } | null>(null);
  const [proximosEventos, setProximosEventos] = useState<Evento[]>([]);
  const [avisosFiltrados, setAvisosFiltrados] = useState<Aviso[]>([]);
  const [escala, setEscala] = useState<MinhaEscala | null>(null);

  useEffect(() => {
    supabase
      .from("aviso_fixado")
      .select()
      .eq("ativo", true)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAvisoFixado({ conteudo: data[0].conteudo, ativo: data[0].ativo });
        }
      });
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("eventos")
      .select()
      .gte("data", today)
      .order("data", { ascending: true })
      .limit(4)
      .then(({ data }) => {
        if (data) {
          setProximosEventos(
            data.map((e) => ({
              id: e.id, titulo: e.titulo, descricao: e.descricao ?? "",
              data: e.data, horario: e.horario, local: e.local,
              publico: e.publico, ministerio: e.ministerio,
              imagemUrl: e.imagem_url, criadoPor: e.criado_por,
              recorrente: e.recorrente,
            }))
          );
        }
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("avisos")
      .select()
      .order("criado_em", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) {
          setAvisosFiltrados(
            data
              .filter((a) => {
                // Admin e pastor veem todos os avisos, sem exceção
                if (user.role === "admin" || user.role === "pastor") return true;

                // Verifica se o destinatário bate com o role do usuário
                const destMatch =
                  a.destinatarios === "todos" ||
                  (Array.isArray(a.destinatarios) &&
                    a.destinatarios.length > 0 &&
                    a.destinatarios.includes(user.role));
                if (!destMatch) return false;

                // Se o aviso é vinculado a um ministério específico,
                // só aparece para quem pertence àquele ministério
                if (a.ministerios?.length) {
                  return (a.ministerios as string[]).some((m) => user.ministerios?.includes(m as import("@/types").Ministerio));
                }

                return true;
              })
              .slice(0, 3)
              .map((a) => ({
                id: a.id, titulo: a.titulo, conteudo: a.conteudo,
                criadoEm: a.criado_em, destinatarios: a.destinatarios,
                ministerios: a.ministerios, visivelHome: a.visivel_home,
              }))
          );
        }
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("escala_itens")
      .select("funcao, observacao, escalas(data, horario, culto, ministerio, locais(nome))")
      .eq("voluntario_id", user.id)
      .gte("escalas.data", today)
      .order("escalas.data", { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const item = data[0] as any;
          const esc = item.escalas;
          if (esc) {
            setEscala({
              data: new Date(esc.data + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "long", day: "2-digit", month: "long",
              }),
              horario: esc.horario,
              culto: esc.culto,
              ministerio: esc.ministerio,
              funcao: item.funcao,
              local: esc.locais?.nome ?? "",
              observacao: item.observacao ?? "",
            });
          }
        }
      });
  }, [user]);

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-5 md:space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Olá, {user.nome.split(" ")[0]}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Aqui está um resumo da sua semana na igreja.
        </p>
      </div>

      {/* ── Aviso Fixado ───────────────────────────────────── */}
      {avisoFixado?.ativo && avisoFixado.conteudo && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <Pin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-medium">{avisoFixado.conteudo}</p>
        </div>
      )}

      {/* ── Minha Próxima Escala ─────────────────────────────── */}
      {escala && (
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">
          Minha Próxima Escala
        </h2>
        <div className="bg-gradient-to-r from-gray-900 to-black rounded-2xl p-6 text-white shadow-lg border border-gray-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <CalendarCheck className="w-4 h-4" />
                <span>{escala.data}</span>
              </div>
              <p className="text-2xl font-bold">{escala.funcao}</p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-300">
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
              className="flex items-center gap-1 bg-gold-400 text-black font-semibold text-sm px-4 py-2 rounded-xl hover:bg-gold-300 transition shrink-0"
            >
              Ver todas as escalas
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* ── Two-column grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Próximos Eventos */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-gray-800" />
              Próximos Eventos
            </h2>
            <Link href="/eventos" className="text-xs text-gray-800 hover:underline font-medium">
              Ver todos
            </Link>
          </div>
          <ul className="space-y-3">
            {proximosEventos.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition"
              >
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-gray-900 text-xs font-bold leading-tight">
                    {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit" })}
                  </span>
                  <span className="text-gray-400 text-[10px] uppercase leading-tight">
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
                  <span className="text-xs bg-gray-50 text-gray-900 font-medium px-2 py-0.5 rounded-full shrink-0">
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

    </div>
  );
}
