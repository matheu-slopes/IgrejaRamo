"use client";

import Image from "next/image";
import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import CountdownBadge from "./CountdownBadge";

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const glowRef    = useRef<HTMLSpanElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Parallax: orbs se movem mais rápido, conteúdo mais devagar ? profundidade
  const contentY = useTransform(scrollYProgress, [0, 1], [0,  -60]);
  const orb1Y    = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const orb2Y    = useTransform(scrollYProgress, [0, 1], [0,  -90]);

  // Posiciona o brilho do botão sob o cursor
  function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!glowRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    glowRef.current.style.left = `${e.clientX - rect.left}px`;
    glowRef.current.style.top  = `${e.clientY - rect.top}px`;
  }

  // Atalho para animação de entrada escalonada
  const fadeUp = (delay: number) => ({
    initial:    { opacity: 0, y: 24 },
    animate:    { opacity: 1, y: 0  },
    transition: { duration: 0.75, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
  });

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden bg-vine-950"
    >
      {/* Orbs com parallax */}
      <motion.div
        style={{ y: orb1Y }}
        className="absolute -top-40 -left-40 w-[560px] h-[560px] bg-vine-700/20 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        style={{ y: orb2Y }}
        className="absolute -bottom-32 -right-32 w-[480px] h-[480px] bg-grape-900/15 rounded-full blur-3xl pointer-events-none"
      />

      {/* Textura de pontos */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      {/* Conteúdo principal com parallax suave */}
      <motion.div
        style={{ y: contentY }}
        className="relative z-10 flex flex-col items-center select-none"
      >
        {/* Logo */}
        <motion.div {...fadeUp(0)} className="mb-10">
          <Image
            src="/logo.png"
            alt="Igreja Ramo da Vida"
            width={260}
            height={88}
            priority
            className="w-[180px] md:w-[240px] h-auto"
            style={{ filter: "invert(1)", mixBlendMode: "screen" }}
          />
        </motion.div>

        {/* Divisor com losango */}
        <motion.div {...fadeUp(0.25)} className="flex items-center gap-3 mb-9">
          <div className="w-20 h-px bg-gradient-to-r from-transparent to-gold-600/50" />
          <div className="w-2 h-2 rotate-45 bg-gold-500" aria-hidden="true" />
          <div className="w-20 h-px bg-gradient-to-l from-transparent to-gold-600/50" />
        </motion.div>

        {/* Passagem bíblica */}
        <motion.div {...fadeUp(0.45)} className="max-w-xs mx-auto space-y-1.5">
          <p className="font-sans italic text-[1.15rem] text-vine-200/90 leading-relaxed">
            "Eu sou a videira; vós sois os ramos."
          </p>
          <span className="block text-[11px] tracking-[0.25em] text-gold-500/80 uppercase">
            João 15:5
          </span>
        </motion.div>

        {/* Contador regressivo para o próximo culto */}
        <motion.div {...fadeUp(0.65)} className="mt-8">
          <CountdownBadge />
        </motion.div>

        {/* CTA com glow que segue o mouse */}
        <motion.div {...fadeUp(0.85)} className="mt-6">
          <a
            href="#cultos"
            onMouseMove={handleMouseMove}
            className="relative overflow-hidden inline-flex items-center
                       bg-gold-500 text-vine-950 font-semibold px-9 py-3.5 rounded-full
                       shadow-[0_4px_24px_0_rgba(212,154,18,0.35)]
                       hover:shadow-[0_4px_44px_0_rgba(212,154,18,0.7)]
                       transition-shadow duration-300 text-[14px] tracking-wide group"
          >
            {/* Glow spot que segue o cursor */}
            <span
              ref={glowRef}
              className="absolute w-28 h-28 -translate-x-1/2 -translate-y-1/2 rounded-full
                         bg-white/30 blur-2xl pointer-events-none
                         opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            />
            Programação
          </a>
        </motion.div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-vine-600 animate-bounce"
      >
        <ArrowDown className="w-4 h-4" />
        <span className="text-[10px] tracking-[0.3em] uppercase">Role</span>
      </motion.div>
    </section>
  );
}
