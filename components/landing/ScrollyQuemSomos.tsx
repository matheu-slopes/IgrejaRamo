"use client";

import { motion } from "framer-motion";
import { Calendar, Users2, Sprout, Heart } from "lucide-react";

// -- M�tricas � edite conforme necess�rio -------------------------------------
const metrics = [
  { numero: "2019", label: "Fundação e\nPrimeiros Passos",         icon: Calendar },
  { numero: "6",    label: "Ministérios Ativos\ne Diversificados", icon: Users2   },
  { numero: "6+",   label: "Cultos\nSemanais",                     icon: Sprout   },
  { numero: "8",    label: "Amor Incondicional\ne Serviço",        icon: Heart    },
];

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

        {/* -- 2. M�tricas � timeline horizontal com videira decorativa --- */}
        <motion.div {...fadeUp(0.05)}>
          <h3 className="font-sans text-2xl font-bold text-black mb-10">
            Nosso Impacto e Trajetória
          </h3>

          {/* Container relativo para a videira de fundo */}
          <div className="relative py-10">

            {/* Videira SVG de fundo � full width */}
            <svg
              viewBox="0 0 1000 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
            >
              {/* Caule principal horizontal */}
              <path d="M0 100 Q250 80 500 100 Q750 120 1000 100"
                stroke="#8B9E7A" strokeWidth="1.2" opacity="0.35" fill="none"/>

              {/* Pontas decorativas nas extremidades */}
              <path d="M8 100 L0 96 M8 100 L0 104" stroke="#8B9E7A" strokeWidth="1.2" opacity="0.5" strokeLinecap="round"/>
              <path d="M992 100 L1000 96 M992 100 L1000 104" stroke="#8B9E7A" strokeWidth="1.2" opacity="0.5" strokeLinecap="round"/>
              <circle cx="0" cy="100" r="3" fill="#8B9E7A" opacity="0.4"/>
              <circle cx="1000" cy="100" r="3" fill="#8B9E7A" opacity="0.4"/>

              {/* Voluta esquerda */}
              <path d="M120 100 C130 70 160 55 180 65 C200 75 195 100 175 105 C155 110 145 90 160 82"
                stroke="#8B9E7A" strokeWidth="1" opacity="0.3" fill="none"/>
              <ellipse cx="148" cy="60" rx="10" ry="5.5" transform="rotate(-35 148 60)" fill="#8B9E7A" opacity="0.18"/>
              <ellipse cx="175" cy="52" rx="9"  ry="5"   transform="rotate(-10 175 52)" fill="#8B9E7A" opacity="0.18"/>
              <ellipse cx="198" cy="68" rx="10" ry="5"   transform="rotate(20 198 68)"  fill="#8B9E7A" opacity="0.18"/>
              <ellipse cx="165" cy="120" rx="9" ry="4.5" transform="rotate(10 165 120)" fill="#8B9E7A" opacity="0.16"/>
              <ellipse cx="132" cy="118" rx="8" ry="4"   transform="rotate(-15 132 118)" fill="#8B9E7A" opacity="0.16"/>

              {/* Voluta centro-esquerda */}
              <path d="M340 100 C350 130 375 148 395 138 C415 128 408 105 390 100 C372 95 368 118 382 122"
                stroke="#8B9E7A" strokeWidth="1" opacity="0.28" fill="none"/>
              <ellipse cx="370" cy="148" rx="9"  ry="5"   transform="rotate(20 370 148)"  fill="#8B9E7A" opacity="0.16"/>
              <ellipse cx="395" cy="155" rx="10" ry="5.5" transform="rotate(5 395 155)"   fill="#8B9E7A" opacity="0.16"/>
              <ellipse cx="415" cy="138" rx="9"  ry="4.5" transform="rotate(-20 415 138)" fill="#8B9E7A" opacity="0.16"/>
              <ellipse cx="360" cy="88"  rx="8"  ry="4"   transform="rotate(-10 360 88)"  fill="#8B9E7A" opacity="0.14"/>

              {/* Voluta centro */}
              <path d="M500 100 C510 72 535 58 555 68 C575 78 568 102 550 106 C532 110 525 90 538 83"
                stroke="#8B9E7A" strokeWidth="1" opacity="0.3" fill="none"/>
              <ellipse cx="530" cy="55" rx="10" ry="5.5" transform="rotate(-30 530 55)" fill="#8B9E7A" opacity="0.18"/>
              <ellipse cx="556" cy="50" rx="9"  ry="5"   transform="rotate(-5 556 50)"  fill="#8B9E7A" opacity="0.18"/>
              <ellipse cx="578" cy="65" rx="10" ry="5"   transform="rotate(18 578 65)"  fill="#8B9E7A" opacity="0.18"/>
              <ellipse cx="518" cy="115" rx="8" ry="4"   transform="rotate(8 518 115)"  fill="#8B9E7A" opacity="0.14"/>

              {/* Voluta centro-direita */}
              <path d="M660 100 C670 132 694 150 714 140 C734 130 727 106 710 101 C692 96 690 120 703 123"
                stroke="#8B9E7A" strokeWidth="1" opacity="0.28" fill="none"/>
              <ellipse cx="690" cy="152" rx="9"  ry="5"   transform="rotate(22 690 152)"  fill="#8B9E7A" opacity="0.16"/>
              <ellipse cx="714" cy="158" rx="10" ry="5.5" transform="rotate(6 714 158)"   fill="#8B9E7A" opacity="0.16"/>
              <ellipse cx="734" cy="140" rx="9"  ry="4.5" transform="rotate(-18 734 140)" fill="#8B9E7A" opacity="0.16"/>

              {/* Voluta direita */}
              <path d="M840 100 C850 70 878 55 898 66 C918 77 910 102 893 107 C875 112 870 89 884 82"
                stroke="#8B9E7A" strokeWidth="1" opacity="0.3" fill="none"/>
              <ellipse cx="870" cy="52" rx="10" ry="5.5" transform="rotate(-32 870 52)" fill="#8B9E7A" opacity="0.18"/>
              <ellipse cx="896" cy="48" rx="9"  ry="5"   transform="rotate(-8 896 48)"  fill="#8B9E7A" opacity="0.18"/>
              <ellipse cx="918" cy="63" rx="10" ry="5"   transform="rotate(17 918 63)"  fill="#8B9E7A" opacity="0.18"/>
              <ellipse cx="855" cy="118" rx="8" ry="4"   transform="rotate(10 855 118)" fill="#8B9E7A" opacity="0.14"/>
            </svg>

            {/* Linha horizontal s�lida centralizada */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gray-300/40" />

            {/* Itens da timeline */}
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-y-8 md:gap-y-0">
              {metrics.map(({ numero, label, icon: Icon }, i) => (
                <div key={label} className="flex flex-col items-center text-center px-4 gap-2">
                  {/* N�mero acima da linha */}
                  <p className="font-sans text-[2.4rem] md:text-[3.2rem] font-bold text-black leading-none tracking-tight mb-3">
                    {numero}
                  </p>

                  {/* Ponto na linha */}
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-400/60 border-2 border-gray-300/60 z-10 shrink-0" />

                  {/* �cone + label abaixo da linha */}
                  <Icon className="w-5 h-5 text-gray-600 mt-2" strokeWidth={1.5} />
                  <p className="text-gray-900 text-[11px] leading-snug whitespace-pre-line mt-0.5">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* -- 3. Cita��o � João 15:5 com folhas decorativas --------------- */}
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
