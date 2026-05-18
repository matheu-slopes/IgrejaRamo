"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { emitAppRefresh } from "@/hooks/useAppRefresh";

function updateViewportVars() {
  if (typeof window === "undefined") return;

  const visualViewport = window.visualViewport;
  const offsetTop = Math.round(visualViewport?.offsetTop ?? 0);
  const visualHeight = Math.round(visualViewport?.height ?? window.innerHeight);
  const keyboardOpen = visualViewport ? visualHeight < window.innerHeight - 160 : false;
  // Prompts nativos do iOS (notificação, permissões) também disparam visualViewport.resize.
  // Só usamos visualViewport.height quando a diferença é grande o bastante para ser teclado.
  const height = keyboardOpen ? visualHeight : window.innerHeight;

  document.documentElement.style.setProperty("--app-vvh", `${height}px`);
  document.documentElement.style.setProperty("--chat-vvh", `${height}px`);
  document.documentElement.style.setProperty("--vv-offset-top", keyboardOpen ? `${offsetTop}px` : "0px");
  document.body.classList.toggle("keyboard-open", keyboardOpen);
}

/**
 * iOS PWA: quando o teclado fecha, o visualViewport pode demorar a reportar
 * a altura correta, deixando uma barra em branco. Este fix força o reset
 * em múltiplos momentos após o teclado fechar.
 */
function forceViewportReset() {
  if (typeof window === "undefined") return;

  const fullHeight = window.innerHeight;
  document.documentElement.style.setProperty("--app-vvh", `${fullHeight}px`);
  document.documentElement.style.setProperty("--chat-vvh", `${fullHeight}px`);
  document.documentElement.style.setProperty("--vv-offset-top", "0px");
  document.body.classList.remove("keyboard-open");
}

export default function AppLifecycleSync() {
  const router = useRouter();

  useEffect(() => {
    let refreshTimer:  ReturnType<typeof setTimeout> | null = null;
    let viewportTimer: ReturnType<typeof setTimeout> | null = null;
    let resetTimer1:   ReturnType<typeof setTimeout> | null = null;
    let resetTimer2:   ReturnType<typeof setTimeout> | null = null;
    let resetTimer3:   ReturnType<typeof setTimeout> | null = null;
    let wasKeyboardOpen = false;

    function clearResetTimers() {
      if (resetTimer1) clearTimeout(resetTimer1);
      if (resetTimer2) clearTimeout(resetTimer2);
      if (resetTimer3) clearTimeout(resetTimer3);
    }

    function scheduleViewportUpdate() {
      updateViewportVars();
      if (viewportTimer) clearTimeout(viewportTimer);
      viewportTimer = setTimeout(updateViewportVars, 250);
    }

    function onViewportResize() {
      const visualViewport = window.visualViewport;
      const height = Math.round(visualViewport?.height ?? window.innerHeight);
      const keyboardNowOpen = visualViewport ? height < window.innerHeight - 160 : false;

      // Detecta o momento exato em que o teclado fecha
      if (wasKeyboardOpen && !keyboardNowOpen) {
        clearResetTimers();
        forceViewportReset();
        resetTimer1 = setTimeout(forceViewportReset, 100);
        resetTimer2 = setTimeout(forceViewportReset, 300);
        resetTimer3 = setTimeout(forceViewportReset, 600);
      }

      wasKeyboardOpen = keyboardNowOpen;
      scheduleViewportUpdate();
    }

    function onOrientationChange() {
      // Orientação: precisa recalcular IMEDIATAMENTE (sem debounce)
      // para evitar flash de layout errado na rotação
      const newHeight = window.innerHeight;
      document.documentElement.style.setProperty("--app-vvh", `${newHeight}px`);
      document.documentElement.style.setProperty("--chat-vvh", `${newHeight}px`);
      // Segundo disparo após o browser terminar a animação de rotação
      setTimeout(() => {
        updateViewportVars();
      }, 400);
    }

    function onFocusOut(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (
        wasKeyboardOpen &&
        (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target?.getAttribute("contenteditable") === "true"
        )
      ) {
        // Antecipa o fechamento do teclado (só quando o teclado virtual estava aberto)
        clearResetTimers();
        resetTimer1 = setTimeout(forceViewportReset, 100);
        resetTimer2 = setTimeout(forceViewportReset, 350);
        resetTimer3 = setTimeout(forceViewportReset, 700);
      }
      scheduleViewportUpdate();
    }

    function scheduleRefresh(reason: Parameters<typeof emitAppRefresh>[0]) {
      scheduleViewportUpdate();
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        emitAppRefresh(reason);
        router.refresh();
      }, 120);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        forceViewportReset();
        scheduleRefresh("visible");
      }
    }
    function onFocus()    { scheduleRefresh("focus"); }
    function onOnline()   { scheduleRefresh("online"); }
    function onPageShow() {
      forceViewportReset();
      scheduleRefresh("pageshow");
    }

    updateViewportVars();

    window.addEventListener("focus",             onFocus);
    window.addEventListener("online",            onOnline);
    window.addEventListener("pageshow",          onPageShow);
    window.addEventListener("resize",            scheduleViewportUpdate);
    window.addEventListener("orientationchange", onOrientationChange);
    window.addEventListener("focusout",          onFocusOut);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    window.visualViewport?.addEventListener("scroll", scheduleViewportUpdate);

    return () => {
      if (refreshTimer)  clearTimeout(refreshTimer);
      if (viewportTimer) clearTimeout(viewportTimer);
      clearResetTimers();
      window.removeEventListener("focus",             onFocus);
      window.removeEventListener("online",            onOnline);
      window.removeEventListener("pageshow",          onPageShow);
      window.removeEventListener("resize",            scheduleViewportUpdate);
      window.removeEventListener("orientationchange", onOrientationChange);
      window.removeEventListener("focusout",          onFocusOut);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      window.visualViewport?.removeEventListener("scroll", scheduleViewportUpdate);
    };
  }, [router]);

  return null;
}