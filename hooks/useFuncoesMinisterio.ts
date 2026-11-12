"use client";
import { useCallback, useEffect, useState } from "react";
import { authJsonHeaders } from "@/lib/authHeaders";

export type FuncaoConfigurada = { id: string; nome: string };

export function useFuncoesMinisterio(ministerio: string) {
  const [funcoes, setFuncoes] = useState<FuncaoConfigurada[]>([]);
  const [erroFuncoes, setErroFuncoes] = useState("");
  const [carregandoFuncoes, setCarregandoFuncoes] = useState(true);
  const carregarFuncoes = useCallback(async () => {
    try {
      const res = await fetch(`/api/ministerio/funcoes?ministerio=${encodeURIComponent(ministerio)}`, { headers: await authJsonHeaders(), cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Não foi possível carregar as funções.");
      setFuncoes(json.funcoes ?? []); setErroFuncoes("");
    } catch (error) { setErroFuncoes(error instanceof Error ? error.message : "Não foi possível carregar as funções."); }
    finally { setCarregandoFuncoes(false); }
  }, [ministerio]);
  useEffect(() => { void carregarFuncoes(); }, [carregarFuncoes]);
  return { funcoes, erroFuncoes, carregandoFuncoes, carregarFuncoes };
}
