"use client";
import { useCallback, useEffect, useState } from "react";
import { authJsonHeaders } from "@/lib/authHeaders";
import { useFuncoesMinisterio } from "@/hooks/useFuncoesMinisterio";
import { correspondePesquisa } from "@/lib/funcoesLista";

type Vinculo = { id: string; ministerio: string; nome: string; funcao: string };

function EquipeDoUsuario({ equipe, usuarioId, atualizar }: { equipe: Vinculo; usuarioId: string; atualizar: () => Promise<void> }) {
  const { funcoes, erroFuncoes, carregandoFuncoes } = useFuncoesMinisterio(equipe.ministerio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const filtradas = funcoes.filter((f) => correspondePesquisa(f.nome, busca));
  async function alterar(funcao: string) {
    setErro(""); setSalvando(true);
    try {
      const res = await fetch("/api/ministerio/equipes/usuario", { method: "PATCH", headers: await authJsonHeaders(), body: JSON.stringify({ equipeId: equipe.id, usuarioId, funcao }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await atualizar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível alterar a função."); }
    finally { setSalvando(false); }
  }
  return <div className="rounded-xl border border-gray-200 p-3 space-y-2">
    <p className="text-sm font-medium text-gray-800">{equipe.ministerio} · {equipe.nome}</p>
    <label className="block text-xs text-gray-600">Pesquisar função
      <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" />
    </label>
    <label className="block text-xs text-gray-600">Função nesta equipe
      <select value={equipe.funcao} disabled={salvando || carregandoFuncoes || !!erroFuncoes} onChange={(e) => void alterar(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm disabled:opacity-60">
        {!filtradas.some((f) => f.nome === equipe.funcao) && <option value={equipe.funcao}>{equipe.funcao}{funcoes.some((f) => f.nome === equipe.funcao) ? " (atual)" : " (indisponível)"}</option>}
        {filtradas.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
      </select>
    </label>
    {busca.trim() && filtradas.length === 0 && <p className="text-xs text-gray-500">Nenhuma função encontrada.</p>}
    {(erro || erroFuncoes) && <p role="alert" className="text-xs text-red-600">{erro || erroFuncoes}</p>}
    {salvando && <p className="text-xs text-gray-500">Salvando...</p>}
    <a href={`/dashboard/ministerio/${encodeURIComponent(equipe.ministerio)}?tab=equipes`} className="inline-block text-xs font-medium text-gray-700 underline">Gerenciar equipes e funções</a>
  </div>;
}

export function FuncoesUsuarioAdmin({ usuarioId, ministerios }: { usuarioId: string; ministerios: string[] }) {
  const [equipes, setEquipes] = useState<Vinculo[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/ministerio/equipes/usuario?usuarioId=${encodeURIComponent(usuarioId)}`, { headers: await authJsonHeaders(), cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEquipes(json.equipes ?? []); setErro("");
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível carregar as equipes."); }
    finally { setCarregando(false); }
  }, [usuarioId]);
  const ministeriosKey = JSON.stringify([...ministerios].sort());
  useEffect(() => { void carregar(); }, [carregar, ministeriosKey]);
  return <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Equipes e funções</p><p className="text-xs text-gray-500">A função de serviço pode ser diferente em cada equipe. Para criar funções ou mudar a composição, abra o ministério.</p>
    {carregando ? <p className="text-xs text-gray-500">Carregando equipes...</p> : erro ? <p role="alert" className="text-xs text-red-600">{erro}</p> : equipes.length === 0 ? <p className="text-xs text-gray-500">Esta pessoa ainda não participa de equipes.</p> : equipes.map((equipe) => <EquipeDoUsuario key={equipe.id} equipe={equipe} usuarioId={usuarioId} atualizar={carregar} />)}
  </div>;
}
