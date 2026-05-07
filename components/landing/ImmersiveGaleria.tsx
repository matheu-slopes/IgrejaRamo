"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { FotoGaleria } from "@/types";

export default function ImmersiveGaleria() {
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
    <section id="galeria" className="relative py-28 px-5 overflow-hidden">
      <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-gray-100/40 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-vine-600/70 text-[11px] tracking-[0.4em] uppercase mb-3">
            Momentos
          </p>
          <h2 className="font-sans text-4xl md:text-5xl font-semibold text-vine-900">
            Galeria
          </h2>
          <div className="mx-auto mt-4 w-12 h-px bg-gray-200" />
        </motion.div>

        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {fotos.map((foto, i) => (
            <motion.div
              key={foto.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.1 }}
              className="break-inside-avoid rounded-2xl overflow-hidden relative group"
            >
              <Image
                src={foto.url}
                alt={foto.titulo}
                width={600}
                height={i % 2 === 0 ? 400 : 300}
                className="w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent
                             opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-5">
                <div>
                  <p className="text-white font-semibold text-sm">{foto.titulo}</p>
                  <p className="text-white/50 text-xs mt-0.5">
                    {new Date(foto.data + "T00:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
