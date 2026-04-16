import ScrollReveal from "./ScrollReveal";

export default function QuemSomosSection() {
  return (
    <section id="quem-somos" className="py-24 px-6 bg-vine-950">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Text */}
          <ScrollReveal>
          <div>
            <p className="text-gold-400 font-semibold text-[11px] uppercase tracking-[0.3em] mb-3">
              Nossa história
            </p>
            <h2 className="font-sans text-4xl md:text-5xl font-semibold text-white mb-8">
              Quem Somos
            </h2>
            <div className="space-y-4 text-vine-200 leading-relaxed text-[15px]">
              <p>
                A comunidade cristã <strong className="text-white">Ramo da Vida</strong> nasceu
                no coração de Deus e se manifesta através da comunhão nos cultos, bem como em
                ações sociais e também fora da igreja, manifestando Jesus e Seu amor às pessoas
                através do testemunho pessoal e coletivo de seus membros, líderes e simpatizantes
                do mesmo propósito.
              </p>
              <p>
                Nosso intuito e missão é manifestar o caráter de Cristo, seu amor, ensino e exemplo
                de maneira simples, prática e verdadeira, a fim de pregar a salvação por meio da fé
                até que <strong className="text-white">ELE venha!</strong>
              </p>
              <p className="font-sans italic text-lg text-vine-300 leading-relaxed border-l-2 border-gold-600/40 pl-4">
                "Eu sou a videira; vós sois os ramos. Quem permanece em mim e eu nele,
                esse dá muito fruto."
                <span className="block not-italic text-gold-500/70 text-[11px] mt-2 tracking-[0.2em] uppercase">— João 15:5</span>
              </p>
            </div>
          </div>
          </ScrollReveal>

          {/* Stat cards */}
          <ScrollReveal delay={0.2}>
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
                <p className="font-sans text-3xl font-semibold text-gold-400">{stat.numero}</p>
                <p className="text-xs text-vine-400 mt-2 tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
