"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { authJsonHeaders } from "@/lib/authHeaders";
import { supabase } from "@/lib/supabase";
import type { EquipeMinisterio, EquipeMembro } from "@/lib/equipesMinisterio";
import { FUNCOES_POR_MIN } from "@/components/dashboard/EscalasTab";

type Pessoa = { id: string; nome: string };

export function EquipesTab({ ministerio, podeGerenciar }: { ministerio: string; podeGerenciar: boolean }) {
  const [equipes, setEquipes] = useState<EquipeMinisterio[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<EquipeMinisterio | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const [res, perfis] = await Promise.all([
        fetch(`/api/ministerio/equipes?ministerio=${encodeURIComponent(ministerio)}`, { headers: await authJsonHeaders(), cache: "no-store" }),
        supabase.from("perfis").select("id,nome").contains("ministerios", [ministerio]).eq("ativo", true).order("nome"),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (perfis.error) throw new Error("Não foi possível carregar os membros.");
      setEquipes(json.equipes ?? []);
      setPessoas(perfis.data ?? []);
    } catch (error) { setErro(error instanceof Error ? error.message : "Erro ao carregar equipes."); }
    finally { setCarregando(false); }
  }, [ministerio]);

  useEffect(() => { void carregar(); }, [carregar]);
  const nomePessoa = (id: string) => pessoas.find((p) => p.id === id)?.nome;
  const funcoes = FUNCOES_POR_MIN[ministerio] ?? ["Responsável"];

  async function salvar() {
    if (!editando) return;
    setSalvando(true); setErro("");
    try {
      const res = await fetch("/api/ministerio/equipes", { method: "POST", headers: await authJsonHeaders(), body: JSON.stringify(editando) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEditando(null); await carregar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Erro ao salvar equipe."); }
    finally { setSalvando(false); }
  }

  async function excluir(equipe: EquipeMinisterio) {
    if (!window.confirm(`Excluir a equipe “${equipe.nome}”? As escalas já criadas não serão alteradas.`)) return;
    setErro("");
    try {
      const res = await fetch("/api/ministerio/equipes", { method: "DELETE", headers: await authJsonHeaders(), body: JSON.stringify({ id: equipe.id, ministerio }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await carregar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Erro ao excluir equipe."); }
  }

  function alterarMembros(membros: EquipeMembro[]) { setEditando((atual) => atual ? { ...atual, membros } : null); }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-gray-900">Equipes</h2><p className="text-sm text-gray-500">Organize os membros em equipes para usar nas escalas.</p></div>
      {podeGerenciar && <button onClick={() => { setErro(""); setEditando({ id: "", ministerio, nome: "", membros: [] }); }} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Nova equipe</button>}
    </div>
    {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    {editando && <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="font-semibold">{editando.id ? "Editar equipe" : "Nova equipe"}</h3>
      <label className="block text-sm font-medium">Nome da equipe<input value={editando.nome} maxLength={80} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2" placeholder="Ex.: Equipe 1" /></label>
      <div><p className="mb-2 text-sm font-medium">Membros e funções</p>
        <div className="space-y-2">{editando.membros.map((m) => <div key={m.usuarioId} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-2">
          <span className="min-w-32 flex-1 text-sm">{nomePessoa(m.usuarioId) ?? "Membro indisponível"}</span>
          <select aria-label={`Função de ${nomePessoa(m.usuarioId) ?? "membro"}`} value={m.funcao} onChange={(e) => alterarMembros(editando.membros.map((item) => item.usuarioId === m.usuarioId ? { ...item, funcao: e.target.value } : item))} className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm">
            {!funcoes.includes(m.funcao) && <option>{m.funcao}</option>}{funcoes.map((f) => <option key={f}>{f}</option>)}
          </select>
          <button aria-label={`Remover ${nomePessoa(m.usuarioId) ?? "membro"} da equipe`} onClick={() => alterarMembros(editando.membros.filter((item) => item.usuarioId !== m.usuarioId))} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><X className="h-4 w-4" /></button>
        </div>)}</div>
        <label className="mt-3 block text-sm text-gray-600">Adicionar membro<select value="" onChange={(e) => { if (e.target.value) alterarMembros([...editando.membros, { usuarioId: e.target.value, funcao: funcoes[0] }]); }} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2"><option value="">Selecione um membro</option>{pessoas.filter((p) => !editando.membros.some((m) => m.usuarioId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      </div>
      <div className="flex gap-2"><button disabled={salvando} onClick={() => setEditando(null)} className="rounded-xl border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando || !editando.nome.trim()} onClick={() => void salvar()} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando ? "Salvando..." : "Salvar equipe"}</button></div>
    </div>}
    {carregando ? <p className="text-sm text-gray-500">Carregando equipes...</p> : !equipes.length && !erro ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-500">Nenhuma equipe criada neste ministério.</p> : <div className="grid gap-3 md:grid-cols-2">{equipes.map((equipe) => <article key={equipe.id} className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{equipe.nome}</h3><p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Users className="h-3.5 w-3.5" /> {equipe.membros.length} membro(s)</p></div>{podeGerenciar && <div className="flex gap-1"><button aria-label={`Editar ${equipe.nome}`} onClick={() => { setErro(""); setEditando({ ...equipe, membros: equipe.membros.filter((m) => nomePessoa(m.usuarioId)) }); }} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button><button aria-label={`Excluir ${equipe.nome}`} onClick={() => void excluir(equipe)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>}</div>
      <ul className="mt-3 space-y-1 text-sm text-gray-600">{equipe.membros.map((m) => nomePessoa(m.usuarioId) && <li key={m.usuarioId}>{nomePessoa(m.usuarioId)} <span className="text-gray-400">· {m.funcao}</span></li>)}</ul>
    </article>)}</div>}
  </div>;
}
