import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="bg-vine-950 text-vine-400 pt-14 pb-8 px-6">
      <div className="max-w-5xl mx-auto">

        {/* Top row */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 pb-10 border-b border-vine-900">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Image
              src="/logo.png"
              alt="Igreja Ramo da Vida"
              width={160}
              height={54}
              className="h-11 w-auto"
              style={{ filter: "invert(1)", mixBlendMode: "screen" }}
            />
            <p className="font-serif italic text-vine-500 text-sm max-w-[220px] leading-relaxed">
              "Eu sou a videira; vós sois os ramos."
              <span className="block not-italic text-vine-600 text-xs mt-1">— João 15:5</span>
            </p>
          </div>

          {/* Info columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-white font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gold-500" /> Endereço
              </p>
              <p className="leading-relaxed">
                R. Fernão Pompeu de Camargo, 1293<br />
                Jardim do Trevo — Campinas, SP<br />
                CEP 13040-010
              </p>
            </div>
            <div>
              <p className="text-white font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold-500" /> Cultos
              </p>
              <ul className="space-y-1 leading-relaxed">
                <li>Segunda — Oração 20h</li>
                <li>1ª Terça — Mulheres 19h30</li>
                <li>2ª Terça — Ensino 19h45</li>
                <li>Quinta — Culto 20h</li>
                <li>Sábado — Jovens 19h30</li>
                <li className="text-white font-semibold">Domingo — 18h30</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-xs text-vine-600">
          <p>&copy; {new Date().getFullYear()} Igreja Ramo da Vida — Campinas, SP</p>
          <Link href="/login" className="text-vine-500 hover:text-gold-400 transition font-medium">
            Área do Voluntário →
          </Link>
        </div>
      </div>
    </footer>
  );
}

