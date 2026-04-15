import Link from "next/link";
import { Church, CalendarDays, Users, Info } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="flex items-center gap-3 mb-6">
          <Church className="w-12 h-12 text-indigo-600" />
          <h1 className="text-4xl font-bold text-indigo-700">Igreja Ramo</h1>
        </div>
        <p className="text-lg text-gray-600 max-w-xl mb-10">
          Plataforma de gestão interna da comunidade. Acompanhe eventos,
          ministérios e avisos em um só lugar.
        </p>
        <Link
          href="/login"
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-lg font-medium hover:bg-indigo-700 transition"
        >
          Entrar
        </Link>
      </section>

      {/* Cards */}
      <section className="max-w-4xl mx-auto px-6 pb-24 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center text-center gap-3">
          <CalendarDays className="w-8 h-8 text-indigo-500" />
          <h2 className="font-semibold text-gray-800">Eventos</h2>
          <p className="text-sm text-gray-500">
            Veja e gerencie os próximos eventos da igreja.
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center text-center gap-3">
          <Users className="w-8 h-8 text-indigo-500" />
          <h2 className="font-semibold text-gray-800">Membros</h2>
          <p className="text-sm text-gray-500">
            Cadastro e gestão de membros e ministérios.
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center text-center gap-3">
          <Info className="w-8 h-8 text-indigo-500" />
          <h2 className="font-semibold text-gray-800">Avisos</h2>
          <p className="text-sm text-gray-500">
            Comunicados internos por role e ministério.
          </p>
        </div>
      </section>
    </main>
  );
}
