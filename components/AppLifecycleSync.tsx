"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { emitAppRefresh } from "@/hooks/useAppRefresh";

export default function AppLifecycleSync() {
  const router = useRouter();

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh(reason: Parameters<typeof emitAppRefresh>[0]) {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        emitAppRefresh(reason);
        router.refresh();
      }, 120);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        scheduleRefresh("visible");
      }
    }
    function onFocus()    { scheduleRefresh("focus"); }
    function onOnline()   { scheduleRefresh("online"); }
    function onPageShow() { scheduleRefresh("pageshow"); }

    window.addEventListener("focus",    onFocus);
    window.addEventListener("online",   onOnline);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (refreshTimer)  clearTimeout(refreshTimer);
      window.removeEventListener("focus",    onFocus);
      window.removeEventListener("online",   onOnline);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}