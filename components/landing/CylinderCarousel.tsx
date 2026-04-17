"use client";

import { motion } from "framer-motion";
import { Clock3, MapPin, Bell, CalendarDays } from "lucide-react";
import { mockAvisos } from "@/lib/mockData";

interface CultoDay {
  id: string;
  short: string;
  full: string;
  title: string;
  description: string;
  time: string;
  place: string;
  featured?: boolean;
}

const days: CultoDay[] = [
  {
    id: "seg",
    short: "SEG",
    full: "Segunda-feira",
    title: "Oração",
    description: "Busca, intercessão coletiva e fortalecimento espiritual.",
    time: "20h00",
    place: "Templo Principal",
  },
  {
    id: "ter",
    short: "TER",
    full: "Terça-feira",
    title: "Mulheres & Ensino",
    description: "1ª terça: culto de mulheres. 2ª terça: ensino bíblico.",
    time: "19h30 / 19h45",
    place: "Templo Principal",
  },
  {
    id: "qui",
    short: "QUI",
    full: "Quinta-feira",
    title: "Culto de Quinta",
    description: "Louvor, oração e Palavra para renovar a fé no meio da semana.",
    time: "20h00",
    place: "Templo Principal",
  },
  {
    id: "sab",
    short: "SÁB",
    full: "Sábado",
    title: "Jovens",
    description: "Encontro quinzenal com adoração, comunhão e palavra para a juventude.",
    time: "19h30",
    place: "Sala 3",
  },
  {
    id: "dom",
    short: "DOM",
    full: "Domingo",
    title: "Culto Dominical",
    description: "Celebração com louvor, mensagem e comunhão para toda a família.",
    time: "18h30",
    place: "Templo Principal",
    featured: true,
  },
];

const avisosPublicos = mockAvisos.filter((a) => a.destinatarios === "todos");

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

export default function CylinderCarousel() {
  return (
    <section
      id="cultos"
      className="relative overflow-hidden bg-[#050805] px-6 py-20 sm:px-10"
    >
      {/* glow frio à esquerda (cultos) e quente à direita (mural) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(180,220,255,0.04),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(100,220,140,0.05),transparent_55%)]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_auto_1fr] lg:gap-0">

          {/* ══ COLUNA ESQUERDA — Programação ══ */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-8 flex items-end justify-between border-b border-white/[0.10] pb-5"
            >
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-[0.45em] text-white/45">
                  Programação Semanal
                </p>
                <h2 className="font-sans text-2xl font-semibold leading-none text-white">
                  Nossos Cultos
                </h2>
              </div>
            </motion.div>

            <ol className="divide-y divide-white/[0.07]">
              {days.map((day, i) => (
                <motion.li
                  key={day.id}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.07 }}
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                  className="group flex items-center gap-5 rounded-xl px-3 py-4 transition-colors duration-300"
                >
                  <span className="w-5 shrink-0 text-xs tabular-nums text-white/20 group-hover:text-white/40 transition-colors">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span
                    className={`w-12 shrink-0 font-serif text-base font-semibold leading-none tracking-[0.1em] transition-colors duration-300 ${
                      day.featured ? "text-white" : "text-white/60 group-hover:text-white/90"
                    }`}
                  >
                    {day.short}
                  </span>

                  <span className="h-7 w-px shrink-0 bg-white/[0.10]" />

                  <div className="flex flex-1 flex-col gap-1 min-w-0">
                    <span
                      className={`truncate text-sm font-semibold leading-none transition-colors duration-300 ${
                        day.featured ? "text-white" : "text-white/75 group-hover:text-white"
                      }`}
                    >
                      {day.title}
                    </span>
                    <span className="truncate text-xs text-white/40 group-hover:text-white/60 transition-colors duration-300">
                      {day.description}
                    </span>
                  </div>

                  <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    <span className="flex items-center gap-1 text-xs text-white/60 group-hover:text-white/85 transition-colors">
                      <Clock3 className="h-3 w-3 text-white/30" />
                      {day.time}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-white/30 group-hover:text-white/50 transition-colors">
                      <MapPin className="h-2.5 w-2.5" />
                      {day.place}
                    </span>
                  </div>

                  {day.featured && (
                    <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" />
                  )}
                </motion.li>
              ))}
            </ol>

            <p className="mt-7 text-[10px] tracking-widest text-white/25 uppercase">
              R. Fernão Pompeu de Camargo, 1293 · Campinas
            </p>
          </div>

          {/* ══ DIVISOR VERTICAL ══ */}
          <div className="hidden lg:block w-px self-stretch bg-white/[0.10] mx-12" />

          {/* ══ COLUNA DIREITA — Mural ══ */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-8 flex items-end justify-between border-b border-emerald-400/20 pb-5"
            >
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-[0.45em] text-emerald-400/60">
                  Fique por dentro
                </p>
                <h2 className="font-sans text-2xl font-semibold leading-none text-white">
                  Mural de Avisos
                </h2>
              </div>
              <Bell className="h-5 w-5 text-emerald-400/40" />
            </motion.div>

            <ol className="space-y-3">
              {avisosPublicos.map((aviso, i) => (
                <motion.li
                  key={aviso.id}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  whileHover={{ backgroundColor: "rgba(52,211,153,0.05)" }}
                  className="group flex items-start gap-4 rounded-xl border border-white/[0.06] border-l-2 border-l-emerald-400/40 bg-white/[0.025] px-4 py-4 transition-colors duration-300 hover:border-emerald-400/30"
                >
                  <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                    <span className="text-sm font-semibold leading-snug text-white/85 group-hover:text-white transition-colors duration-300">
                      {aviso.titulo}
                    </span>
                    <span className="text-xs leading-5 text-white/45 group-hover:text-white/65 transition-colors duration-300">
                      {aviso.conteudo}
                    </span>
                    <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400/70 group-hover:bg-emerald-400/15 group-hover:text-emerald-300 transition-colors">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {formatDate(aviso.criadoEm)}
                    </span>
                  </div>
                </motion.li>
              ))}

              {avisosPublicos.length === 0 && (
                <li className="py-6 text-center text-[12px] text-white/25">
                  Nenhum aviso no momento.
                </li>
              )}
            </ol>
          </div>

        </div>
      </div>
    </section>
  );
}
