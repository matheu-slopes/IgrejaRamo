"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { emitAppRefresh } from "@/hooks/useAppRefresh";

function updateViewportVars() {
  if (typeof window === "undefined") return;

  const visualViewport = window.visualViewport;
  const height = Math.round(visualViewport?.height ?? window.innerHeight);
  const offsetTop = Math.round(visualViewport?.offsetTop ?? 0);
  const keyboardOpen = visualViewport ? height < window.innerHeight - 80 : false;

  document.documentElement.style.setProperty("--app-vvh", `${height}px`);
  document.documentElement.style.setProperty("--chat-vvh", `${height}px`);
  document.documentElement.style.setProperty("--vv-offset-top", `${offsetTop}px`);
  document.body.classList.toggle("keyboard-open", keyboardOpen);
}

export default function AppLifecycleSync() {
  const router = useRouter();

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let viewportTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleViewportUpdate() {
      updateViewportVars();
      if (viewportTimer) clearTimeout(viewportTimer);
      viewportTimer = setTimeout(updateViewportVars, 250);
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
      if (document.visibilityState === "visible") scheduleRefresh("visible");
    }
    function onFocus() { scheduleRefresh("focus"); }
    function onOnline() { scheduleRefresh("online"); }
    function onPageShow() { scheduleRefresh("pageshow"); }

    updateViewportVars();

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("resize", scheduleViewportUpdate);
    window.addEventListener("orientationchange", scheduleViewportUpdate);
    window.addEventListener("focusout", scheduleViewportUpdate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.visualViewport?.addEventListener("resize", scheduleViewportUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleViewportUpdate);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (viewportTimer) clearTimeout(viewportTimer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("resize", scheduleViewportUpdate);
      window.removeEventListener("orientationchange", scheduleViewportUpdate);
      window.removeEventListener("focusout", scheduleViewportUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.visualViewport?.removeEventListener("resize", scheduleViewportUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleViewportUpdate);
    };
  }, [router]);

  return null;
}