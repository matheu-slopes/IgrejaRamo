"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { Play, BookOpen } from "lucide-react";

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
      className="rounded-3xl overflow-hidden relative group min-h-[400px]"
      lens="Assista o culto"
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

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
      className="rounded-3xl overflow-hidden relative group min-h-[400px]"
      lens="Devocional"
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
  return (
    <section className="relative py-28 px-5 overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gray-100/30 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gray-100/20 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-gray-100/20 rounded-full blur-[90px] pointer-events-none" />

      {/* Dot grid pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Watermark verse */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none"
      >
        <p className="font-serif text-[clamp(3.5rem,10vw,8rem)] font-bold text-gray-400/[0.08] leading-tight text-center px-8 whitespace-nowrap">
          João 15:5
        </p>
      </div>

      {/* Diagonal accent lines */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.1] select-none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <line x1="0" y1="100%" x2="40%" y2="0" stroke="#d1d5db" strokeWidth="1"/>
        <line x1="20%" y1="100%" x2="65%" y2="0" stroke="#d1d5db" strokeWidth="0.5"/>
        <line x1="60%" y1="100%" x2="100%" y2="20%" stroke="#d1d5db" strokeWidth="1"/>
        <line x1="80%" y1="100%" x2="100%" y2="60%" stroke="#d1d5db" strokeWidth="0.5"/>
      </svg>

      {/* Ramos �?" fundo completo */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full select-none opacity-[0.15]"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* canto inf esq */}
        <g transform="translate(-20, 620) rotate(-15)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M65 45 Q52 30 46 12" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M65 45 Q78 32 85 16" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M40 150 Q55 135 70 118" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M40 150 Q28 133 20 114" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
        </g>
        {/* canto sup dir */}
        <g transform="translate(1080, 20) rotate(160)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M65 45 Q52 30 46 12" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M65 45 Q78 32 85 16" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
        </g>
        {/* lateral esq centro */}
        <g transform="translate(-30, 320) rotate(25)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="1" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M145 10 Q162 2 175 -12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
        </g>
        {/* lateral dir centro */}
        <g transform="translate(1100, 260) rotate(-35)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="1" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M65 45 Q52 30 46 12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
        </g>
        {/* centro absoluto */}
        <g transform="translate(540, 280) rotate(50)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="1.1" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M65 45 Q52 30 46 12" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M65 45 Q78 32 85 16" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M145 10 Q162 2 175 -12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
        </g>
        {/* quarto sup esq */}
        <g transform="translate(230, 80) rotate(-55)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="1" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M145 10 Q162 2 175 -12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
        </g>
        {/* quarto inf dir */}
        <g transform="translate(850, 580) rotate(115)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="1" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M65 45 Q52 30 46 12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
        </g>
        {/* topo centro */}
        <g transform="translate(560, -40) rotate(88)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="1" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M145 10 Q162 2 175 -12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
          <path d="M65 45 Q52 30 46 12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
        </g>
        {/* base centro */}
        <g transform="translate(580, 780) rotate(-92)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="1" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.8" strokeLinecap="round"/>
          <path d="M145 10 Q162 2 175 -12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
        </g>
        {/* quarto sup dir */}
        <g transform="translate(920, 100) rotate(70)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
        </g>
        {/* quarto inf esq */}
        <g transform="translate(180, 620) rotate(-110)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M65 45 Q52 30 46 12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
        </g>
        {/* centro esq baixo */}
        <g transform="translate(360, 480) rotate(135)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
        </g>
        {/* centro dir cima */}
        <g transform="translate(780, 200) rotate(-20)">
          <path d="M20 180 Q60 120 110 90 Q160 60 145 10" stroke="#d1d5db" strokeWidth="0.9" strokeLinecap="round"/>
          <path d="M110 90 Q85 70 65 45" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M110 90 Q135 72 150 48" stroke="#d1d5db" strokeWidth="0.7" strokeLinecap="round"/>
          <path d="M145 10 Q162 2 175 -12" stroke="#d1d5db" strokeWidth="0.6" strokeLinecap="round"/>
        </g>
      </svg>

      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-vine-700 text-sm md:text-base font-semibold tracking-[0.45em] uppercase">
            Culto & Devocional
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* -- Card 1: Assista nosso ultimo culto ---- */}
          <LatestCultoCard />

          {/* -- Card 2: Devocional Diario (video loop) ---- */}
          <DevocionalCard />
        </div>
      </div>

      {/* Fade de saída: funde os cards escuros com a seção seguinte */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[#F7F2EA]/60 pointer-events-none z-10" />
    </section>
  );
}
