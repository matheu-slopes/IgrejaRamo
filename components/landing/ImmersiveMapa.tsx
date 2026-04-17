"use client";

import { motion } from "framer-motion";
import { MapPin, Clock, Phone } from "lucide-react";

export default function ImmersiveMapa() {
  return (
    <section id="localizacao" className="relative py-28 px-5 overflow-hidden">
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-gray-100/40 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-vine-600/70 text-[11px] tracking-[0.4em] uppercase mb-3">
            Como chegar
          </p>
          <h2 className="font-sans text-4xl md:text-5xl font-semibold text-vine-900">
            Localização
          </h2>
          <div className="mx-auto mt-4 w-12 h-px bg-gray-200" />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="space-y-6"
          >
            {[
              {
                icon: MapPin,
                title: "Endereço",
                content: (
                  <>
                    R. Fernão Pompeu de Camargo, 1293<br />
                    Jardim do Trevo — Campinas, SP<br />
                    CEP 13040-010
                  </>
                ),
              },
              {
                icon: Clock,
                title: "Horários",
                content: (
                  <ul className="space-y-1">
                    <li>Segunda — Oração 20h</li>
                    <li>1ª Terça — Mulheres 19h30</li>
                    <li>2ª Terça — Ensino 19h45</li>
                    <li>Quinta — Culto 20h</li>
                    <li>Sábado — Jovens 19h30</li>
                    <li className="text-vine-900 font-semibold">Domingo — 18h30</li>
                  </ul>
                ),
              },
              {
                icon: Phone,
                title: "Contato",
                content: <>(19) 99999-9999</>,
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-50 border border-vine-200 rounded-xl flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-vine-600" />
                </div>
                <div>
                  <p className="font-semibold text-vine-900 mb-1">{item.title}</p>
                  <div className="text-vine-700 text-sm leading-relaxed">{item.content}</div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Map placeholder */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="rounded-2xl overflow-hidden border border-vine-200 h-[320px] bg-white relative"
          >
            <iframe
              title="Localização Igreja Ramo da Vida"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3675.!2d-47.0693!3d-22.8888!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjLCsDUzJzE3LjgiUyA0N8KwMDQnMDkuNSJX!5e0!3m2!1spt-BR!2sbr!4v1"
              className="w-full h-full border-0 opacity-90"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent pointer-events-none" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
