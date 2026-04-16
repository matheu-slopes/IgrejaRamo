"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Clock, MapPin, X, ChevronLeft, ChevronRight } from "lucide-react";

interface EventCard {
  id: string;
  titulo: string;
  descricao: string;
  data: string;
  horario: string;
  local: string;
  cor: string;
}

const programacao: EventCard[] = [
  {
    id: "p1",
    titulo: "Oração",
    descricao: "Momento de busca e intercessão coletiva.",
    data: "Segunda-feira",
    horario: "20h00",
    local: "Templo Principal",
    cor: "from-vine-800 to-vine-900",
  },
  {
    id: "p2",
    titulo: "Culto de Mulheres",
    descricao: "Comunhão e palavra direcionada — 1ª terça do mês.",
    data: "Terça-feira",
    horario: "19h30",
    local: "Templo Principal",
    cor: "from-grape-800 to-grape-900",
  },
  {
    id: "p3",
    titulo: "Culto de Ensino",
    descricao: "Aprofundamento bíblico e capacitação — 2ª terça do mês.",
    data: "Terça-feira",
    horario: "19h45",
    local: "Templo Principal",
    cor: "from-bark-700 to-bark-800",
  },
  {
    id: "p4",
    titulo: "Culto de Quinta",
    descricao: "Louvor, oração e Palavra para fortalecer a semana.",
    data: "Quinta-feira",
    horario: "20h00",
    local: "Templo Principal",
    cor: "from-vine-700 to-vine-900",
  },
  {
    id: "p5",
    titulo: "Jovens",
    descricao: "Encontro quinzenal da juventude com adoração e comunhão.",
    data: "Sábado",
    horario: "19h30",
    local: "Sala 3",
    cor: "from-vine-600 to-vine-800",
  },
  {
    id: "p6",
    titulo: "Culto Dominical",
    descricao: "Celebração semanal com toda a família. 1º dom: 10h.",
    data: "Domingo",
    horario: "18h30",
    local: "Templo Principal",
    cor: "from-gold-600 to-gold-800",
  },
];

export default function CylinderCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<EventCard | null>(null);
  const dragX = useMotionValue(0);
  const springX = useSpring(dragX, { stiffness: 300, damping: 30 });

  const containerRef = useRef<HTMLDivElement>(null);

  const total = programacao.length;
  const angleStep = 360 / total;

  function next() {
    setActiveIndex((i) => (i + 1) % total);
  }
  function prev() {
    setActiveIndex((i) => (i - 1 + total) % total);
  }

  return (
    <section className="relative py-28 px-5 bg-[#060d06] overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(212,154,18,0.04) 0%, transparent 60%)" }}
      />

      <div className="max-w-5xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-gold-500/70 text-[11px] tracking-[0.4em] uppercase mb-3">
            Programação
          </p>
          <h2 className="font-sans text-4xl md:text-6xl font-semibold text-white">
            Nossos Cultos
          </h2>
        </motion.div>

        {/* 3D Carousel */}
        <div ref={containerRef} className="relative w-full h-[340px] perspective-[1200px] flex items-center justify-center">
          <div
            className="relative w-[280px] h-[300px] transform-gpu"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateY(${-activeIndex * angleStep}deg)`,
              transition: "transform 0.7s cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          >
            {programacao.map((evento, i) => {
              const angle = i * angleStep;
              const radius = 320;
              return (
                <div
                  key={evento.id}
                  className="absolute inset-0"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                  }}
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setExpandedCard(evento)}
                    className={`w-[280px] h-[300px] rounded-3xl bg-gradient-to-b ${evento.cor}
                               border border-white/10 backdrop-blur-md p-6
                               flex flex-col justify-between cursor-pointer
                               shadow-2xl shadow-black/40`}
                  >
                    <div>
                      <p className="text-white/50 text-[10px] tracking-[0.3em] uppercase mb-1">
                        {evento.data}
                      </p>
                      <h3 className="text-white text-xl font-bold mb-2">{evento.titulo}</h3>
                      <p className="text-white/60 text-sm leading-relaxed">{evento.descricao}</p>
                    </div>
                    <div className="flex items-center gap-4 text-white/50 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {evento.horario}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {evento.local}
                      </span>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>

          {/* Navigation arrows */}
          <button
            onClick={prev}
            className="absolute left-4 md:left-8 z-20 w-11 h-11 rounded-full bg-white/5 border border-white/10
                       flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 md:right-8 z-20 w-11 h-11 rounded-full bg-white/5 border border-white/10
                       flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
            aria-label="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {programacao.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "bg-gold-400 w-6" : "bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`Ir para ${programacao[i].titulo}`}
              />
            ))}
          </div>
        </div>

        {/* Address */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-vine-600 text-sm mt-16"
        >
          📍 R. Fernão Pompeu de Camargo, 1293 — Jardim do Trevo, Campinas – SP
        </motion.p>
      </div>

      {/* ── Expanded card overlay ───────────────────────────────── */}
      <AnimatePresence>
        {expandedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={() => setExpandedCard(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            {/* Card */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative z-10 w-full max-w-md mx-4 rounded-3xl bg-gradient-to-b ${expandedCard.cor}
                         border border-white/10 p-8 shadow-2xl`}
            >
              <button
                onClick={() => setExpandedCard(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>

              <p className="text-white/50 text-[10px] tracking-[0.3em] uppercase mb-2">
                {expandedCard.data}
              </p>
              <h3 className="text-white text-3xl font-bold font-sans mb-4">{expandedCard.titulo}</h3>
              <p className="text-white/70 text-base leading-relaxed mb-8">{expandedCard.descricao}</p>

              <div className="flex items-center gap-6 text-white/60 text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {expandedCard.horario}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {expandedCard.local}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
