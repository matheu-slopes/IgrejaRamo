"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { authJsonHeaders } from "@/lib/authHeaders";
import type { FuncaoConfigurada } from "@/hooks/useFuncoesMinisterio";
import { correspondePesquisa } from "@/lib/funcoesLista";

export function FuncoesMinisterio({ ministerio, funcoes, atualizar }: { ministerio: string; funcoes: FuncaoConfigurada[]; atualizar: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(nomeParaSalvar: string, id?: string) {
    setErro(""); setSalvando(true);
    try {
      const res = await fetch("/api/ministerio/funcoes", { method: "POST", headers: await authJsonHeaders(), body: JSON.stringify({ ministerio, nome: nomeParaSalvar, id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (id) { setEditando(null); setNomeEdicao(""); } else setNome("");
      await atualizar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSalvando(false); }
  }
  async function remover(funcao: FuncaoConfigurada) {
    if (!window.confirm(`Remover “${funcao.nome}” das opções? As equipes e escalas existentes manterão essa função.`)) return;
    setErro(""); setSalvando(true);
    try {
      const res = await fetch("/api/ministerio/funcoes", { method: "DELETE", headers: await authJsonHeaders(), body: JSON.stringify({ ministerio, id: funcao.id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await atualizar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível remover."); }
    finally { setSalvando(false); }
  }
  return <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
    <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="font-semibold text-sm text-gray-900 underline underline-offset-4">{aberto ? "Fechar funções" : "Gerenciar funções"}</button>
    {aberto && <div className="space-y-3"><p className="text-sm text-gray-500">As funções deste ministério aparecem nas equipes e nas escalas. Alterar um nome atualiza as equipes; escalas já salvas mantêm seu histórico.</p>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <label className="block text-sm font-medium" htmlFor="nome-funcao">Nova função</label>
      <form onSubmit={(e) => { e.preventDefault(); void salvar(nome); }} className="flex flex-wrap gap-2"><input id="nome-funcao" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder="Nome da função" className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm" /><button type="submit" disabled={salvando || !nome.trim()} className="flex items-center gap-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Adicionar</button></form>
      <label className="block text-sm font-medium" htmlFor="buscar-funcao">Pesquisar funções</label>
      <input id="buscar-funcao" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
      <ul className="space-y-1">{funcoes.filter((funcao) => correspondePesquisa(funcao.nome, busca)).map((funcao) => <li key={funcao.id} className="rounded-lg bg-gray-50 px-3 py-1">
        {editando === funcao.id ? (
          <form onSubmit={(e) => { e.preventDefault(); void salvar(nomeEdicao, funcao.id); }} className="flex flex-wrap items-center gap-2 py-1">
            <input autoFocus aria-label={`Novo nome para ${funcao.nome}`} value={nomeEdicao} maxLength={80} onChange={(e) => setNomeEdicao(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && !salvando) { setEditando(null); setNomeEdicao(""); setErro(""); } }} className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
            <button type="submit" disabled={salvando || !nomeEdicao.trim()} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando ? "Salvando..." : "Salvar"}</button>
            <button type="button" disabled={salvando} onClick={() => { setEditando(null); setNomeEdicao(""); setErro(""); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50">Cancelar</button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-2"><span className="text-sm">{funcao.nome}</span><span className="flex"><button type="button" disabled={salvando} aria-label={`Editar ${funcao.nome}`} onClick={() => { setEditando(funcao.id); setNomeEdicao(funcao.nome); setErro(""); }} className="p-2 text-gray-600 disabled:opacity-50"><Pencil className="h-4 w-4" /></button><button type="button" disabled={salvando} aria-label={`Remover ${funcao.nome}`} onClick={() => void remover(funcao)} className="p-2 text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></span></div>
        )}
      </li>)}</ul>
      {!funcoes.some((funcao) => correspondePesquisa(funcao.nome, busca)) && <p className="text-sm text-gray-500">{busca.trim() ? "Nenhuma função encontrada." : "Nenhuma função cadastrada."}</p>}
    </div>}
  </section>;
}
