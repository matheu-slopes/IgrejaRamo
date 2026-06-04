"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { supabase } from "@/lib/supabase";

type EscalaPendenteRow = {
  id: string;
  escala_itens?: {
    voluntario_id?: string | null;
    confirmado?: boolean | null;
    confirmacao_status?: string | null;
  }[];
};

function itemPendente(item: { confirmado?: boolean | null; confirmacao_status?: string | null }) {
  const status = item.confirmacao_status ?? (item.confirmado ? "confirmado" : "pendente");
  return status === "pendente";
}

export function usePendingScaleConfirmations(userId?: string | null) {
  const [count, setCount] = useState(0);
  const channelId = useId().replace(/:/g, "");

  const carregar = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    const hoje = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("escalas")
      .select("id, escala_itens!inner(voluntario_id, confirmado, confirmacao_status)")
      .eq("confirmacao_participantes", true)
      .gte("data", hoje)
      .eq("escala_itens.voluntario_id", userId);

    if (error) {
      console.error("Erro ao carregar pendencias de escala:", error.message);
      return;
    }

    const pendentes = new Set<string>();
    for (const escala of (data ?? []) as EscalaPendenteRow[]) {
      if ((escala.escala_itens ?? []).some(itemPendente)) {
        pendentes.add(escala.id);
      }
    }
    setCount(pendentes.size);
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!userId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void carregar();
      }, 200);
    };

    const channel = supabase
      .channel(`pending-scale-confirmations-${channelId}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "escalas" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "escala_itens" }, schedule)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [carregar, channelId, userId]);

  return { count, refresh: carregar };
}
