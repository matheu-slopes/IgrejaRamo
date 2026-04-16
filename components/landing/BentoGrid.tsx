"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { Play, BookOpen } from "lucide-react";

/* ─── Tilt card component ───────────────────────────────────────── */
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

/* ─── Latest Culto Card ─────────────────────────────────────────── */
function LatestCultoCard() {
  const [video, setVideo] = useState<{ title: string; url: string; thumbnail: string } | null>(null);

  useEffect(() => {
    fetch("/api/youtube-latest")
      .then((r) => r.json())
      .then((d) => d.video && setVideo(d.video))
      .catch(() => {});
  }, []);

  const href = video?.url ?? "https://www.youtube.com/@ramodavida";
  const bgImage = video?.thumbnail;

  return (
    <TiltCard
      depth={1}
      className="rounded-3xl overflow-hidden relative group min-h-[400px]"
      lens="Assista o culto"
    >
      {/* Background: thumbnail do vídeo ou fallback */}
      {bgImage ? (
        <Image
          src={bgImage}
          alt="Último culto"
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-vine-950" />
      )}

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
          href={href}
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

/* ─── Devocional Card (vídeo loop) ───────────────────────────────── */
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

/* ─── Main BentoGrid ────────────────────────────────────────────── */
export default function BentoGrid() {
  return (
    <section className="relative py-28 px-5 bg-[#0a140a] overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-vine-800/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gold-900/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        {/* Section label */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-gold-500/70 text-[11px] tracking-[0.4em] uppercase text-center mb-16"
        >
          Descubra
        </motion.p>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* ── Card 1: Assista nosso último culto ──── */}
          <LatestCultoCard />

          {/* ── Card 2: Devocional Diário (vídeo loop) ──── */}
          <DevocionalCard />
        </div>
      </div>
    </section>
  );
}
