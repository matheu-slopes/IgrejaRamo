"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import ScrollReveal from "./ScrollReveal";
import { supabase } from "@/lib/supabase";
import { FotoGaleria } from "@/types";

// TODO (Supabase): replace mockGaleria with:
// const { data: galeria } = await supabase.from('galeria').select().order('data', { ascending: false });

export default function GaleriaSection() {
  const [fotos, setFotos] = useState<FotoGaleria[]>([]);

  useEffect(() => {
    supabase
      .from("fotos_galeria")
      .select()
      .order("data", { ascending: false })
      .limit(9)
      .then(({ data }) => {
        if (data) setFotos(data);
      });
  }, []);

  if (fotos.length === 0) return null;

  return (
    <section id="galeria" className="py-24 px-6 bg-vine-950">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
        <div className="text-center mb-12">
          <p className="text-gold-500 font-semibold text-[11px] uppercase tracking-[0.3em] mb-3">
            Momentos
          </p>
          <h2 className="font-sans text-4xl md:text-5xl font-semibold text-white">Galeria de Fotos</h2>
          <div className="mx-auto mt-4 w-10 h-px bg-gold-500/50" />
          <p className="mt-4 text-vine-400 max-w-md mx-auto text-sm leading-relaxed">
            Memórias dos nossos cultos, eventos e ações sociais.
          </p>
        </div>
        </ScrollReveal>

        {/* Masonry-style grid */}
        <ScrollReveal delay={0.15}>
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {fotos.map((foto, i) => (
            <div
              key={foto.id}
              className="break-inside-avoid rounded-2xl overflow-hidden relative group shadow hover:shadow-xl transition"
            >
              <Image
                src={foto.url}
                alt={foto.titulo}
                width={600}
                height={i % 2 === 0 ? 400 : 300}
                className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <div>
                  <p className="text-white font-semibold text-sm">{foto.titulo}</p>
                  <p className="text-white/70 text-xs">
                    {new Date(foto.data + "T00:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
