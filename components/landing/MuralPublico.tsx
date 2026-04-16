import { Bell, CalendarDays } from "lucide-react";
import { mockAvisos } from "@/lib/mockData";

// TODO (Supabase): replace mockAvisos with:
// const { data: avisos } = await supabase
//   .from('avisos')
//   .select()
//   .eq('destinatarios', 'todos')
//   .order('criadoEm', { ascending: false });

const avisosPublicos = mockAvisos.filter((a) => a.destinatarios === "todos");

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

export default function MuralPublico() {
  return (
    <section id="avisos" className="py-24 px-6 bg-stone-50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-gold-600 font-semibold text-[11px] uppercase tracking-[0.3em] mb-3">
            Fique por dentro
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-vine-950">Mural de Avisos</h2>
          <div className="mx-auto mt-4 w-10 h-px bg-gold-400" />
          <p className="mt-4 text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
            Comunicados e programações especiais para toda a comunidade.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {avisosPublicos.map((aviso) => (
            <div
              key={aviso.id}
              className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-vine-200 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gold-50 border border-gold-100 rounded-xl flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-gold-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-vine-900 text-base leading-snug">
                    {aviso.titulo}
                  </h3>
                  <p className="text-gray-600 text-sm mt-1.5 leading-relaxed">
                    {aviso.conteudo}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 text-gray-400 text-xs">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {formatDate(aviso.criadoEm)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {avisosPublicos.length === 0 && (
          <p className="text-center text-gray-400">Nenhum aviso no momento.</p>
        )}
      </div>
    </section>
  );
}
