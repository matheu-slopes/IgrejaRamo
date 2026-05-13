"use client";

import { motion } from "framer-motion";
import { MapPin, Clock, Phone, Navigation } from "lucide-react";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const horarios = [
  { dia: "Segunda",    desc: "Oração",         hora: "20h"   },
  { dia: "Terça (1ª)", desc: "Mulheres",        hora: "19h30" },
  { dia: "Terça (2ª)", desc: "Ensino",          hora: "19h45" },
  { dia: "Quinta",     desc: "Culto",           hora: "20h"   },
  { dia: "Sábado",     desc: "Jovens",          hora: "19h30" },
  { dia: "Domingo",    desc: "Culto Dominical", hora: "18h30", destaque: true },
];

const WHATSAPP = "5519995953536";
const PHONE    = "(19) 99595-3536";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" } as const,
  transition: { duration: 0.6, delay, ease: "easeOut" as const },
});

export default function ImmersiveMapa() {
  return (
    <section id="localizacao" className="bg-[#F5F1EB]">
      {/* ── Divisor clean ── */}
      <div className="w-full border-t border-gray-200 py-8" />

      <div className="py-16 px-4 md:py-20 md:px-6">
      <div className="max-w-5xl mx-auto space-y-8 md:space-y-10">

        {/* ── Título centralizado ── */}
        <motion.h2
          {...fadeUp(0)}
          className="text-center font-sans text-4xl md:text-6xl font-bold text-black"
        >
          Localização
        </motion.h2>

        {/* ── Mapa full-width ── */}
        <motion.div {...fadeUp(0.05)}>
          <div
            className="w-full h-[240px] md:h-[360px] rounded-2xl md:rounded-3xl overflow-hidden border border-gray-200/50 shadow-sm"
          >
            <iframe
              title="Localização Igreja Ramo da Vida"
              src="https://maps.google.com/maps?q=R.+Fern%C3%A3o+Pompeu+de+Camargo%2C+1293%2C+Jardim+do+Trevo%2C+Campinas%2C+SP%2C+13040-010&output=embed"
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </motion.div>

        {/* ── Card inferior com 4 colunas ── */}
        <motion.div
          {...fadeUp(0.1)}
          className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.7fr_1fr_160px] divide-y md:divide-y-0 md:divide-x divide-gray-100">

            {/* Coluna 1 — Endereço */}
            <div className="p-6 md:p-9">
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                <p className="text-gray-900 text-base font-semibold">Endereço</p>
              </div>
              <p className="text-gray-900/75 text-sm leading-relaxed">
                R. Fernão Pompeu de Camargo, 1293 | Jardim do Trevo —{" "}
                Campinas, SP | CEP 13040-010
              </p>
              <a
                href="https://maps.google.com/?q=R.+Fernão+Pompeu+de+Camargo,+1293,+Campinas,+SP"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-6 text-gray-800 hover:text-gray-900 text-sm font-semibold transition-colors group"
              >
                <Navigation className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                Traçar rota no Google Maps →
              </a>
            </div>

            {/* Coluna 2 — Horários em grade 3×2 */}
            <div className="p-6 md:p-9">
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                <p className="text-gray-900 text-base font-semibold">Horários dos Cultos</p>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                {horarios.map((h) =>
                  h.destaque ? (
                    <div
                      key={h.dia}
                      className="bg-black text-white rounded-xl px-3 py-3 text-center"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide leading-none">
                        {h.dia}
                      </p>
                      <p className="text-[10px] opacity-80 mt-1">{h.desc}</p>
                      <p className="text-base font-bold mt-1.5">{h.hora}</p>
                    </div>
                  ) : (
                    <div key={h.dia} className="text-center">
                      <p className="text-gray-900 text-sm font-semibold leading-tight">{h.dia}</p>
                      <p className="text-gray-600 text-xs">{h.desc}</p>
                      <p className="text-gray-900 text-sm font-bold mt-0.5">{h.hora}</p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Coluna 3 — Contato & Visita */}
            <div className="p-6 md:p-9">
              <div className="flex items-center gap-2 mb-5">
                <Phone className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                <p className="text-gray-900 text-base font-semibold">Contato &amp; Visita</p>
              </div>
              <p className="text-black font-bold text-lg mb-5">{PHONE}</p>

              <div className="space-y-3">
                <a
                  href={`tel:+${WHATSAPP}`}
                  className="flex items-center justify-center gap-1.5 w-full border border-gray-200 hover:border-gray-400 text-gray-900 text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  Ligar Agora
                </a>
                <a
                  href={`https://wa.me/${WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full border border-gray-200 hover:border-gray-400 text-gray-900 text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <WhatsAppIcon className="w-4 h-4 text-green-600" />
                  Falar no WhatsApp
                </a>
              </div>

              <p className="text-gray-800/70 text-sm leading-relaxed mt-5">
                Aberto a todos.<br />Venha nos conhecer!
              </p>
            </div>

            {/* Coluna 4 — Foto da comunidade */}
            <div
              className="relative hidden md:block bg-gray-200/40 min-h-[200px]"
              style={{
                backgroundImage: "url('/imagem_localização.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

          </div>
        </motion.div>

      </div>
      </div>
    </section>
  );
}
