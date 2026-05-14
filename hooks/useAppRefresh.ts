"use client";

import { useEffect, useRef, type DependencyList } from "react";

export const APP_REFRESH_EVENT = "ramo:app-refresh";

type RefreshReason = "mount" | "focus" | "visible" | "pageshow" | "online" | "manual";

type RefreshOptions = {
  runOnMount?: boolean;
  minIntervalMs?: number;
};

export function emitAppRefresh(reason: RefreshReason = "manual") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_REFRESH_EVENT, { detail: { reason } }));
}

export function useAppRefresh(
  refresh: (reason: RefreshReason) => void | Promise<void>,
  deps: DependencyList = [],
  options: RefreshOptions = {}
) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let disposed = false;
    let lastRun = 0;
    const minIntervalMs = options.minIntervalMs ?? 1500;

    function run(reason: RefreshReason) {
      if (disposed) return;
      const now = Date.now();
      if (now - lastRun < minIntervalMs) return;
      lastRun = now;
      void refreshRef.current(reason);
    }

    function onFocus() { run("focus"); }
    function onOnline() { run("online"); }
    function onPageShow() { run("pageshow"); }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") run("visible");
    }
    function onAppRefresh(event: Event) {
      const detail = (event as CustomEvent<{ reason?: RefreshReason }>).detail;
      run(detail?.reason ?? "manual");
    }

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener(APP_REFRESH_EVENT, onAppRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (options.runOnMount !== false) {
      window.requestAnimationFrame(() => run("mount"));
    }

    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener(APP_REFRESH_EVENT, onAppRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}