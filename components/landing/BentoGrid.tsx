"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { Play, BookOpen, Bell, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Aviso } from "@/types";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

/* --- Tilt card component ------------------------------------------ */
function TiltCard({
  children,
  className = "",
  depth = 0,
  lens,
}: {
  children: React.ReactNode;
  className?: string;
  depth?: number;
  lens?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-y * 12);
    rotateY.set(x * 12);
  }

  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [depth * 40, -depth * 40]);

  return (
    <motion.div
      ref={ref}
      style={{ rotateX: springX, rotateY: springY, y: parallaxY, perspective: 800 }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      className={`transform-gpu ${className}`}
      data-lens={lens}
    >
      {children}
    </motion.div>
  );
}

/* --- Latest Culto Card -------------------------------------------- */
function LatestCultoCard() {
  const [videoUrl, setVideoUrl] = useState<string>("https://www.youtube.com/@ramodavida");

  useEffect(() => {
    fetch("/api/youtube-latest")
      .then((r) => r.json())
      .then((data) => {
        if (data?.video?.url) setVideoUrl(data.video.url);
      })
      .catch(() => {});
  }, []);

  return (
    <TiltCard
      depth={1}
      className="rounded-[20px] overflow-hidden relative group h-full min-h-[240px] transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
    >
      {/* Vídeo com loop nativo */}
      <video
        src="/final.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

      {/* Pulsing play hint */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.8, 0.45, 0.8] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center"
        >
          <Play className="w-6 h-6 fill-white text-white ml-1" />
        </motion.div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-start justify-end h-full text-left p-8 gap-4">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl px-6 py-5 flex flex-col items-start gap-2">
          <p className="font-sans text-white/80 text-[11px] tracking-[0.3em] uppercase font-medium">Ao vivo</p>
          <h3 className="font-sans text-2xl md:text-3xl text-white font-semibold tracking-wide leading-tight">
            Assista nosso último culto
          </h3>
        </div>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full
                     bg-vine-900 border border-vine-800
                     text-white text-sm font-sans font-medium
                     hover:bg-vine-800 transition-all duration-300
                     group/btn"
        >
          <Play className="w-4 h-4 fill-current group-hover/btn:scale-110 transition-transform" />
          Assistir agora
        </a>
      </div>
    </TiltCard>
  );
}

/* --- Devocional Card (video loop) --------------------------------- */
function DevocionalCard() {
  return (
    <TiltCard
      depth={1}
      className="rounded-[20px] overflow-hidden relative group h-full min-h-[240px] transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
    >
      {/* Vídeo com loop nativo */}
      <video
        src="/hero-bg.mp4"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Filtro escuro uniforme + gradient sutil na base */}
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-start justify-end h-full text-left p-8 gap-4">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl px-6 py-5 flex flex-col items-start gap-2">
          <p className="font-sans text-white/80 text-[11px] tracking-[0.3em] uppercase font-medium">Diário</p>
          <h3 className="font-sans text-2xl md:text-3xl text-white font-semibold tracking-wide leading-tight">
            Faça seu devocional diário
          </h3>
        </div>
        <a
          href="/devocional"
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full
                     bg-vine-900 border border-vine-800
                     text-white text-sm font-sans font-medium
                     hover:bg-vine-800 transition-all duration-300
                     group/btn"
        >
          <BookOpen className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
          Ver devocional
        </a>
      </div>
    </TiltCard>
  );
}

