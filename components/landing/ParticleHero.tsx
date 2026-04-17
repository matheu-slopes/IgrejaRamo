"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

export default function ParticleHero() {
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const contentY       = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
  const contentScale   = useTransform(scrollYProgress, [0, 0.5], [1, 0.92]);
  const hintOpacity    = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  // Auto-scroll nudge: após 10s e a cada 10s, só se estiver no topo
  useEffect(() => {
    function nudge() {
      if (window.scrollY > 80) return; // usuário já scrollou, não interfere

      const start = window.scrollY;
      const distance = 160;
      const duration = 900;
      let startTime: number | null = null;

      function easeInOutQuad(t: number) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      }

      function step(timestamp: number) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 0.5) {
          window.scrollTo(0, start + distance * easeInOutQuad(progress * 2));
        } else {
          window.scrollTo(0, start + distance * (1 - easeInOutQuad((progress - 0.5) * 2)));
        }

        if (progress < 1) requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
    }

    const first = setTimeout(nudge, 10000);
    const interval = setInterval(nudge, 10000);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  const fadeUp = (delay: number) => ({
    initial:    { opacity: 0, y: 24 },
    animate:    { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
  });

  return (
    <section ref={sectionRef} className="relative h-screen overflow-hidden">
      <div className="h-screen overflow-hidden bg-black flex items-center justify-center">

        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover scale-105 blur-sm"
        >
          <source src="/0416.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        {/* Central content */}
        <motion.div
          style={{ y: contentY, opacity: contentOpacity, scale: contentScale }}
          className="relative z-10 flex flex-col items-center select-none"
        >
          {/* Layout horizontal: logo à esquerda, nome + versículo à direita */}
          <motion.div
            {...fadeUp(0.2)}
            className="flex items-center gap-8 px-6"
          >
            {/* Logo */}
            <Image
              src="/logo.png"
              alt="Igreja Ramo da Vida"
              width={160}
              height={60}
              priority
              className="w-[110px] md:w-[140px] h-auto shrink-0"
              style={{ filter: "invert(1)", mixBlendMode: "screen" }}
            />

            {/* Divisor */}
            <span className="h-24 w-px bg-white/25 shrink-0" />

            {/* Nome + versículo */}
            <div className="flex flex-col gap-4">
              <motion.h1
                {...fadeUp(0.5)}
                className="font-sans italic text-[clamp(1.3rem,3vw,2rem)] font-light text-white tracking-[0.1em] leading-none"
                style={{ textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}
              >
                Ramo da Vida
              </motion.h1>

              <motion.div {...fadeUp(0.9)} className="flex flex-col gap-2 max-w-md">
                <p
                  className="font-serif text-[clamp(0.95rem,1.8vw,1.2rem)] font-normal text-white leading-[1.8] italic"
                  style={{ textShadow: "0 1px 14px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.75)" }}
                >
                  "Eu sou a videira; vós sois os ramos. Quem permanece em mim e eu nele, esse dá muito fruto."
                </p>
                <span
                  className="text-[11px] tracking-[0.45em] uppercase text-white/65 font-sans font-medium"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}
                >
                  João 15:5
                </span>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          style={{ opacity: hintOpacity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3"
        >
          <span className="text-[10px] tracking-[0.45em] uppercase text-white/35 font-light">
            Descubra mais
          </span>
          {/* Chevrons pulsando em cascata */}
          <div className="flex flex-col items-center gap-0.5">
            {[0, 0.18].map((delay, i) => (
              <motion.svg
                key={i}
                width="18"
                height="10"
                viewBox="0 0 18 10"
                fill="none"
                animate={{ opacity: [0.15, 0.7, 0.15], y: [0, 3, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, delay }}
              >
                <path d="M1 1L9 9L17 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </motion.svg>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
