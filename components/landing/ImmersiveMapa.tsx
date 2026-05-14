"use client";

import { motion } from "framer-motion";
import { MapPin, Clock, Navigation } from "lucide-react";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.16382 19.8867C7.16666 12.8126 12.9486 7.05882 20.0527 7.05882C23.4986 7.06024 26.7359 8.39611 29.1691 10.8205C31.6023 13.2448 32.9425 16.4695 32.9412 19.897C32.9383 26.9711 27.156 32.7255 20.0526 32.7255C17.9484 32.7248 15.8827 32.2146 14.0352 31.2426L7.58219 32.9272C7.27122 33.0084 6.989 32.7225 7.07425 32.4126L8.79752 26.1482C7.72503 24.2382 7.16292 22.0869 7.16382 19.8867ZM20.0463 30.4359H20.042C18.1611 30.4352 16.3163 29.9322 14.7069 28.9817L14.3241 28.7556L10.3569 29.7914L11.4158 25.9417L11.1666 25.547C10.1173 23.886 9.56313 21.9663 9.56399 19.9951C9.56629 14.2432 14.2686 9.5636 20.0505 9.5636C22.8502 9.56454 25.482 10.6511 27.4612 12.6231C29.4402 14.5949 30.5294 17.216 30.5283 20.0035C30.526 25.7559 25.8237 30.4359 20.0463 30.4359ZM23.5806 21.4974C23.8678 21.6029 25.4084 22.3667 25.7217 22.5247C25.7829 22.5556 25.84 22.5834 25.893 22.6092C26.1116 22.7156 26.2593 22.7875 26.3223 22.8935C26.4006 23.0252 26.4006 23.6574 26.1395 24.3951C25.8784 25.1326 24.6265 25.8058 24.0245 25.8964C23.4846 25.9777 22.8015 26.0116 22.0509 25.7713C21.5958 25.6258 21.0121 25.4315 20.2645 25.1061C17.3272 23.8281 15.3422 20.9596 14.9667 20.4169C14.9403 20.3789 14.9219 20.3522 14.9116 20.3384L14.9091 20.335C14.7433 20.1122 13.6321 18.6183 13.6321 17.0721C13.6321 15.6177 14.3411 14.8553 14.6675 14.5044C14.6898 14.4803 14.7104 14.4582 14.7288 14.4379C15.0161 14.1219 15.3556 14.0429 15.5645 14.0429C15.7733 14.0429 15.9824 14.0448 16.165 14.054C16.1875 14.0551 16.211 14.055 16.2352 14.0548C16.4178 14.0538 16.6455 14.0525 16.87 14.5959C16.9562 14.8047 17.0823 15.114 17.2153 15.4403C17.4852 16.1024 17.7836 16.8347 17.8361 16.9405C17.9145 17.0985 17.9667 17.2829 17.8622 17.4937C17.8466 17.5253 17.8321 17.5551 17.8182 17.5836C17.7398 17.745 17.6821 17.8637 17.5489 18.0204C17.4968 18.0818 17.4429 18.1479 17.389 18.2141C17.281 18.3466 17.1729 18.4792 17.0789 18.5736C16.922 18.731 16.7587 18.9019 16.9415 19.218C17.1243 19.5341 17.7532 20.5681 18.6846 21.4053C19.686 22.3054 20.5563 22.6858 20.9974 22.8786C21.0835 22.9162 21.1533 22.9467 21.2045 22.9725C21.5178 23.1307 21.7007 23.1042 21.8834 22.8935C22.0662 22.6828 22.6667 21.9715 22.8756 21.6554C23.0845 21.3395 23.2934 21.3921 23.5806 21.4974Z"
        fill="currentColor"
      />
    </svg>
  );
}

const horarios = [
  { dia: "Segunda",    desc: "Oração",    hora: "20h"   },
  { dia: "Terça (1ª)", desc: "Mulheres",  hora: "19h30" },
  { dia: "Terça (2ª)", desc: "Ensino",    hora: "19h45" },
  { dia: "Quinta",     desc: "Culto",     hora: "20h"   },
  { dia: "Sábado",     desc: "Jovens",    hora: "19h30" },
  { dia: "Domingo",    desc: "Culto",     hora: "18h30", destaque: true },
];

const WHATSAPP = "5519995953536";

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

      <div className="py-10 px-4 md:py-14 md:px-6">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">

        {/* ── Título centralizado ── */}
        <motion.h2
          {...fadeUp(0)}
          className="text-center font-sans text-3xl md:text-4xl font-bold text-black"
        >
          Localização
        </motion.h2>

        {/* ── Mapa full-width ── */}
        <motion.div {...fadeUp(0.05)}>
          <div
            className="w-full h-[200px] md:h-[260px] rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm"
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
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.7fr_200px_200px] divide-y md:divide-y-0 md:divide-x divide-gray-100">

            {/* Coluna 1 — Endereço */}
            <div className="p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
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
            <div className="p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                <p className="text-gray-900 text-base font-semibold">Horários dos Cultos</p>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                {horarios.map((h) =>
                  h.destaque ? (
                    <div
                      key={h.dia}
                      className="bg-black text-white rounded-xl px-3 py-3 text-center h-full flex flex-col justify-center"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide leading-none">
                        {h.dia}
                      </p>
                      <p className="text-xs opacity-80 mt-1.5">{h.desc}</p>
                      <p className="text-base font-bold mt-2">{h.hora}</p>
                    </div>
                  ) : (
                    <div key={h.dia} className="text-center h-full flex flex-col justify-center">
                      <p className="text-xs font-bold uppercase tracking-wide leading-none text-gray-900">{h.dia}</p>
                      <p className="text-gray-600 text-xs mt-1.5">{h.desc}</p>
                      <p className="text-gray-900 text-sm font-bold mt-2">{h.hora}</p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Coluna 3 — Contato */}
            <div className="p-5 md:p-6 flex flex-col items-center justify-center text-center gap-4">
              <p className="text-black font-bold text-lg">Fale conosco</p>

              <a
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full max-w-[190px] bg-[#25D366] hover:bg-[#1fa942] text-white text-sm font-semibold py-2 rounded-xl transition-all duration-300"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Clique aqui
              </a>
            </div>

            {/* Coluna 4 — Foto da comunidade */}
            <div
              className="relative hidden md:block bg-gray-200/40"
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