/* --- Small info cards --------------------------------------------- */
/* --- Main BentoGrid ----------------------------------------------- */
export default function BentoGrid() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const branchParallax = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    supabase
      .from("avisos")
      .select()
      .eq("visivel_home", true)
      .order("criado_em", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) {
          setAvisos(
            data
              .filter((a) => a.destinatarios === "todos")
              .map((a) => ({
                id: a.id, titulo: a.titulo, conteudo: a.conteudo,
                criadoEm: a.criado_em, destinatarios: a.destinatarios,
                ministerio: a.ministerio,
              }))
          );
        }
      });
  }, []);

  /* stagger container */
  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.15 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
  };

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{
        padding: "10vh 5vw",
        backgroundColor: "#FDFDFB",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='40' height='40' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E\")",
      }}
    >
      {/* Subtle linen grain overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Ramo botânico — canto inferior esquerdo ── */}
      <motion.svg
        aria-hidden="true"
        style={{ y: branchParallax, filter: "blur(3px)" }}
        className="pointer-events-none absolute -left-10 -bottom-10 w-80 h-80 opacity-[0.1] select-none"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Galhos */}
        <path d="M20 190 Q60 140 90 100 Q120 60 100 10" stroke="#276f2a" strokeWidth="2" strokeLinecap="round"/>
        <path d="M90 100 Q65 85 45 60" stroke="#276f2a" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M90 100 Q115 82 130 55" stroke="#276f2a" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M45 60 Q32 45 28 22" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M45 60 Q58 46 65 28" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M130 55 Q145 38 148 18" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M130 55 Q118 38 120 18" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M55 150 Q70 135 82 115" stroke="#276f2a" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M55 150 Q40 132 30 112" stroke="#276f2a" strokeWidth="1.3" strokeLinecap="round"/>
        {/* Folhas nas pontas */}
        <ellipse cx="100" cy="10" rx="4" ry="9" transform="rotate(-15 100 10)" fill="#276f2a" opacity="0.7"/>
        <ellipse cx="28" cy="22" rx="3.5" ry="8" transform="rotate(-30 28 22)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="65" cy="28" rx="3.5" ry="8" transform="rotate(10 65 28)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="148" cy="18" rx="3.5" ry="8" transform="rotate(20 148 18)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="120" cy="18" rx="3.5" ry="8" transform="rotate(-10 120 18)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="82" cy="115" rx="3" ry="7" transform="rotate(35 82 115)" fill="#276f2a" opacity="0.5"/>
        <ellipse cx="30" cy="112" rx="3" ry="7" transform="rotate(-25 30 112)" fill="#276f2a" opacity="0.5"/>
        {/* Folhas nos galhos laterais */}
        <ellipse cx="55" cy="72" rx="3" ry="7" transform="rotate(-40 55 72)" fill="#276f2a" opacity="0.5"/>
        <ellipse cx="118" cy="68" rx="3" ry="7" transform="rotate(30 118 68)" fill="#276f2a" opacity="0.5"/>
        <ellipse cx="75" cy="130" rx="3" ry="7" transform="rotate(20 75 130)" fill="#276f2a" opacity="0.4"/>
        <ellipse cx="35" cy="140" rx="3" ry="7" transform="rotate(-20 35 140)" fill="#276f2a" opacity="0.4"/>
      </motion.svg>

      {/* ── Ramo botânico — canto superior direito ── */}
      <motion.svg
        aria-hidden="true"
        style={{ y: branchParallax, filter: "blur(3px)", scaleY: -1, scaleX: -1 }}
        className="pointer-events-none absolute -right-10 -top-10 w-80 h-80 opacity-[0.1] select-none"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Galhos */}
        <path d="M20 190 Q60 140 90 100 Q120 60 100 10" stroke="#276f2a" strokeWidth="2" strokeLinecap="round"/>
        <path d="M90 100 Q65 85 45 60" stroke="#276f2a" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M90 100 Q115 82 130 55" stroke="#276f2a" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M45 60 Q32 45 28 22" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M45 60 Q58 46 65 28" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M130 55 Q145 38 148 18" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M130 55 Q118 38 120 18" stroke="#276f2a" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M55 150 Q70 135 82 115" stroke="#276f2a" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M55 150 Q40 132 30 112" stroke="#276f2a" strokeWidth="1.3" strokeLinecap="round"/>
        {/* Folhas nas pontas */}
        <ellipse cx="100" cy="10" rx="4" ry="9" transform="rotate(-15 100 10)" fill="#276f2a" opacity="0.7"/>
        <ellipse cx="28" cy="22" rx="3.5" ry="8" transform="rotate(-30 28 22)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="65" cy="28" rx="3.5" ry="8" transform="rotate(10 65 28)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="148" cy="18" rx="3.5" ry="8" transform="rotate(20 148 18)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="120" cy="18" rx="3.5" ry="8" transform="rotate(-10 120 18)" fill="#276f2a" opacity="0.6"/>
        <ellipse cx="82" cy="115" rx="3" ry="7" transform="rotate(35 82 115)" fill="#276f2a" opacity="0.5"/>
        <ellipse cx="30" cy="112" rx="3" ry="7" transform="rotate(-25 30 112)" fill="#276f2a" opacity="0.5"/>
        {/* Folhas nos galhos laterais */}
        <ellipse cx="55" cy="72" rx="3" ry="7" transform="rotate(-40 55 72)" fill="#276f2a" opacity="0.5"/>
        <ellipse cx="118" cy="68" rx="3" ry="7" transform="rotate(30 118 68)" fill="#276f2a" opacity="0.5"/>
        <ellipse cx="75" cy="130" rx="3" ry="7" transform="rotate(20 75 130)" fill="#276f2a" opacity="0.4"/>
        <ellipse cx="35" cy="140" rx="3" ry="7" transform="rotate(-20 35 140)" fill="#276f2a" opacity="0.4"/>
      </motion.svg>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-[#1A1A1A] text-sm md:text-base font-medium tracking-[0.2em] uppercase">
            Se liga nas últimas atualizações
          </p>
        </motion.div>

        {/* Grid: cards empilhados + mural ao lado */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch"
        >
          {/* Coluna esquerda: cards empilhados */}
          <div className="flex flex-col gap-5 h-full">
            <motion.div variants={fadeUp} className="flex-1 min-h-0">
              <LatestCultoCard />
            </motion.div>
            <motion.div variants={fadeUp} className="flex-1 min-h-0">
              <DevocionalCard />
            </motion.div>
          </div>

          {/* Coluna direita: Mural de Avisos */}
          <motion.div
            variants={fadeUp}
            whileHover={{ scale: 1.02, boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex flex-col rounded-[20px] border border-black/[0.05] p-[30px]"
            style={{
              background: "rgba(255,255,255,0.4)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <div className="mb-6 flex items-end justify-between border-b border-black/[0.06] pb-5">
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-[0.45em] text-vine-600">Fique por dentro</p>
                <h2 className="font-sans text-2xl font-semibold leading-none text-vine-900">Mural de Avisos</h2>
              </div>
              <Bell className="h-5 w-5 text-vine-500" />
            </div>

            <ol className="space-y-3 flex-1 overflow-auto">
              {avisos.map((aviso, i) => (
                <motion.li
                  key={aviso.id}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  className="group flex items-start gap-4 rounded-xl border border-black/[0.05] border-l-2 border-l-vine-500 bg-transparent px-5 pl-6 py-4 transition-all duration-300 hover:bg-black/[0.03] cursor-pointer"
                >
                  <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                    <span className="text-sm font-semibold leading-snug text-vine-900">{aviso.titulo}</span>
                    <span className="text-xs leading-5 text-vine-600">{aviso.conteudo}</span>
                    <span className="mt-1 inline-flex w-fit items-center gap-1 font-serif italic text-[11px] text-gray-500">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {formatDate(aviso.criadoEm)}
                    </span>
                  </div>
                </motion.li>
              ))}
              {avisos.length === 0 && (
                <li className="py-6 text-center text-[12px] text-vine-400">Nenhum aviso no momento.</li>
              )}
            </ol>
          </motion.div>
        </motion.div>
      </div>

      {/* Fade de saída */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[#FDFDFB]/60 pointer-events-none z-10" />
    </section>
  );
}
