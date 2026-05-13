"use client";

import { motion } from "framer-motion";

// Ramo decorativo naturalista com folhas e frutinhos
function LeafDecor({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Galho principal */}
      <path
        d="M80 210 C78 180 72 155 65 130 C58 105 48 85 42 60 C36 38 38 18 50 10"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.55"
      />
      {/* Sub-galho direito inferior */}
      <path
        d="M65 130 C78 122 92 118 105 108"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"
      />
      {/* Sub-galho esquerdo inferior */}
      <path
        d="M68 148 C55 140 46 132 38 120"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"
      />
      {/* Sub-galho direito m�dio */}
      <path
        d="M55 105 C67 95 80 90 90 80"
        stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.4"
      />
      {/* Sub-galho esquerdo m�dio */}
      <path
        d="M52 88 C40 80 30 70 26 56"
        stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.4"
      />
      {/* Sub-galho topo */}
      <path
        d="M46 62 C56 52 68 45 74 32"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4"
      />

      {/* Folha 1 � direita inferior */}
      <ellipse cx="108" cy="104" rx="13" ry="7" transform="rotate(-30 108 104)" fill="currentColor" opacity="0.22"/>
      {/* Folha 2 � esquerda inferior */}
      <ellipse cx="35" cy="117" rx="12" ry="6.5" transform="rotate(20 35 117)" fill="currentColor" opacity="0.22"/>
      {/* Folha 3 � direita m�dio */}
      <ellipse cx="93" cy="76" rx="13" ry="6.5" transform="rotate(-40 93 76)" fill="currentColor" opacity="0.20"/>
      {/* Folha 4 � esquerda m�dio */}
      <ellipse cx="23" cy="53" rx="11" ry="6" transform="rotate(15 23 53)" fill="currentColor" opacity="0.20"/>
      {/* Folha 5 � topo */}
      <ellipse cx="76" cy="28" rx="10" ry="5.5" transform="rotate(-50 76 28)" fill="currentColor" opacity="0.20"/>
      {/* Folha 6 � topo direita */}
      <ellipse cx="56" cy="16" rx="9" ry="5" transform="rotate(-20 56 16)" fill="currentColor" opacity="0.18"/>

      {/* Frutinhos � bolinhas vermelhas */}
      <circle cx="64" cy="132" r="3.5" fill="#C0392B" opacity="0.7"/>
      <circle cx="60" cy="125" r="2.5" fill="#C0392B" opacity="0.5"/>
      <circle cx="70" cy="120" r="2"   fill="#C0392B" opacity="0.4"/>
    </svg>
  );
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" } as const,
  transition: { duration: 0.65, delay, ease: "easeOut" as const },
});

export default function ScrollyQuemSomos() {
  return (
    <section id="quem-somos" className="bg-[#F5F1EB] py-16 px-4 md:py-24 md:px-6">
      <div className="max-w-5xl mx-auto space-y-20">

        {/* -- 1. T�tulo + par�grafo  |  Foto da comunidade --------------- */}
        <motion.div
          {...fadeUp(0)}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center"
        >
          {/* Texto */}
          <div>
            <h2 className="font-sans text-3xl md:text-5xl font-bold text-black leading-tight mb-5">
              Nossa História:<br />Uma Comunidade Viva
            </h2>
            <p className="text-gray-900/75 text-base leading-relaxed">
              Nascidos do coração de Deus para manifestar o caráter de Cristo, a comunidade cristã{" "}
              <strong className="text-black font-bold">Ramo da Vida</strong> se manifesta através da
              comunhão nos cultos, em ações sociais e no testemunho pessoal e coletivo de seus membros,
              líderes e simpatizantes do mesmo propósito.
            </p>
          </div>

          {/* V�deo em loop */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md bg-gray-200/40 w-full">
            <video
              src="/nossa_historia.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover scale-125"
            />
          </div>
        </motion.div>

        {/* -- 2. Citação — João 15:5 com folhas decorativas --------------- */}
        <motion.div
          {...fadeUp(0.08)}
          className="relative rounded-3xl bg-[#E8E0D2] px-6 py-12 md:px-10 md:py-16 text-center overflow-hidden"
        >
          {/* Folhas decorativas */}
          <LeafDecor className="absolute -bottom-4 -left-2 w-36 text-gray-900 rotate-12" />
          <LeafDecor className="absolute -top-4 -right-2 w-36 text-gray-900 -rotate-12 scale-x-[-1] scale-y-[-1]" />

          <p className="relative z-10 font-sans italic text-xl md:text-3xl text-black leading-relaxed max-w-2xl mx-auto">
            "Eu sou a videira; vós sois os ramos.{" "}
            <br className="hidden md:block" />
            Quem permanece em mim e eu nele, esse dá muito fruto."
          </p>
          <div className="mx-auto mt-7 w-8 h-px bg-gray-400/60 relative z-10" />
          <span className="relative z-10 block text-gray-600 text-[10px] tracking-[0.4em] uppercase mt-5">
            João 15:5
          </span>
        </motion.div>

      </div>
    </section>
  );
}
