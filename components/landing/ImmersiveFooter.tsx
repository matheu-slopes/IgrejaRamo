import Link from "next/link";

export default function ImmersiveFooter() {
  return (
    <footer className="relative text-gray-100 pt-28 pb-12 md:pt-32 md:pb-16 px-4 md:px-6 overflow-hidden">
      {/* Vídeo de fundo */}
      <video
        src="/hero-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "brightness(0.75)", objectPosition: "50% 32%" }}
      />
      {/* Overlay escuro adicional */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto -translate-y-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 pb-8 md:pb-10 border-b border-gray-100/20">
          <div className="flex flex-col items-center md:items-start gap-2">
            <p className="font-serif text-2xl md:text-3xl font-bold text-white tracking-wide">Igreja Ramo da Vida</p>
            <p className="font-sans italic text-white/80 text-base max-w-[320px] leading-relaxed text-center md:text-left">
              "Eu sou a videira; vós sois os ramos."
              <span className="block not-italic text-white/60 text-sm mt-1">— João 15:5</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-[13px] md:text-[15px] font-semibold text-white/80">
            <a href="#discover" className="hover:text-white transition-colors">Descubra</a>
            <a href="#cultos" className="hover:text-white transition-colors">Cultos</a>
            <a href="#quem-somos" className="hover:text-white transition-colors">Quem Somos</a>
            <a href="#localizacao" className="hover:text-white transition-colors">Localização</a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-xs text-white/50">
          <p>&copy; {new Date().getFullYear()} Igreja Ramo da Vida — Campinas, SP</p>
          <Link href="/login" className="text-white/50 hover:text-gold-400 transition font-medium">
            Área do Voluntário →
          </Link>
        </div>
      </div>
    </footer>
  );
}
