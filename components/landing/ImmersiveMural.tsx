"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Aviso } from "@/types";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

export default function ImmersiveMural() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    supabase
      .from("avisos")
      .select()
      .eq("visivel_home", true)
      .order("criado_em", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) {
          setAvisos(
            data
              .filter((a) => a.destinatarios === "todos")
              .map((a) => ({
                id: a.id, titulo: a.titulo, conteudo: a.conteudo,
                criadoEm: a.criado_em, destinatarios: a.destinatarios,
                ministerio: a.ministerio,
              }))
          );
        }
      });
  }, []);
  return (
    <section id="avisos" className="relative py-28 px-5 overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gray-100/40 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-gray-800/70 text-[11px] tracking-[0.4em] uppercase mb-3">
            Fique por dentro
          </p>
          <h2 className="font-sans text-4xl md:text-5xl font-semibold text-black">
            Mural de Avisos
          </h2>
          <div className="mx-auto mt-4 w-12 h-px bg-gray-200" />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {avisos.map((aviso, i) => (
            <motion.div
              key={aviso.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="bg-gray-50 border border-gray-200 rounded-2xl p-6
                         hover:border-gray-300 hover:bg-white transition-all duration-500 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 border border-gray-200 rounded-xl
                               flex items-center justify-center shrink-0
                               group-hover:bg-gray-200 transition-colors duration-500">
                  <Bell className="w-5 h-5 text-gray-800" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-black text-base leading-snug">
                    {aviso.titulo}
                  </h3>
                  <p className="text-gray-900 text-sm mt-1.5 leading-relaxed">
                    {aviso.conteudo}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 text-gray-800 text-xs">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {formatDate(aviso.criadoEm)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {avisos.length === 0 && (
          <p className="text-center text-gray-800">Nenhum aviso no momento.</p>
        )}
      </div>
    </section>
  );
}
