import Link from "next/link";
import Image from "next/image";

export default function ImmersiveFooter() {
  return (
    <footer className="bg-[#040804] text-vine-500 pt-16 pb-8 px-6 border-t border-white/[0.04]">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-10 border-b border-white/[0.04]">
          <div className="flex flex-col items-center md:items-start gap-4">
            <Image
              src="/logo.png"
              alt="Igreja Ramo da Vida"
              width={140}
              height={47}
              className="h-10 w-auto"
              style={{ filter: "invert(1)", mixBlendMode: "screen" }}
            />
            <p className="font-sans italic text-vine-600 text-sm max-w-[240px] leading-relaxed text-center md:text-left">
              "Eu sou a videira; vós sois os ramos."
              <span className="block not-italic text-vine-700 text-xs mt-1">— João 15:5</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[12px] text-vine-600">
            <a href="#discover" className="hover:text-white transition-colors">Descubra</a>
            <a href="#cultos" className="hover:text-white transition-colors">Cultos</a>
            <a href="#quem-somos" className="hover:text-white transition-colors">Quem Somos</a>
            <a href="#galeria" className="hover:text-white transition-colors">Galeria</a>
            <a href="#localizacao" className="hover:text-white transition-colors">Localização</a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-xs text-vine-700">
          <p>&copy; {new Date().getFullYear()} Igreja Ramo da Vida — Campinas, SP</p>
          <Link href="/login" className="text-vine-600 hover:text-gold-400 transition font-medium">
            Área do Voluntário →
          </Link>
        </div>
      </div>
    </footer>
  );
}
