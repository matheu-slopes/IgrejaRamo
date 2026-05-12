"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redireciona para o painel admin já na aba Conteúdo > Devocional
export default function DevocionalAdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/admin?tab=conteudo&secao=devocional");
  }, [router]);
  return null;
}
