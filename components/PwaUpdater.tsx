"use client";

import { useEffect } from "react";

/**
 * Detecta quando o service worker registra uma nova versão e recarrega
 * a página automaticamente para que o PWA sempre use a versão mais recente.
 */
export default function PwaUpdater() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys
          .filter((key) => key === "ramo-cache")
          .forEach((key) => {
            void caches.delete(key);
          });
      }).catch(() => {});
    }

    const handleUpdate = (reg: ServiceWorkerRegistration) => {
      const sw = reg.installing ?? reg.waiting;
      if (!sw) return;

      sw.addEventListener("statechange", () => {
        // Quando o novo SW assume o controle, recarrega silenciosamente
        if (sw.state === "activated") {
          window.location.reload();
        }
      });
    };

    navigator.serviceWorker.getRegistration("/").then((reg) => {
      if (!reg) return;

      // Verifica agora (pode já ter SW waiting)
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        handleUpdate(reg);
      }

      // Escuta futuras atualizações
      reg.addEventListener("updatefound", () => handleUpdate(reg));
    });

    // Quando SW assume controle (após skipWaiting), recarrega
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, []);

  return null;
}
