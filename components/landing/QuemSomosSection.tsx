export default function QuemSomosSection() {
  return (
    <section id="quem-somos" className="py-24 px-6 bg-vine-950">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Text */}
          <div>
            <p className="text-gold-400 font-semibold text-[11px] uppercase tracking-[0.3em] mb-3">
              Nossa história
            </p>
            <h2 className="font-serif text-4xl md:text-5xl font-semibold text-white mb-8">
              Quem Somos
            </h2>
            <div className="space-y-4 text-vine-200 leading-relaxed text-[15px]">
              <p>
                A <strong className="text-white">Igreja Ramo da Vida</strong> nasceu dentro
                de um lar — a partir de um altar de família e amigos que se reuniram ao
                redor da Palavra de Deus com fé simples e coração aberto.
              </p>
              <p>
                Fundada em <strong className="text-gold-400">2019</strong> em Campinas, nossa
                comunidade cresceu unida em torno da oração, do louvor e do serviço ao
                próximo. Do lar para as ruas, do altar da família para os ministérios que
                hoje alcançam crianças, jovens e adultos.
              </p>
              <p className="font-serif italic text-lg text-vine-300 leading-relaxed border-l-2 border-gold-600/40 pl-4">
                "Eu sou a videira; vós sois os ramos. Quem permanece em mim e eu nele,
                esse dá muito fruto."
                <span className="block not-italic text-gold-500/70 text-[11px] mt-2 tracking-[0.2em] uppercase">— João 15:5</span>
              </p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { numero: "2019",  label: "Fundação"              },
              { numero: "6",     label: "Ministérios"           },
              { numero: "6×",    label: "Cultos por semana"     },
              { numero: "∞",     label: "Amor ao próximo"       },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-vine-900/60 border border-vine-800/60 rounded-2xl p-6 text-center hover:border-gold-700/40 transition"
              >
                <p className="font-serif text-3xl font-semibold text-gold-400">{stat.numero}</p>
                <p className="text-xs text-vine-400 mt-2 tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
