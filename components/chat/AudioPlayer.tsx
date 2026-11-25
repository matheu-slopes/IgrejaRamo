"use client";

import { useEffect, useRef, useState } from "react";
import { MicOff, Play, Square } from "lucide-react";
import clsx from "clsx";

// --- AudioPlayer -------------------------------------------------
// O MediaRecorder n�o escreve dura��o nos metadados do WebM.
// O hack: seek para 1e101 for�a o browser a varrer o arquivo e calcular a dura��o real.
export function AudioPlayer({ src, isMe, onRetry }: { src: string; isMe: boolean; onRetry?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [current, setCurrent]   = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const seekingDuration = useRef(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    seekingDuration.current = false;
    setPlaying(false); setCurrent(0); setDuration(0); setLoadError(false);

    function tryFix() {
      if (!el) return;
      if (!isFinite(el.duration) || el.duration === 0) {
        seekingDuration.current = true;
        el.currentTime = 1e101; // for�a o browser a determinar o final do arquivo
      } else {
        setDuration(el.duration);
      }
    }
    function onDurationChange() {
      if (!el) return;
      if (isFinite(el.duration) && el.duration > 0) {
        setDuration(el.duration);
        if (seekingDuration.current) {
          seekingDuration.current = false;
          el.currentTime = 0;
          setCurrent(0);
        }
      }
    }
    function onTimeUpdate() {
      if (!el || seekingDuration.current) return;
      setCurrent(el.currentTime);
    }
    function onEnded() {
      setPlaying(false);
      if (el) { el.currentTime = 0; setCurrent(0); }
    }
    function onError() { setLoadError(true); setPlaying(false); }
    function onPlay() { setPlaying(true); }
    function onPause() { setPlaying(false); }
    el.addEventListener("loadedmetadata", tryFix);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    if (el.readyState >= 1) tryFix();
    return () => {
      el.removeEventListener("loadedmetadata", tryFix);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [src]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause(); else void el.play().catch(() => setLoadError(true));
  }
  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current;
    if (!el) return;
    const t = parseFloat(e.target.value);
    el.currentTime = t;
    setCurrent(t);
  }
  function fmt(s: number) {
    if (!isFinite(s) || isNaN(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  return (
    <div className={clsx(
      "flex items-center gap-2 px-3 py-2.5 rounded-2xl w-[240px] max-w-full",
      isMe
        ? "bg-slate-700 text-white rounded-br-sm"
        : "bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-sm"
    )}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      {loadError ? (
        <>
          <div className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            isMe ? "bg-white/20 text-white/60" : "bg-gray-100 text-gray-400"
          )}>
            <MicOff className="w-3.5 h-3.5" />
          </div>
          <button type="button" onClick={() => { setLoadError(false); onRetry?.(); audioRef.current?.load(); }} className={clsx("text-xs flex-1 text-left", isMe ? "text-white/60" : "text-gray-400")}>
            Áudio indisponível. Tentar novamente
          </button>
        </>
      ) : (
        <>
          <button
            type="button" aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"} onClick={toggle}
            className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
              isMe ? "bg-white/20 hover:bg-white/30 text-white" : "bg-slate-700 hover:bg-slate-800 text-white"
            )}
          >
            {playing
              ? <Square className="w-3 h-3 fill-current" />
              : <Play   className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>
          <input
            aria-label="Posição do áudio" type="range" min={0} max={duration || 100} step={0.1} value={current}
            onChange={seek}
            className="flex-1 h-1 rounded-full cursor-pointer min-w-0"
            style={{ accentColor: isMe ? "white" : "#4a6741" }}
          />
          <span className={clsx("text-[10px] font-medium shrink-0 tabular-nums", isMe ? "text-gray-200" : "text-gray-400")}>
            {fmt(current)}&nbsp;/&nbsp;{fmt(duration)}
          </span>
        </>
      )}
    </div>
  );
}
