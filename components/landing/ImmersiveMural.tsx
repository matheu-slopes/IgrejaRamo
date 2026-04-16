"use client";

import { motion } from "framer-motion";
import { Bell, CalendarDays } from "lucide-react";
import { mockAvisos } from "@/lib/mockData";

const avisosPublicos = mockAvisos.filter((a) => a.destinatarios === "todos");

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

export default function ImmersiveMural() {
  return (
    <section id="avisos" className="relative py-28 px-5 bg-[#08100a] overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gold-900/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-gold-500/60 text-[11px] tracking-[0.4em] uppercase mb-3">
            Fique por dentro
          </p>
          <h2 className="font-sans text-4xl md:text-5xl font-semibold text-white">
            Mural de Avisos
          </h2>
          <div className="mx-auto mt-4 w-12 h-px bg-gold-500/30" />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {avisosPublicos.map((aviso, i) => (
            <motion.div
              key={aviso.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6
                         hover:border-gold-600/20 hover:bg-white/[0.05] transition-all duration-500 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gold-500/10 border border-gold-500/20 rounded-xl
                               flex items-center justify-center shrink-0
                               group-hover:bg-gold-500/20 transition-colors duration-500">
                  <Bell className="w-5 h-5 text-gold-500/70" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-base leading-snug">
                    {aviso.titulo}
                  </h3>
                  <p className="text-vine-300/60 text-sm mt-1.5 leading-relaxed">
                    {aviso.conteudo}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 text-vine-500 text-xs">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {formatDate(aviso.criadoEm)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {avisosPublicos.length === 0 && (
          <p className="text-center text-vine-600">Nenhum aviso no momento.</p>
        )}
      </div>
    </section>
  );
}
