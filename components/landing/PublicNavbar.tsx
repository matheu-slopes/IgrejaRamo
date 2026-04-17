"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import clsx from "clsx";

const links = [
  { href: "#cultos",      label: "Cultos"       },
  { href: "#avisos",      label: "Programação"  },
  { href: "#galeria",     label: "Galeria"      },
  { href: "#quem-somos",  label: "Quem Somos"   },
  { href: "#localizacao", label: "Localização"  },
];

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100"
          : "bg-transparent"
      )}
    >
      <div className="max-w-6xl mx-auto px-5 flex items-center justify-between h-[68px]">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Igreja Ramo da Vida"
            width={160}
            height={54}
            className="h-9 w-auto"
            style={scrolled
              ? { mixBlendMode: "multiply" }
              : { filter: "invert(1)", mixBlendMode: "screen" }
            }
          />
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={clsx(
                "text-[13px] font-medium transition-colors duration-200 relative",
                "after:absolute after:-bottom-0.5 after:left-0 after:w-0 after:h-[1.5px]",
                "after:bg-gold-500 after:transition-all after:duration-300 hover:after:w-full",
                scrolled
                  ? "text-gray-600 hover:text-vine-800"
                  : "text-white/75 hover:text-white"
              )}
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            className={clsx(
              "text-[13px] font-semibold px-5 py-2 rounded-full border transition-all duration-200",
              scrolled
                ? "border-vine-700 text-vine-700 hover:bg-vine-700 hover:text-white"
                : "border-white/30 text-white hover:bg-white/10 hover:border-white/50"
            )}
          >
            Entrar
          </Link>
        </nav>

        <button
          className={clsx("md:hidden transition-colors duration-200", scrolled ? "text-vine-900" : "text-white")}
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-5 pb-5 pt-3 flex flex-col gap-3.5">
          {links.map((l) => (
            <a key={l.href} href={l.href}
              className="text-[14px] text-gray-700 font-medium hover:text-vine-700 transition py-0.5"
              onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link href="/login"
            className="mt-1 bg-vine-800 text-white text-sm font-semibold px-4 py-2.5 rounded-full text-center hover:bg-vine-700 transition"
            onClick={() => setOpen(false)}>
            Entrar
          </Link>
        </div>
      )}
    </header>
  );
}
