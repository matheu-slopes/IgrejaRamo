import { Clock } from "lucide-react";

// Programação semanal completa
const programacao = [
  {
    dia: "Segunda-feira",
    abrev: "SEG",
    eventos: [
      { nome: "Oração", horario: "20h00", destaque: false, cor: "default" as const },
    ],
  },
  {
    dia: "Terça-feira",
    abrev: "TER",
    eventos: [
      { nome: "Culto de Mulheres", horario: "19h30", detalhe: "1ª terça do mês", destaque: false, cor: "uva" as const },
      { nome: "Culto de Ensino",   horario: "19h45", detalhe: "2ª terça do mês", destaque: false, cor: "default" as const },
    ],
  },
  {
    dia: "Quinta-feira",
    abrev: "QUI",
    eventos: [
      { nome: "Culto",  horario: "20h00", destaque: false, cor: "default" as const },
    ],
  },
  {
    dia: "Sábado",
    abrev: "SÁB",
    eventos: [
      { nome: "Jovens", horario: "19h30", detalhe: "Quinzenal", destaque: false, cor: "jovens" as const },
    ],
  },
  {
    dia: "Domingo",
    abrev: "DOM",
    eventos: [
      { nome: "Culto", horario: "18h30", detalhe: "1º dom. do mês: 10h00", destaque: true, cor: "default" as const },
    ],
  },
];

type Cor = "default" | "ouro" | "uva" | "jovens";

function cardClasses(cor: Cor) {
  switch (cor) {
    case "ouro":    return { bg: "bg-gold-500 text-vine-950",  time: "text-vine-800" };
    case "uva":     return { bg: "bg-grape-800 text-white",    time: "text-grape-200" };
    case "jovens":  return { bg: "bg-vine-700 text-white",     time: "text-vine-200" };
    default:        return { bg: "bg-vine-50 text-vine-900",   time: "text-vine-600" };
  }
}

export default function CultosSection() {
  return (
    <section id="cultos" className="py-24 px-6 bg-cream">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-gold-600 font-semibold text-[11px] uppercase tracking-[0.3em] mb-3">
            Venha nos visitar
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-vine-950">Programação Semanal</h2>
          <div className="mx-auto mt-4 w-10 h-px bg-gold-400" />
          <p className="mt-4 text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
            Momentos de louvor, oração e Palavra — toda semana.
          </p>
        </div>

        {/* Schedule grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {programacao.map((item) => (
            <div
              key={item.dia}
              className="bg-white rounded-2xl shadow-sm border border-vine-100 overflow-hidden flex flex-col"
            >
              {/* Day header */}
              <div className="bg-vine-900 text-white text-center py-3.5">
                <p className="text-[9px] font-bold tracking-[0.3em] text-vine-400 uppercase">{item.abrev}</p>
                <p className="text-sm font-semibold mt-0.5">{item.dia.split("-")[0]}</p>
              </div>

              {/* Events */}
              <div className="flex-1 flex flex-col gap-2 p-3">
                {item.eventos.map((ev, i) => {
                  const cls = cardClasses(ev.cor);
                  return (
                    <div key={i} className={`rounded-xl px-3 py-2.5 flex flex-col gap-0.5 ${cls.bg}`}>
                      <span className="font-bold text-sm leading-tight">{ev.nome}</span>
                      <span className={`flex items-center gap-1 text-xs font-semibold ${cls.time}`}>
                        <Clock className="w-3 h-3" /> {ev.horario}
                      </span>
                      {"detalhe" in ev && ev.detalhe && (
                        <span className="text-[10px] opacity-70 leading-tight">{ev.detalhe}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Address teaser */}
        <p className="text-center text-gray-400 text-sm mt-8">
          📍 R. Fernão Pompeu de Camargo, 1293 — Jardim do Trevo, Campinas – SP &nbsp;·&nbsp;{" "}
          <a href="#localizacao" className="text-vine-600 hover:underline font-medium">
            Ver localização
          </a>
        </p>
      </div>
    </section>
  );
}
