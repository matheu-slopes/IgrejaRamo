"use client";

import { motion } from "framer-motion";
import { MapPin, Clock, Phone, Navigation, ExternalLink } from "lucide-react";

const horarios = [
  { dia: "Segunda", desc: "Oração", hora: "20h" },
  { dia: "1ª Terça", desc: "Mulheres", hora: "19h30" },
  { dia: "2ª Terça", desc: "Ensino", hora: "19h45" },
  { dia: "Quinta", desc: "Culto", hora: "20h" },
  { dia: "Sábado", desc: "Jovens", hora: "19h30" },
  { dia: "Domingo", desc: "Culto Principal", hora: "18h30", destaque: true },
];

export default function ImmersiveMapa() {
  return (
    <section id="localizacao" className="relative py-32 px-5 overflow-hidden bg-vine-950">

      {/* Glows de fundo */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-vine-800/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-20 w-[400px] h-[400px] bg-gold-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Grain texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 text-gold-400 text-[11px] tracking-[0.45em] uppercase font-medium mb-4">
            <span className="w-6 h-px bg-gold-400/60" />
            Como chegar
            <span className="w-6 h-px bg-gold-400/60" />
          </span>
          <h2 className="font-sans text-4xl md:text-5xl font-semibold text-white leading-tight">
            Localização
          </h2>
          <p className="mt-4 text-vine-300/70 text-base max-w-sm mx-auto">
            Venha nos visitar. Será uma honra recebê-lo!
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">

          {/* Info panel — 2 cols */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-2 space-y-5"
          >
            {/* Endereço */}
            <div className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 hover:border-vine-400/30 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-vine-600/20 border border-vine-500/30 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-vine-300" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1 text-sm">Endereço</p>
                  <p className="text-vine-300/80 text-sm leading-relaxed">
                    R. Fernão Pompeu de Camargo, 1293<br />
                    Jardim do Trevo — Campinas, SP<br />
                    CEP 13040-010
                  </p>
                  <a
                    href="https://maps.google.com/?q=R.+Fernão+Pompeu+de+Camargo,+1293,+Campinas,+SP"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-gold-400 text-xs font-medium hover:text-gold-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir no Google Maps
                  </a>
                </div>
              </div>
            </div>

            {/* Horários */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 hover:border-vine-400/30 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-vine-600/20 border border-vine-500/30 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-vine-300" />
                </div>
                <p className="font-semibold text-white text-sm">Horários dos Cultos</p>
              </div>
              <div className="space-y-2">
                {horarios.map((h) => (
                  <div
                    key={h.dia}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      h.destaque
                        ? "bg-vine-600/25 border border-vine-500/30"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {h.destaque && <span className="w-1.5 h-1.5 rounded-full bg-gold-400 shrink-0" />}
                      <span className={h.destaque ? "text-white font-semibold" : "text-vine-300/80"}>
                        {h.dia}
                      </span>
                      <span className={h.destaque ? "text-vine-200/70 text-xs" : "text-vine-400/60 text-xs"}>
                        {h.desc}
                      </span>
                    </div>
                    <span className={h.destaque ? "text-gold-400 font-bold" : "text-vine-300/70 font-medium"}>
                      {h.hora}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contato */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 hover:border-vine-400/30 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-vine-600/20 border border-vine-500/30 rounded-xl flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-vine-300" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1 text-sm">Contato</p>
                  <p className="text-vine-300/80 text-sm">(19) 99999-9999</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <a
              href="https://maps.google.com/?q=R.+Fernão+Pompeu+de+Camargo,+1293,+Campinas,+SP"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-vine-600 hover:bg-vine-500 text-white text-sm font-semibold py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-vine-900/50 group"
            >
              <Navigation className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              Traçar Rota
            </a>
          </motion.div>

          {/* Mapa — 3 cols */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-3"
          >
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50"
              style={{ height: "520px" }}>
              {/* Borda brilhante */}
              <div className="absolute inset-0 rounded-2xl pointer-events-none z-10"
                style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }} />

              <iframe
                title="Localização Igreja Ramo da Vida"
                src="https://maps.google.com/maps?q=R.+Fern%C3%A3o+Pompeu+de+Camargo%2C+1293%2C+Jardim+do+Trevo%2C+Campinas%2C+SP%2C+13040-010&output=embed"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />

              {/* Overlay gradiente sutil na base */}
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-vine-950/60 to-transparent pointer-events-none z-10" />

              {/* Badge no mapa */}
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2.5 bg-vine-950/90 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white text-xs font-medium">Igreja Ramo da Vida</span>
                <span className="text-vine-400 text-xs">Campinas, SP</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
