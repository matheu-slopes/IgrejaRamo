"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import MaskRevealText from "./MaskRevealText";

export default function ScrollyQuemSomos() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Background gradient shift �?" vine-50 �?' vine-100 �?' bark-50 �?' vine-50
  const bg1 = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    ["#ffffff", "#ffffff", "#ffffff", "#ffffff"]
  );

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      {/* Animated background */}
      <motion.div className="absolute inset-0 z-0" style={{ backgroundColor: bg1 }} />

      {/* -- Part 1: Giant text reveal ----------------------------------- */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="max-w-5xl mx-auto text-center py-32">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-vine-600 text-[11px] tracking-[0.4em] uppercase mb-10"
          >
            Nossa história
          </motion.p>

          <MaskRevealText
            wordColor="text-vine-900"
            text="Nascidos do coração de Deus para manifestar o caráter de Cristo"
          />

          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mx-auto mt-10 w-16 h-px bg-gray-200 origin-center"
          />
        </div>
      </div>

      {/* -- Part 2: Story paragraphs ------------------------------------ */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 pb-32 space-y-12">
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="text-vine-800 text-lg md:text-xl leading-relaxed"
        >
          A comunidade cristã <strong className="text-vine-950">Ramo da Vida</strong> se manifesta
          através da comunhão nos cultos, em ações sociais e no testemunho pessoal e coletivo
          de seus membros, líderes e simpatizantes do mesmo propósito.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-vine-800 text-lg md:text-xl leading-relaxed"
        >
          Nosso intuito e missão é manifestar o caráter de Cristo, seu amor, ensino e exemplo
          de maneira simples, prática e verdadeira, a fim de pregar a salvação por meio da fé
          até que <strong className="text-vine-950">ELE venha!</strong>
        </motion.p>

        {/* Quote block */}
        <motion.blockquote
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8 }}
          className="border-l-2 border-gray-300 pl-6 py-4"
        >
          <p className="font-sans italic text-2xl md:text-3xl text-vine-900 leading-relaxed">
            "Eu sou a videira; vós sois os ramos. Quem permanece em mim e eu nele,
            esse dá muito fruto."
          </p>
          <span className="block text-vine-600 text-[11px] tracking-[0.2em] uppercase mt-4">
            �?" João 15:5
          </span>
        </motion.blockquote>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8"
        >
          {[
            { n: "2019", l: "Fundação" },
            { n: "6", l: "Ministérios" },
            { n: "6�-", l: "Cultos / semana" },
            { n: "�^z", l: "Amor" },
          ].map((s) => (
            <div
              key={s.l}
              className="bg-white border border-gray-200 rounded-2xl p-5 text-center
                         hover:border-gray-300 transition-colors duration-500"
            >
              <p className="font-sans text-3xl font-bold text-vine-700">{s.n}</p>
              <p className="text-vine-600 text-xs tracking-wider mt-1">{s.l}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
