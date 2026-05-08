"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Ministerio } from "@/types";
import { EscalasTab } from "@/components/dashboard/EscalasTab";
import clsx from "clsx";

const TODOS: Ministerio[] = ["Louvor","Mídias","Cantina","Infantil","Ação Social","Jovens","Ensino"];
const EMOJI: Record<string,string> = {Louvor:"🎸","Mídias":"📹",Cantina:"🧹",Infantil:"🧒","Ação Social":"🤝",Jovens:"⚡",Ensino:"📖"};

export default function EscalasDashboardPage() {
  const { user, temPermissao } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "pastor";
  const meus = (user?.ministerios ?? []) as Ministerio[];
  const lista = isAdmin ? TODOS : meus;
  const [sel, setSel] = useState<Ministerio>(lista[0] ?? "Louvor");
  if (lista.length === 0) return <div className="py-24 text-center text-sm text-gray-400">Você não pertence a nenhum ministério.</div>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sans font-semibold text-vine-950">Escalas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie as escalas de serviço dos ministérios.</p>
      </div>
      {lista.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {lista.map((m) => (
            <button key={m} onClick={() => setSel(m)}
              className={clsx("flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition",
                sel === m ? "bg-vine-700 text-white border-vine-700 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-vine-300 hover:text-vine-700"
              )}><span>{EMOJI[m] ?? "📋"}</span> {m}</button>
          ))}
        </div>
      )}
      <EscalasTab ministerio={sel} isLider={temPermissao("criar_escala")} />
    </div>
  );
}
