import { MapPin, Clock, Phone } from "lucide-react";

// TODO (Supabase/Maps): Replace the mock map div with a real Google Maps or
// Mapbox embed, storing the coordinates in your Supabase settings table.

export default function MapaSection() {
  return (
    <section id="localizacao" className="py-24 px-6 bg-cream">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-gold-600 font-semibold text-[11px] uppercase tracking-[0.3em] mb-3">
            Como chegar
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-vine-950">Localização</h2>
          <div className="mx-auto mt-4 w-10 h-px bg-gold-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Info card */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-vine-100 rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-vine-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Endereço</p>
                <p className="text-gray-500 text-sm mt-0.5">
                  R. Fernão Pompeu de Camargo, 1293
                  <br />
                  Jardim do Trevo — Campinas, SP
                  <br />
                  CEP 13040-010
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-vine-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-vine-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Horários dos Cultos</p>
                <ul className="text-gray-500 text-sm mt-0.5 space-y-1">
                  <li>Segunda-feira (Oração) — 20h00</li>
                  <li>1ª Terça (Mulheres) — 19h30</li>
                  <li>2ª Terça (Ensino) — 19h45</li>
                  <li>Quinta-feira — 20h00</li>
                  <li>Sábado — Jovens (quinzenal) — 19h30</li>
                  <li>Domingo — 18h30</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-vine-100 rounded-xl flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-vine-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Contato</p>
                <p className="text-gray-500 text-sm mt-0.5">
                  (11) 99999-0000
                  <br />
                  secretaria@ramo.church
                </p>
              </div>
            </div>

            <a
              href="https://maps.google.com/?q=R.+Fernão+Pompeu+de+Camargo,+1293,+Campinas,+SP"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-vine-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-vine-800 transition"
            >
              <MapPin className="w-4 h-4" />
              Abrir no Google Maps
            </a>
          </div>

          {/* Mock map placeholder */}
          {/* TODO: Replace with <iframe> do Google Maps embed */}
          <div className="relative rounded-2xl overflow-hidden shadow-lg h-72 lg:h-96 bg-vine-50 flex items-center justify-center border-2 border-dashed border-vine-200">
            <div className="text-center text-vine-400">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-sm">Mapa interativo</p>
              <p className="text-xs mt-1 opacity-70">
                Embed do Google Maps aqui
              </p>
              {/* Decorative grid simulating a map */}
              <div className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "linear-gradient(#276f2a 1px, transparent 1px), linear-gradient(to right, #276f2a 1px, transparent 1px)",
                  backgroundSize: "30px 30px",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
