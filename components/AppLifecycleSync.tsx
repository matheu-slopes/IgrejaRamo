"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { emitAppRefresh } from "@/hooks/useAppRefresh";

/**
 * Atualiza apenas as variáveis CSS usadas pelo chat para posicionar
 * o input quando o teclado está aberto. NÃO mexe no layout principal.
 */
function updateChatVars() {
  if (typeof window === "undefined") return;

  const vv = window.visualViewport;
  const visualHeight = Math.round(vv?.height ?? window.innerHeight);
  const keyboardOpen = vv ? visualHeight < window.innerHeight - 160 : false;
  const offsetTop = Math.round(vv?.offsetTop ?? 0);

  // Variáveis usadas APENAS pelo chat conversation view
  const height = keyboardOpen ? visualHeight : window.innerHeight;
  document.documentElement.style.setProperty("--chat-vvh", `${height}px`);
  document.documentElement.style.setProperty("--vv-offset-top", keyboardOpen ? `${offsetTop}px` : "0px");
  document.body.classList.toggle("keyboard-open", keyboardOpen);
}

export default function AppLifecycleSync() {
  const router = useRouter();

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let viewportTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleUpdate() {
      updateChatVars();
      if (viewportTimer) clearTimeout(viewportTimer);
      viewportTimer = setTimeout(updateChatVars, 250);
    }

    function onViewportResize() {
      scheduleUpdate();
    }

    function scheduleRefresh(reason: Parameters<typeof emitAppRefresh>[0]) {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        emitAppRefresh(reason);
        router.refresh();
      }, 120);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        updateChatVars();
        scheduleRefresh("visible");
      }
    }
    function onFocus()    { scheduleRefresh("focus"); }
    function onOnline()   { scheduleRefresh("online"); }
    function onPageShow() { scheduleRefresh("pageshow"); }

    // Init
    updateChatVars();

    window.addEventListener("focus",    onFocus);
    window.addEventListener("online",   onOnline);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("resize",   scheduleUpdate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      if (refreshTimer)  clearTimeout(refreshTimer);
      if (viewportTimer) clearTimeout(viewportTimer);
      window.removeEventListener("focus",    onFocus);
      window.removeEventListener("online",   onOnline);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("resize",   scheduleUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [router]);

  return null;
}