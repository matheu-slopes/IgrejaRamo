"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-gray-900">Nao foi possivel carregar esta tela.</p>
        <p className="mt-2 text-sm text-gray-500">
          Atualize esta area para buscar as informacoes novamente.
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
