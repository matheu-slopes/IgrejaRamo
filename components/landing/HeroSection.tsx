import Image from "next/image";
import Link from "next/link";
import { ArrowDown } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden bg-vine-950">

      {/* Fundos orgânicos */}
      <div className="absolute -top-40 -left-40 w-[560px] h-[560px] bg-vine-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] bg-grape-900/15 rounded-full blur-3xl pointer-events-none" />

      {/* Textura de pontos discreta */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      {/* Conteúdo principal */}
      <div className="relative z-10 flex flex-col items-center select-none">

        {/* Logo PNG */}
        <div className="hero-t1 mb-10">
          <Image
            src="/logo.png"
            alt="Igreja Ramo da Vida"
            width={260}
            height={88}
            priority
            className="w-[180px] md:w-[240px] h-auto"
            style={{ filter: "invert(1)", mixBlendMode: "screen" }}
          />
        </div>

        {/* Divisor com losango */}
        <div className="hero-t2 flex items-center gap-3 mb-9">
          <div className="w-20 h-px bg-gradient-to-r from-transparent to-gold-600/50" />
          <div className="w-2 h-2 rotate-45 bg-gold-500" aria-hidden="true" />
          <div className="w-20 h-px bg-gradient-to-l from-transparent to-gold-600/50" />
        </div>

        {/* Passagem bíblica */}
        <div className="hero-t3 max-w-xs mx-auto space-y-1.5">
          <p className="font-serif italic text-[1.15rem] text-vine-200/90 leading-relaxed">
            "Eu sou a videira; vós sois os ramos."
          </p>
          <span className="block text-[11px] tracking-[0.25em] text-gold-500/80 uppercase">
            João 15:5
          </span>
        </div>

        {/* CTAs */}
        <div className="hero-t4 flex flex-col sm:flex-row items-center justify-center gap-4 mt-11">
          <a
            href="#cultos"
            className="bg-gold-500 text-vine-950 font-semibold px-9 py-3.5 rounded-full
                       shadow-[0_4px_24px_0_rgba(212,154,18,0.35)]
                       hover:bg-gold-400 transition-colors text-[14px] tracking-wide"
          >
            Programação
          </a>
          <Link
            href="/login"
            className="border border-white/20 text-white/85 font-medium px-9 py-3.5 rounded-full
                       hover:bg-white/[0.07] hover:border-white/35 transition text-[14px] tracking-wide"
          >
            Entrar
          </Link>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="hero-t5 absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-vine-600 animate-bounce">
        <ArrowDown className="w-4 h-4" />
        <span className="text-[10px] tracking-[0.3em] uppercase">Role</span>
      </div>
    </section>
  );
}
