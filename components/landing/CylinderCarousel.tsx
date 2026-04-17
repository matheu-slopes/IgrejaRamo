"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Clock3, MapPin } from "lucide-react";

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

/* ── Stagger variants ── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

export default function CylinderCarousel() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const branchLeft = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const branchRight = useTransform(scrollYProgress, [0, 1], [40, -80]);

  return (
    <section
      ref={sectionRef}
      id="cultos"
      className="relative overflow-hidden"
      style={{ padding: "10vh 5vw", backgroundColor: "#FDFDFB" }}
    >
      {/* Fade de entrada */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#FDFDFB] to-transparent pointer-events-none z-10" />

      {/* Ramo botânico — lateral esquerda */}
      <motion.svg
        aria-hidden="true"
        style={{ y: branchLeft, filter: "blur(3px)" }}
        className="pointer-events-none absolute -left-16 top-1/4 w-72 h-72 opacity-[0.08] select-none"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M20 190 Q60 140 90 100 Q120 60 100 10" stroke="#276f2a" strokeWidth="2" strokeLinecap="round"/>
        <path d="M90 100 Q65 85 45 60" stroke="#276f2a" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M90 100 Q115 82 130 55" stroke="#276f2a" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M45 60 Q32 45 28 22" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M45 60 Q58 46 65 28" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M130 55 Q145 38 148 18" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <ellipse cx="100" cy="10" rx="4" ry="9" transform="rotate(-15 100 10)" fill="#276f2a" opacity="0.7"/>
        <ellipse cx="28" cy="22" rx="3.5" ry="8" transform="rotate(-30 28 22)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="65" cy="28" rx="3.5" ry="8" transform="rotate(10 65 28)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="148" cy="18" rx="3.5" ry="8" transform="rotate(20 148 18)" fill="#276f2a" opacity="0.6"/>
      </motion.svg>

      {/* Ramo botânico — lateral direita */}
      <motion.svg
        aria-hidden="true"
        style={{ y: branchRight, filter: "blur(3px)", scaleX: -1 }}
        className="pointer-events-none absolute -right-16 bottom-1/4 w-72 h-72 opacity-[0.08] select-none"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M20 190 Q60 140 90 100 Q120 60 100 10" stroke="#276f2a" strokeWidth="2" strokeLinecap="round"/>
        <path d="M90 100 Q65 85 45 60" stroke="#276f2a" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M90 100 Q115 82 130 55" stroke="#276f2a" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M130 55 Q145 38 148 18" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M130 55 Q118 38 120 18" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M55 150 Q70 135 82 115" stroke="#276f2a" strokeWidth="1.3" strokeLinecap="round"/>
        <ellipse cx="100" cy="10" rx="4" ry="9" transform="rotate(-15 100 10)" fill="#276f2a" opacity="0.7"/>
        <ellipse cx="148" cy="18" rx="3.5" ry="8" transform="rotate(20 148 18)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="120" cy="18" rx="3.5" ry="8" transform="rotate(-10 120 18)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="82" cy="115" rx="3" ry="7" transform="rotate(35 82 115)" fill="#276f2a" opacity="0.5"/>
      </motion.svg>

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="mb-3 text-[11px] uppercase tracking-[0.45em] text-vine-600">
            Programação Semanal
          </p>
          <h2 className="font-sans text-3xl md:text-4xl font-semibold leading-none text-[#1A1A1A] tracking-tight">
            Nossos Cultos
          </h2>
        </motion.div>

        {/* Lista de cultos */}
        <motion.ol
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="space-y-2 rounded-3xl border border-black/[0.05] p-4 md:p-6"
          style={{
            background: "rgba(255,255,255,0.4)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.04)",
          }}
        >
          {days.map((day, i) => (
            <motion.li
              key={day.id}
              variants={fadeUp}
              className="group relative rounded-2xl px-5 py-5 transition-all duration-300 cursor-pointer hover:bg-white/40 hover:backdrop-blur-md hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:border-black/[0.04]"
              style={{ border: "1px solid transparent" }}
              whileHover={{ borderColor: "rgba(0,0,0,0.04)" }}
            >
              {/* Divisor gradiente inferior */}
              <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-vine-300/40 to-transparent" />

              <div className="relative z-10 flex items-center gap-5">
                {/* Dia da semana */}
                <span
                  className={`w-14 shrink-0 font-sans text-lg font-bold tracking-[0.12em] transition-colors duration-300 ${
                    day.featured
                      ? "text-vine-800"
                      : "text-vine-600 group-hover:text-vine-900"
                  }`}
                >
                  {day.short}
                </span>

                {/* Separador vertical */}
                <span className="h-10 w-px shrink-0 bg-gradient-to-b from-transparent via-vine-300/50 to-transparent" />

                {/* Conteúdo */}
                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <span
                    className={`text-base font-semibold leading-tight transition-colors duration-300 ${
                      day.featured
                        ? "text-[#1A1A1A]"
                        : "text-vine-900 group-hover:text-[#1A1A1A]"
                    }`}
                  >
                    {day.title}
                  </span>
                  <span className="text-[13px] leading-relaxed text-vine-500/80 group-hover:text-vine-600 transition-colors duration-300">
                    {day.description}
                  </span>
                </div>

                {/* Horário e local */}
                <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-vine-700 group-hover:text-vine-900 transition-colors">
                    <Clock3 className="h-3.5 w-3.5 text-vine-400/70" />
                    {day.time}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-vine-400 group-hover:text-vine-600 transition-colors">
                    <MapPin className="h-3 w-3" />
                    {day.place}
                  </span>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ol>

        {/* Endereço */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-10 text-center text-[10px] tracking-[0.3em] text-vine-400 uppercase"
        >
          R. Fernão Pompeu de Camargo, 1293 · Campinas
        </motion.p>
      </div>

      {/* Fade de saída */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[#FDFDFB]/60 pointer-events-none z-10" />
    </section>
  );
}
