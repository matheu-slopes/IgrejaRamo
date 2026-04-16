"use client";

import { useRef } from "react";
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

  const fadeUp = (delay: number) => ({
    initial:    { opacity: 0, y: 24 },
    animate:    { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
  });

  return (
    <section ref={sectionRef} className="relative h-[200vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-black flex items-center justify-center">

        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        {/* Central content */}
        <motion.div
          style={{ y: contentY, opacity: contentOpacity, scale: contentScale }}
          className="relative z-10 flex flex-col items-center select-none"
        >
          {/* Logo */}
          <motion.div {...fadeUp(0.2)}>
            <Image
              src="/logo.png"
              alt="Igreja Ramo da Vida"
              width={320}
              height={108}
              priority
              className="w-[220px] md:w-[300px] h-auto"
              style={{ filter: "invert(1)", mixBlendMode: "screen" }}
            />
          </motion.div>

          {/* Church name */}
          <motion.h1
            {...fadeUp(0.9)}
            className="font-sans italic text-[clamp(1.6rem,4.5vw,2.8rem)] font-light text-white/90 tracking-[0.08em]"
          >
            Ramo da Vida
          </motion.h1>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          style={{ opacity: hintOpacity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] tracking-[0.35em] uppercase text-white/30">
            Role para entrar
          </span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="w-5 h-8 border border-white/15 rounded-full flex items-start justify-center pt-1.5"
          >
            <div className="w-1 h-1.5 rounded-full bg-gold-400/60" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
