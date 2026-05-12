"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

const links = [
  { href: "#discover",    label: "Descubra"     },
  { href: "#cultos",      label: "Cultos"       },
  { href: "#quem-somos",  label: "Quem Somos"   },
  { href: "#avisos",      label: "Mural"        },
  { href: "#localizacao", label: "Localização"  },
];

export default function ImmersiveNav() {
  const { scrollYProgress } = useScroll();
  // Background appears after scrolling
  const bgOpacity = useTransform(scrollYProgress, [0.05, 0.12], [0, 1]);

  return (
    <header className="fixed top-0 inset-x-0 z-50" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto mt-4 max-w-5xl px-4">
        <nav className="relative flex items-center justify-between rounded-2xl px-5 py-3">
          {/* Background layer — fades in on scroll */}
          <motion.div
            style={{ opacity: bgOpacity }}
            className="absolute inset-0 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.06] shadow-2xl shadow-black/30"
          />
          <Link href="/" className="relative z-10 shrink-0">
            <Image
              src="/logo.png"
              alt="Igreja Ramo da Vida"
              width={120}
              height={40}
              className="h-7 w-auto"
              style={{ filter: "invert(1)", mixBlendMode: "screen" }}
            />
          </Link>

          <div className="relative z-10 hidden md:flex items-center gap-6">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[12px] text-white/90 hover:text-white transition-colors duration-200 tracking-wide"
              >
                {l.label}
              </a>
            ))}
          </div>

          <Link
            href="/login"
            className="relative z-10 text-[11px] font-semibold text-white border border-white/40 rounded-full px-4 py-1.5
                       hover:bg-white/10 transition-all duration-200"
          >
            Área do Voluntário
          </Link>
        </nav>
      </div>
    </header>
  );
}
