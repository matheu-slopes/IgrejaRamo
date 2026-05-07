"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redireciona para o painel admin já na aba Conteúdo > Avisos
export default function AvisosRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/admin?tab=conteudo&secao=avisos");
  }, [router]);
  return null;
}
