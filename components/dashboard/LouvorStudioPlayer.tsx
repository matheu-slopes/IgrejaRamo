"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  LoaderCircle,
  Play,
  Pause,
  RotateCcw,
  VolumeX,
  Volume2,
  Mic2,
  Drum,
  Guitar,
  Music2,
  AudioLines,
  MoreHorizontal,
  X,
  Minus,
  Plus,
  RotateCw,
  Gauge,
  Timer,
  Repeat2,
  Download,
} from "lucide-react";
import {
  at,
  stop,
  start,
  createRealtimeStem,
  createRealtimeLiveStem,
  setRealtimePitch,
  setRealtimeLivePitch,
  setRealtimeRate,
  type StudioEngine as Engine,
} from "@/lib/louvorStudioRealtime";
import styles from "./LouvorStudioPlayer.module.css";
import { supabase } from "@/lib/supabase";
import {
  NOTES,
  Direction,
  keyAt,
  transposeSemitones,
} from "@/lib/louvorStudioMusic";
import { estimateBeatOffset } from "@/lib/louvorStudioBeat";
type Stem = "vocals" | "instrumental" | "drums" | "bass" | "other";
type Project = {
  id: string;
  titulo: string;
  artista?: string | null;
  tom_original?: string | null;
  tom_base_confirmado?: string | null;
  bpm?: number | null;
  beat_offset_seg?: number | null;
  separation_mode?: string;
  stem_urls?: Partial<Record<Stem, string | null>>;
};
type EscolhaParaEscala = { tom: string; bpm?: number };
type PlayerProps = {
  project: Project;
  onEscolherTomDaEscala?: (escolha: EscolhaParaEscala) => void;
  salvandoTomDaEscala?: boolean;
  tomBaseOverride?: string | null;
};
type Version = {
  id: string;
  semitones: number;
  speed: number;
  status: string;
  progresso: number;
  erro?: string;
  stem_urls?: Partial<Record<Stem, string | null>>;
  mix_wav_url?: string;
  mix_mp3_url?: string;
};
const LABELS: Record<Stem, string> = {
  vocals: "Voz",
  instrumental: "Instrumental",
  drums: "Bateria",
  bass: "Baixo",
  other: "Outros instrumentos",
};
const ICONS = {
  vocals: Mic2,
  instrumental: AudioLines,
  drums: Drum,
  bass: Guitar,
  other: Music2,
};
const INITIAL: Record<Stem, number> = {
  vocals: 1,
  instrumental: 1,
  drums: 1,
  bass: 1,
  other: 1,
};
async function api(url: string, body?: unknown, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const { data } = await supabase.auth.getSession();
        if (controller.signal.aborted) throw Error("Solicitação cancelada.");
        const response = await fetch(url, {
          method: body ? "POST" : "GET",
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + (data.session?.access_token ?? ""),
          },
        });
        const payload = await response.json();
        if (!response.ok)
          throw Error(payload.error ?? "Falha ao consultar a versão.");
        return payload;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Error("A consulta demorou demais. Tente novamente."));
        }, 20000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
async function baixarArquivo(url: string | undefined, name: string) {
  if (!url) throw new Error("Arquivo indisponível.");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível baixar o arquivo.");
  const blob = await response.blob();
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
function secondsText(value: number) {
  return (
    Math.floor(value / 60) +
    ":" +
    Math.floor(value % 60)
      .toString()
      .padStart(2, "0")
  );
}

/**
 * Mobile browsers struggle when four long MP3s are decoded into Web Audio at
 * once: decoded PCM can consume more than a gigabyte. The lightweight player
 * streams the MP3s through native media elements instead, keeping the PWA
 * responsive while retaining the per-track volume, mute, solo and seek tools.
 */
function MobileStudioPlayer({ project, onEscolherTomDaEscala, salvandoTomDaEscala = false, tomBaseOverride }: PlayerProps) {
  const urls = project.stem_urls ?? {};
  const tomBase = tomBaseOverride || project.tom_base_confirmado || project.tom_original;
  const initial = keyAt(tomBase || "C", 0);
  const [ready, setReady] = useState(false);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("");
  const [volumes, setVolumes] = useState(INITIAL);
  const [muted, setMuted] = useState<Partial<Record<Stem, boolean>>>({});
  const [solo, setSolo] = useState<Stem | null>(null);
  const [master, setMaster] = useState(0.8);
  const tracksRef = useRef<Partial<Record<Stem, HTMLAudioElement>>>({});
  const contextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Partial<Record<Stem, MediaElementAudioSourceNode>>>({});
  const realtimeNodesRef = useRef<Partial<Record<Stem, import("signalsmith-stretch").StretchNode>>>({});
  const [target, setTarget] = useState(initial);

  const stems = (Object.keys(urls) as Stem[]).filter((stem) => urls[stem]);
  let semitones = 0;
  try {
    semitones = transposeSemitones(initial, target, "auto");
  } catch {}

  useEffect(() => {
    let disposed = false;
    setReady(false);
    setRealtimeReady(false);
    setPlaying(false);
    setPosition(0);
    setMessage("");
    const tracks: Partial<Record<Stem, HTMLAudioElement>> = {};
    let context: AudioContext | null = null;
    const sources: Partial<Record<Stem, MediaElementAudioSourceNode>> = {};
    let nodes: Partial<Record<Stem, import("signalsmith-stretch").StretchNode>> = {};
    const waitForMetadata = (audio: HTMLAudioElement) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          audio.removeEventListener("loadedmetadata", loaded);
          audio.removeEventListener("error", failed);
        };
        const loaded = () => {
          done();
          resolve();
        };
        const failed = () => {
          done();
          reject(Error("Não foi possível transmitir uma faixa."));
        };
        audio.addEventListener("loadedmetadata", loaded);
        audio.addEventListener("error", failed);
        audio.load();
      });
    async function load() {
      try {
        if (!stems.length) throw Error("Faixas indisponíveis.");
        const waiting = stems.map((stem) => {
          const audio = new Audio();
          audio.preload = "metadata";
          audio.crossOrigin = "anonymous";
          audio.src = urls[stem]!;
          tracks[stem] = audio;
          return waitForMetadata(audio);
        });
        await Promise.all(waiting);
        if (disposed) return;
        const durations = stems
          .map((stem) => tracks[stem]?.duration ?? 0)
          .filter((value) => Number.isFinite(value) && value > 0);
        if (!durations.length) throw Error("A duração das faixas não foi encontrada.");
        tracksRef.current = tracks;
        setDuration(Math.min(...durations));
        try {
          context = new AudioContext({ latencyHint: "playback" });
          for (const stem of stems) {
            const source = context.createMediaElementSource(tracks[stem]!);
            sources[stem] = source;
            const node = await createRealtimeLiveStem(context, source);
            node.connect(context.destination);
            nodes[stem] = node;
          }
          if (disposed) return;
          contextRef.current = context;
          sourcesRef.current = sources;
          realtimeNodesRef.current = nodes;
          setRealtimeReady(true);
        } catch {
          // O navegador ainda pode tocar por streaming mesmo que o AudioWorklet
          // não esteja disponível. Reconecta todas as faixas sem transposição.
          for (const node of Object.values(nodes)) {
            node?.disconnect();
            node?.port.close();
          }
          for (const source of Object.values(sources)) {
            try { source?.disconnect(); source?.connect(context!.destination); } catch {}
          }
          nodes = {};
          if (!disposed) setMessage("A transposição ao vivo não é compatível com este navegador. A música continua disponível no tom original.");
        }
        setReady(true);
      } catch (error) {
        if (!disposed)
          setMessage(error instanceof Error ? error.message : "Não foi possível carregar as faixas.");
      }
    }
    void load();
    return () => {
      disposed = true;
      Object.values(tracks).forEach((audio) => {
        audio?.pause();
        audio?.removeAttribute("src");
        audio?.load();
      });
      for (const node of Object.values(nodes)) {
        node?.disconnect();
        node?.port.close();
      }
      for (const source of Object.values(sources)) source?.disconnect();
      void context?.close();
      tracksRef.current = {};
      sourcesRef.current = {};
      realtimeNodesRef.current = {};
      contextRef.current = null;
    };
    // URLs identify a distinct prepared project; loading is intentionally once
    // per project, not once per volume or playback adjustment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, JSON.stringify(urls)]);

  useEffect(() => {
    for (const stem of stems) {
      const audio = tracksRef.current[stem];
      if (!audio) continue;
      const silent = Boolean(muted[stem] || (solo && solo !== stem));
      audio.volume = silent ? 0 : Math.max(0, Math.min(1, master * volumes[stem]));
    }
  }, [master, muted, solo, stems, volumes]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const lead = tracksRef.current[stems[0]];
      if (!lead) return;
      if (lead.ended || lead.currentTime >= lead.duration) {
        Object.values(tracksRef.current).forEach((audio) => audio?.pause());
        setPlaying(false);
        setPosition(0);
      } else setPosition(lead.currentTime);
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, stems]);

  function seek(value: number) {
    const next = Math.max(0, Math.min(duration, value));
    Object.values(tracksRef.current).forEach((audio) => {
      if (audio) audio.currentTime = next;
    });
    setPosition(next);
  }

  async function toggle() {
    const tracks = Object.values(tracksRef.current).filter(
      (audio): audio is HTMLAudioElement => Boolean(audio),
    );
    if (!tracks.length || !ready) return;
    if (playing) {
      tracks.forEach((audio) => audio.pause());
      setPlaying(false);
      return;
    }
    try {
      if (contextRef.current?.state === "suspended") await contextRef.current.resume();
      tracks.forEach((audio) => {
        audio.currentTime = position;
      });
      await Promise.all(tracks.map((audio) => audio.play()));
      setPlaying(true);
    } catch {
      tracks.forEach((audio) => audio.pause());
      setMessage("O celular não permitiu iniciar todas as faixas. Toque em Reproduzir novamente.");
    }
  }

  function stepTone(change: number) {
    if (!realtimeReady || !tomBase) return;
    const next = Math.max(-11, Math.min(11, semitones + change));
    const context = contextRef.current;
    if (!context) return;
    setRealtimeLivePitch(context, realtimeNodesRef.current, next);
    setTarget(keyAt(initial, next));
  }

  return (
    <section aria-label="Player de ensaio no celular" className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top_right,_#344b51_0%,_#202f35_50%,_#131d23_100%)] p-4 text-white shadow-xl">
      <header className="min-w-0">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">Louvor Studio · modo leve</p>
        <h3 className="truncate text-lg font-semibold">{project.titulo}</h3>
        {project.artista && <p className="mt-1 truncate text-sm text-white/50">{project.artista}</p>}
      </header>
      <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/65">As faixas são transmitidas sem baixar a música inteira na memória do celular. Você pode testar outro tom ao vivo; a bateria mantém o tom original.</p>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-semibold text-white/90">Tom para ensaiar</p><p className="mt-0.5 text-[11px] text-white/55">{tomBase ? (realtimeReady ? "Altera ao vivo neste celular." : "Indisponível neste navegador.") : "Confirme o tom-base no Studio."}</p></div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Descer um semitom" disabled={!realtimeReady || !tomBase || semitones <= -11} onClick={() => stepTone(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-25"><Minus size={19} /></button>
            <span aria-live="polite" className="flex h-10 min-w-12 items-center justify-center rounded-lg bg-white text-sm font-bold text-[#203138]">{tomBase ? target : "—"}</span>
            <button type="button" aria-label="Subir um semitom" disabled={!realtimeReady || !tomBase || semitones >= 11} onClick={() => stepTone(1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-25"><Plus size={19} /></button>
          </div>
        </div>
        {onEscolherTomDaEscala && <button type="button" disabled={!realtimeReady || !tomBase || salvandoTomDaEscala} onClick={() => onEscolherTomDaEscala({ tom: target, bpm: project.bpm ?? undefined })} className="mt-3 min-h-10 w-full rounded-lg bg-emerald-300 px-3 text-xs font-bold text-emerald-950 disabled:opacity-40">{salvandoTomDaEscala ? "Salvando tom…" : `Usar tom ${target} nesta escala`}</button>}
      </div>

      <div className="mt-4 space-y-2" aria-label="Faixas de áudio">
        {stems.map((stem) => {
          const Icon = ICONS[stem];
          const silent = Boolean(muted[stem] || (solo && solo !== stem));
          return (
            <div key={stem} className="rounded-xl bg-black/15 px-2 py-2">
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`Silenciar ${LABELS[stem]}`} aria-pressed={Boolean(muted[stem])} onClick={() => setMuted((current) => ({ ...current, [stem]: !current[stem] }))} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${silent ? "text-white/30" : "text-white/90"}`}>
                  {muted[stem] ? <VolumeX size={20} /> : <Icon size={21} />}
                </button>
                <label className="min-w-0 flex-1 text-xs text-white/70">
                  <span className="flex justify-between gap-2"><span>{LABELS[stem]}</span><span>{Math.round(volumes[stem] * 100)}%</span></span>
                  <input aria-label={`Volume de ${LABELS[stem]}`} className={styles.slider} style={{ "--level": `${volumes[stem] * 100}%`, "--fill": silent ? "#64747a" : "#f1f5f4" } as CSSProperties} type="range" min="0" max="1" step=".01" value={volumes[stem]} onChange={(event) => setVolumes((current) => ({ ...current, [stem]: Number(event.target.value) }))} />
                </label>
                <button type="button" aria-pressed={solo === stem} onClick={() => setSolo(solo === stem ? null : stem)} className={`min-h-10 rounded-lg px-2 text-[11px] ${solo === stem ? "bg-white text-[#203138]" : "text-white/60"}`}>Solo</button>
              </div>
            </div>
          );
        })}
      </div>

      <label className="mt-4 flex items-center gap-3 text-xs text-white/65">
        <Volume2 size={17} /> Volume geral
        <input aria-label="Volume geral" className={styles.slider + " min-w-0 flex-1"} style={{ "--level": `${master * 100}%`, "--fill": "#f1f5f4" } as CSSProperties} type="range" min="0" max="1" step=".01" value={master} onChange={(event) => setMaster(Number(event.target.value))} />
      </label>
      {message && <p className="mt-3 text-xs text-amber-100" role="status">{message}</p>}

      <div className="mt-5">
        <input aria-label="Posição da música" className={styles.slider} style={{ "--level": `${duration ? position / duration * 100 : 0}%`, "--fill": "#f1f5f4" } as CSSProperties} type="range" min="0" max={duration || 1} step=".1" value={position} disabled={!ready} onChange={(event) => seek(Number(event.target.value))} />
        <div className="-mt-1 flex justify-between text-xs tabular-nums text-white/45"><span>{secondsText(position)}</span><span>−{secondsText(Math.max(0, duration - position))}</span></div>
        <div className="mt-3 flex items-center justify-center gap-5">
          <button type="button" aria-label="Voltar 10 segundos" disabled={!ready} onClick={() => seek(position - 10)} className="flex h-12 w-12 flex-col items-center justify-center text-white/80 disabled:opacity-30"><RotateCcw size={22} /><span className="text-[9px]">10s</span></button>
          <button type="button" aria-label={playing ? "Pausar" : "Reproduzir"} disabled={!ready} onClick={() => void toggle()} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#203138] shadow-lg disabled:opacity-40">{!ready ? <LoaderCircle className="animate-spin" /> : playing ? <Pause size={27} fill="currentColor" /> : <Play size={27} fill="currentColor" className="ml-1" />}</button>
          <button type="button" aria-label="Avançar 10 segundos" disabled={!ready} onClick={() => seek(position + 10)} className="flex h-12 w-12 flex-col items-center justify-center text-white/80 disabled:opacity-30"><RotateCw size={22} /><span className="text-[9px]">10s</span></button>
        </div>
      </div>
    </section>
  );
}

export function LouvorStudioPlayer({ project, onEscolherTomDaEscala, salvandoTomDaEscala, tomBaseOverride }: PlayerProps) {
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  if (mobile == null)
    return <section aria-busy="true" className="flex min-h-48 items-center justify-center rounded-2xl bg-[#203138] p-4 text-sm text-white/65"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Carregando player…</section>;
  return mobile
    ? <MobileStudioPlayer project={project} onEscolherTomDaEscala={onEscolherTomDaEscala} salvandoTomDaEscala={salvandoTomDaEscala} tomBaseOverride={tomBaseOverride} />
    : <DesktopStudioPlayer project={project} onEscolherTomDaEscala={onEscolherTomDaEscala} salvandoTomDaEscala={salvandoTomDaEscala} tomBaseOverride={tomBaseOverride} />;
}
function tempoName(bpm: number) {
  if (bpm < 60) return "Largo";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Andante moderato";
  if (bpm < 168) return "Allegro";
  return "Presto";
}
function DesktopStudioPlayer({ project, onEscolherTomDaEscala, salvandoTomDaEscala = false, tomBaseOverride }: PlayerProps) {
  const tomBase = tomBaseOverride || project.tom_base_confirmado || project.tom_original;
  const initial = keyAt(tomBase || "C", 0);
  const analyzedBeatOffset =
    typeof project.beat_offset_seg === "number" &&
    Number.isFinite(project.beat_offset_seg) &&
    project.beat_offset_seg >= 0
      ? project.beat_offset_seg
      : null;
  const [keyConfirmed, setKeyConfirmed] = useState(
    Boolean(tomBase),
  );
  const [metronome, setMetronome] = useState(false);
  const [metronomeVolume, setMetronomeVolume] = useState(0.7);
  const [metronomePan, setMetronomePan] = useState(0);
  const [metronomeSubdivision, setMetronomeSubdivision] = useState<
    0.5 | 1 | 2
  >(1);
  const [beatOffset, setBeatOffset] = useState(analyzedBeatOffset ?? 0);
  const [panel, setPanel] = useState<
    "tone" | "tempo" | "metronome" | "loop" | "more" | null
  >(null);
  const [trackOptions, setTrackOptions] = useState<Stem | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toneDialogRef = useRef<HTMLDialogElement | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  useEffect(() => {
    const dialog = toneDialogRef.current;
    if (panel === "tone") {
      if (dialog && !dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  }, [panel]);
  useEffect(() => {
    if (!panel || panel === "tone") return;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [panel]);
  const [original, setOriginal] = useState(initial),
    [target, setTarget] = useState(initial);
  const [direction, setDirection] = useState<Direction>("auto"),
    [speed, setSpeed] = useState(1);
  const originalBpm =
    typeof project.bpm === "number" && Number.isFinite(project.bpm) && project.bpm > 0
      ? project.bpm
      : null;
  const currentBpm = originalBpm ? Math.round(originalBpm * speed) : null;
  const [tempoText, setTempoText] = useState(
    originalBpm ? String(Math.round(originalBpm)) : "",
  );
  const [version, setVersion] = useState<Version | null>(null),
    [versions, setVersions] = useState<Version[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null),
    [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState(""),
    [ready, setReady] = useState(false),
    [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0),
    [duration, setDuration] = useState(0);
  const [volumes, setVolumes] = useState(INITIAL),
    [muted, setMuted] = useState<Partial<Record<Stem, boolean>>>({});
  const [solo, setSolo] = useState<Stem | null>(null),
    [master, setMaster] = useState(0.8);
  const [loop, setLoop] = useState<{
    start: number;
    end: number | null;
  } | null>(null);
  const engineRef = useRef<Engine | null>(null),
    loopRef = useRef(loop);
  const requestId = useRef(0);
  const mixSettings = useRef({ volumes, muted, solo, master });
  let semitones = 0;
  try {
    semitones = transposeSemitones(original, target, direction);
  } catch {}
  const urls = project.stem_urls ?? {};
  const urlsKey = JSON.stringify(urls);
  const pending = versions.find((v) => v.id === pendingId);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const result = await api(
        "/api/louvor-studio/projects/" + project.id + "/versions",
        undefined,
        signal,
      );
      setVersions(result.versions ?? []);
      return result.versions as Version[];
    },
    [project.id],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void refresh(controller.signal).catch(() => {}),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!pendingId) return;
    const controller = new AbortController();
    let busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const list = await refresh(controller.signal);
        const found = list.find((v) => v.id === pendingId);
        if (found?.status === "concluido") {
          setVersion(found);
          setPendingId(null);
          setMessage("Download pronto nas opções do player.");
        } else if (found?.status === "erro") {
          setPendingId(null);
          setMessage(
            found.erro ??
              "A exportação falhou. Tente novamente nas opções do player.",
          );
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error ? error.message : "Falha ao acompanhar.",
          );
      } finally {
        busy = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [pendingId, refresh]);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController(),
      context = new AudioContext({ latencyHint: "playback" });
    const masterNode = context.createGain();
    masterNode.gain.value = mixSettings.current.master;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    masterNode.connect(limiter);
    limiter.connect(context.destination);
    const engine: Engine = {
      context,
      buffers: {},
      nodes: {},
      rate: 1,
      semitones: 0,
      latency: 0,
      gains: {},
      master: masterNode,
      sources: [],
      offset: 0,
      started: 0,
      playing: false,
      duration: 0,
    };
    engineRef.current = engine;
    async function load() {
      await Promise.resolve();
      if (cancelled) return;
      setReady(false);
      setRealtimeReady(false);
      setPlaying(false);
      setPosition(0);
      setLoop(null);
      try {
        const entries = Object.entries(
          JSON.parse(urlsKey) as Partial<Record<Stem, string>>,
        ).filter(([, url]) => Boolean(url));
        if (!entries.length) throw Error("Faixas indisponíveis.");
        await Promise.all(
          entries.map(async ([name, url]) => {
            const response = await fetch(url!, { signal: controller.signal });
            if (!response.ok)
              throw Error(
                "Não foi possível carregar uma faixa. Atualize a página.",
              );
            const buffer = await context.decodeAudioData(
              await response.arrayBuffer(),
            );
            if (buffer.numberOfChannels !== 2)
              throw Error(
                "Uma faixa não está em estéreo. Prepare a música novamente.",
              );
            if (cancelled) return;
            const gain = context.createGain();
            gain.connect(masterNode);
            const s = name as Stem,
              settings = mixSettings.current;
            gain.gain.value =
              settings.muted[s] || (settings.solo && settings.solo !== s)
                ? 0
                : settings.volumes[s];
            engine.gains[s] = gain;
            engine.buffers[s] = buffer;
          }),
        );
        if (cancelled) return;
        const durations = Object.values(engine.buffers).map((b) => b!.duration);
        if (Math.max(...durations) - Math.min(...durations) > 0.1)
          throw Error("As faixas têm durações incompatíveis.");
        engine.duration = Math.min(...durations);
        // Older prepared songs do not yet have a server beat grid. Detect it
        // from the percussion-rich stem once, before the live player starts.
        if (originalBpm && analyzedBeatOffset == null) {
          const rhythmStem =
            engine.buffers.drums ??
            engine.buffers.instrumental ??
            engine.buffers.other ??
            Object.values(engine.buffers)[0];
          if (rhythmStem) {
            const detected = estimateBeatOffset(rhythmStem, originalBpm);
            if (detected != null) setBeatOffset(detected);
          }
        }
        // Let the original music play as soon as it has decoded. The optional
        // realtime processor may take longer on a full multi-track song.
        setDuration(engine.duration);
        setReady(true);
        const realtimeNodes: Partial<
          Record<Stem, import("signalsmith-stretch").StretchNode>
        > = {};
        let realtimeLatency = 0;
        try {
          for (const [stem, buffer] of Object.entries(engine.buffers)) {
            const node = await createRealtimeStem(context, buffer);
            if (cancelled) {
              node.disconnect();
              node.port.close();
              return;
            }
            realtimeNodes[stem as Stem] = node;
            realtimeLatency = Math.max(realtimeLatency, await node.latency());
          }
          for (const [stem, node] of Object.entries(realtimeNodes))
            node.connect(engine.gains[stem as Stem]!);
          engine.nodes = realtimeNodes;
          engine.latency = realtimeLatency;
          // PCM was transferred to the worklets; release duplicate AudioBuffers.
          engine.buffers = {};
          setRealtimeReady(true);
        } catch {
          for (const node of Object.values(realtimeNodes)) {
            node.disconnect();
            node.port.close();
          }
          if (!cancelled)
            setMessage(
              "A prévia instantânea não ficou disponível. Você ainda pode ouvir o original e baixar o tom preparado.",
            );
        }
      } catch (error) {
        if (!cancelled)
          setMessage(
            error instanceof Error
              ? error.message
              : "Falha ao carregar o áudio.",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
      stop(engine);
      for (const node of Object.values(engine.nodes)) {
        node.disconnect();
        node.port.close();
      }
      void context.close();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [urlsKey]);
  useEffect(() => {
    mixSettings.current = { volumes, muted, solo, master };
    const engine = engineRef.current;
    if (!engine) return;
    engine.master.gain.setTargetAtTime(
      master,
      engine.context.currentTime,
      0.015,
    );
    for (const [name, gain] of Object.entries(engine.gains)) {
      const stem = name as Stem;
      gain!.gain.setTargetAtTime(
        muted[stem] || (solo && solo !== stem) ? 0 : volumes[stem],
        engine.context.currentTime,
        0.015,
      );
    }
  }, [volumes, muted, solo, master]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      let value = Math.max(0, at(engine));
      const bounds = loopRef.current;
      if (bounds?.end != null && value >= bounds.end) {
        start(engine, bounds.start);
        value = bounds.start;
      } else if (value >= engine.duration) {
        stop(engine);
        engine.offset = 0;
        setPlaying(false);
        value = 0;
      }
      setPosition(value);
    }, 50);
    return () => window.clearInterval(timer);
  }, [playing]);
  useEffect(
    () => () => {
      requestId.current++;
    },
    [],
  );
  useEffect(() => {
    const engine = engineRef.current;
    if (!playing || !metronome || !project.bpm || !engine) return;
    const beat = 60 / project.bpm / metronomeSubdivision;
    const phase = ((beatOffset % beat) + beat) % beat;
    let next =
      phase +
      Math.ceil((Math.max(0, at(engine)) - phase) / beat) * beat;
    let previous = at(engine);
    const scheduled: OscillatorNode[] = [];
    const tick = () => {
      const current = at(engine);
      if (current < previous - 0.1)
        next =
          phase + Math.ceil((Math.max(0, current) - phase) / beat) * beat;
      previous = current;
      while (next < current + 0.12) {
        const when = engine.started + (next - engine.offset) / engine.rate;
        if (when >= engine.context.currentTime) {
          const oscillator = engine.context.createOscillator(),
            gain = engine.context.createGain(),
            panner = engine.context.createStereoPanner();
          oscillator.frequency.value = 1000;
          panner.pan.value = metronomePan;
          gain.gain.setValueAtTime(0.1 * metronomeVolume, when);
          gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
          oscillator.connect(gain);
          gain.connect(panner);
          panner.connect(engine.master);
          oscillator.start(when);
          oscillator.stop(when + 0.045);
          scheduled.push(oscillator);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
            panner.disconnect();
            const i = scheduled.indexOf(oscillator);
            if (i >= 0) scheduled.splice(i, 1);
          };
        }
        next += beat;
      }
    };
    const timer = window.setInterval(tick, 25);
    return () => {
      window.clearInterval(timer);
      scheduled.forEach((o) => {
        try {
          o.stop();
        } catch {}
      });
    };
  }, [
    playing,
    metronome,
    beatOffset,
    metronomePan,
    metronomeSubdivision,
    metronomeVolume,
    project.bpm,
    speed,
    urlsKey,
  ]);
  async function toggle() {
    const engine = engineRef.current;
    if (!engine || !ready) return;
    await engine.context.resume();
    if (engine.playing) {
      stop(engine);
      setPosition(engine.offset);
      setPlaying(false);
    } else {
      start(engine, engine.offset);
      setPlaying(true);
    }
  }
  function seek(value: number) {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.playing) start(engine, value);
    else engine.offset = value;
    setPosition(value);
  }
  async function prepare(selection?: {
    original: string;
    target: string;
    direction: Direction;
    speed: number;
  }) {
    setRequesting(true);
    setMessage("");
    const id = ++requestId.current;
    try {
      const result = await api(
        "/api/louvor-studio/projects/" + project.id + "/versions",
        selection ?? { original, target, direction, speed },
      );
      if (id !== requestId.current) return;
      const next = result.version as Version;
      setVersions((current) => [
        ...current.filter((v) => v.id !== next.id),
        next,
      ]);
      if (next.status === "concluido") {
        setVersion(next);
        setPendingId(null);
        setMessage("Download pronto nas opções do player.");
      } else {
        setPendingId(next.id);
        setMessage(
          "O download está sendo preparado. Você pode continuar ouvindo e mudando o tom.",
        );
      }
    } catch (error) {
      if (id === requestId.current)
        setMessage(
          error instanceof Error ? error.message : "A transposição falhou.",
        );
    } finally {
      if (id === requestId.current) setRequesting(false);
    }
  }
  function reset() {
    const engine = engineRef.current;
    if (engine && realtimeReady) {
      setRealtimePitch(engine, 0);
      setRealtimeRate(engine, 1);
    }
    setTarget(original);
    setSpeed(1);
    if (originalBpm != null) setTempoText(String(Math.round(originalBpm)));
    setDirection("auto");
  }
  const currentSemitones = semitones;
  const currentSpeed = speed;
  const currentKey = keyConfirmed ? keyAt(original, currentSemitones) : "—";
  const busy = requesting || Boolean(pendingId);
  const field =
    "mt-2 w-full rounded-xl border border-white/15 bg-[#223138] px-3 py-2.5 text-sm text-white outline-none focus:border-white/50";
  const pill =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/15 px-3.5 py-2 text-xs transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  function togglePanel(next: typeof panel) {
    setPanel(panel === next ? null : next);
  }
  function stepTone(change: number) {
    const engine = engineRef.current;
    if (!engine || !realtimeReady || !keyConfirmed) return;
    const next = Math.max(-11, Math.min(11, semitones + change));
    if (!setRealtimePitch(engine, next)) return;
    setTarget(keyAt(original, next));
    setDirection(next > 0 ? "up" : next < 0 ? "down" : "auto");
  }
  function changeSpeed(value: number) {
    const engine = engineRef.current;
    if (engine && setRealtimeRate(engine, value)) setSpeed(value);
  }
  function changeTempo(value: number) {
    if (!originalBpm || !Number.isFinite(value)) return;
    const minimum = Math.ceil(originalBpm * 0.5);
    const maximum = Math.floor(originalBpm * 1.5);
    const bpm = Math.max(minimum, Math.min(maximum, Math.round(value)));
    // Keep cache keys stable while allowing any whole-number target BPM.
    changeSpeed(Number((bpm / originalBpm).toFixed(6)));
    setTempoText(String(bpm));
  }
  function applyTempoText() {
    const parsed = Number(tempoText);
    if (Number.isFinite(parsed)) changeTempo(parsed);
    else if (currentBpm != null) setTempoText(String(currentBpm));
  }
  function sliderStyle(value: number, silent = false): CSSProperties {
    return {
      "--level": `${value * 100}%`,
      "--fill": silent ? "#64747a" : "#f1f5f4",
    } as CSSProperties;
  }
  return (
    <section
      aria-label="Player de ensaio"
      className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top_right,_#344b51_0%,_#202f35_50%,_#131d23_100%)] p-5 text-white shadow-xl sm:p-7"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-white/45">
            Louvor Studio · ensaio
          </p>
          <h3 className="text-lg font-semibold leading-snug sm:text-xl">
            {project.titulo}
          </h3>
          {project.artista && (
            <p className="mt-1 text-sm text-white/50">{project.artista}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="Mais opções"
          aria-expanded={panel === "more"}
          aria-controls="studio-options"
          onClick={() => togglePanel("more")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 transition hover:bg-white/10"
        >
          <MoreHorizontal size={22} />
        </button>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={pill}
          onClick={() => togglePanel("tone")}
          aria-expanded={panel === "tone"}
          aria-controls="studio-tone-dialog"
        >
          <Music2 size={14} />
          <span>
            Tom <strong className="ml-1 text-sm">{currentKey}</strong>
          </span>
        </button>
        <button
          type="button"
          className={pill + " text-white/65"}
          onClick={() => togglePanel("tempo")}
          aria-expanded={panel === "tempo"}
          aria-controls="studio-options"
        >
          <Gauge size={14} />
          {currentBpm != null ? `${currentBpm} BPM` : "BPM"}
        </button>
        {(currentSemitones !== 0 || currentSpeed !== 1) && (
          <button
            type="button"
            onClick={reset}
            className="ml-auto flex min-h-10 items-center gap-1.5 text-xs text-white/60 hover:text-white"
          >
            <RotateCcw size={13} />
            Original
          </button>
        )}
      </div>

      {onEscolherTomDaEscala && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/25 bg-emerald-300/10 p-3">
          <div>
            <p className="text-xs font-semibold text-emerald-100">Tom escolhido para este culto</p>
            <p className="mt-0.5 text-xs text-white/60">Teste no player e confirme somente quando a equipe estiver confortável.</p>
          </div>
          <button
            type="button"
            disabled={!keyConfirmed || salvandoTomDaEscala}
            onClick={() => onEscolherTomDaEscala({ tom: currentKey, bpm: currentBpm ?? undefined })}
            className="rounded-xl bg-emerald-300 px-3.5 py-2.5 text-xs font-bold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvandoTomDaEscala ? "Salvando tom…" : `Usar tom ${currentKey} nesta escala`}
          </button>
        </div>
      )}

      <div className="my-6 space-y-1 sm:my-8" aria-label="Faixas de áudio">
        {(Object.keys(urls) as Stem[])
          .filter((stem) => urls[stem])
          .map((stem) => {
            const Icon = ICONS[stem];
            const silent = Boolean(muted[stem] || (solo && solo !== stem));
            return (
              <div key={stem}>
                <div className="flex items-center gap-3 py-2 sm:gap-4">
                  <button
                    type="button"
                    title={
                      muted[stem]
                        ? `Ativar ${LABELS[stem]}`
                        : `Silenciar ${LABELS[stem]}`
                    }
                    aria-label={`Silenciar ${LABELS[stem]}`}
                    aria-pressed={Boolean(muted[stem])}
                    onClick={() =>
                      setMuted((current) => ({
                        ...current,
                        [stem]: !current[stem],
                      }))
                    }
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition hover:bg-white/10 ${silent ? "text-white/30" : "text-white/90"}`}
                  >
                    {muted[stem] ? (
                      <VolumeX size={23} strokeWidth={1.5} />
                    ) : (
                      <Icon size={25} strokeWidth={1.5} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-[11px]">
                      <span
                        className={silent ? "text-white/35" : "text-white/65"}
                      >
                        {LABELS[stem]}
                        {solo === stem && (
                          <span className="ml-2 text-emerald-200">Solo</span>
                        )}
                      </span>
                      <span className="tabular-nums text-white/35">
                        {muted[stem]
                          ? "Mudo"
                          : `${Math.round(volumes[stem] * 100)}%`}
                      </span>
                    </div>
                    <input
                      aria-label={`Volume de ${LABELS[stem]}`}
                      className={styles.slider}
                      style={sliderStyle(volumes[stem], silent)}
                      type="range"
                      min="0"
                      max="1"
                      step=".01"
                      value={volumes[stem]}
                      onChange={(e) =>
                        setVolumes((current) => ({
                          ...current,
                          [stem]: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Opções de ${LABELS[stem]}`}
                    aria-expanded={trackOptions === stem}
                    onClick={() =>
                      setTrackOptions(trackOptions === stem ? null : stem)
                    }
                    className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xl text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <MoreHorizontal size={21} />
                  </button>
                </div>
                {trackOptions === stem && (
                  <div className="mb-3 ml-14 flex flex-wrap items-center gap-2 rounded-xl bg-black/15 p-2">
                    <button
                      type="button"
                      className={pill + (solo === stem ? " bg-white/15" : "")}
                      aria-pressed={solo === stem}
                      onClick={() => setSolo(solo === stem ? null : stem)}
                    >
                      {solo === stem ? "Desativar solo" : "Ouvir só esta faixa"}
                    </button>
                    <button
                      type="button"
                      className={pill}
                      onClick={() => void baixarArquivo(urls[stem] ?? undefined, stem + ".mp3")}
                    >
                      <Download size={13} />
                      Baixar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={
            pill +
            (muted.vocals && !solo
              ? " border-white/40 bg-white/10"
              : " text-white/65")
          }
          aria-pressed={Boolean(muted.vocals && !solo)}
          onClick={() => {
            setSolo(null);
            setMuted({ vocals: true });
          }}
        >
          <AudioLines size={15} />
          Instrumental
        </button>
        <button
          type="button"
          className={
            pill +
            (solo === "vocals"
              ? " border-white/40 bg-white/10"
              : " text-white/65")
          }
          aria-pressed={solo === "vocals"}
          onClick={() => {
            setMuted({});
            setSolo("vocals");
          }}
        >
          <Mic2 size={15} />
          Só voz
        </button>
        <button
          type="button"
          className={pill + " text-white/65"}
          onClick={() => {
            setMuted({});
            setSolo(null);
          }}
        >
          Todas
        </button>
      </div>

      {pendingId && (
        <div
          className="mt-5 rounded-xl bg-white/5 p-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-xs text-white/75">
            <LoaderCircle size={14} className="animate-spin" />
            {pending?.status === "aguardando"
              ? "Download na fila"
              : "Preparando download"}
            <span className="ml-auto tabular-nums">
              {pending?.progresso ?? 0}%
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-200 transition-all"
              style={{ width: `${pending?.progresso ?? 0}%` }}
            />
          </div>
        </div>
      )}
      {message && (
        <p
          className="mt-4 text-xs leading-relaxed text-amber-100/90"
          role="status"
        >
          {message}
        </p>
      )}

      <div className="mt-8 sm:mt-10">
        <input
          aria-label="Posição da música"
          className={styles.slider}
          style={sliderStyle(duration ? position / duration : 0)}
          type="range"
          min="0"
          max={duration || 1}
          step=".1"
          value={position}
          disabled={!ready}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <div className="-mt-1 flex justify-between text-xs tabular-nums text-white/45">
          <span>{secondsText(position)}</span>
          <span>−{secondsText(Math.max(0, duration - position))}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!project.bpm}
            aria-label="Metrônomo"
            aria-pressed={metronome}
            aria-expanded={panel === "metronome"}
            aria-controls="studio-options"
            title={
              project.bpm
                ? "Configurar metrônomo"
                : "BPM não identificado"
            }
            onClick={() => togglePanel("metronome")}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-25 ${metronome || panel === "metronome" ? "bg-white/15 text-emerald-200" : "text-white/60"}`}
          >
            <Timer size={24} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Voltar 10 segundos"
            disabled={!ready}
            onClick={() => seek(Math.max(0, position - 10))}
            className="flex h-12 w-12 flex-col items-center justify-center text-white/80 disabled:opacity-30"
          >
            <RotateCcw size={23} />
            <span className="text-[9px]">10s</span>
          </button>
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={!ready}
            aria-label={playing ? "Pausar" : "Reproduzir"}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-[#203138] shadow-lg transition hover:scale-105 disabled:opacity-40"
          >
            {!ready ? (
              <LoaderCircle className="animate-spin" />
            ) : playing ? (
              <Pause size={27} fill="currentColor" />
            ) : (
              <Play size={27} fill="currentColor" className="ml-1" />
            )}
          </button>
          <button
            type="button"
            aria-label="Avançar 10 segundos"
            disabled={!ready}
            onClick={() => seek(Math.min(duration, position + 10))}
            className="flex h-12 w-12 flex-col items-center justify-center text-white/80 disabled:opacity-30"
          >
            <RotateCw size={23} />
            <span className="text-[9px]">10s</span>
          </button>
          <button
            type="button"
            aria-label="Alterar tom"
            aria-expanded={panel === "tone"}
            aria-controls="studio-tone-dialog"
            onClick={() => togglePanel("tone")}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-xl transition hover:bg-white/10 ${panel === "tone" ? "bg-white/15" : "text-white/75"}`}
          >
            ♭♯
          </button>
        </div>
      </div>

      {panel && panel !== "tone" && (
        <div
          id="studio-options"
          ref={panelRef}
          className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              {
                {
                  tempo: "Andamento do ensaio",
                  metronome: "Metrônomo de ensaio",
                  loop: "Repetir um trecho",
                  more: "Opções do player",
                }[panel]
              }
            </h4>
            <button
              type="button"
              aria-label="Fechar painel"
              onClick={() => setPanel(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/10"
            >
              <X size={17} />
            </button>
          </div>
          {panel === "tempo" && (
            <>
              {originalBpm != null ? (
                <>
                  <p className="text-xs text-white/60">
                    Defina o BPM desejado. O tom é mantido automaticamente.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      aria-label="Diminuir um BPM"
                      disabled={!realtimeReady || currentBpm == null}
                      onClick={() => changeTempo((currentBpm ?? originalBpm) - 1)}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-35"
                    >
                      <Minus size={21} />
                    </button>
                    <label className="w-32 text-center text-xs text-white/55">
                      BPM desejado
                      <input
                        aria-label="BPM desejado"
                        type="text"
                        inputMode="numeric"
                        value={tempoText}
                        disabled={!realtimeReady}
                        onChange={(event) => setTempoText(event.target.value)}
                        onBlur={applyTempoText}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-center text-lg font-semibold tabular-nums text-[#203138] outline-none disabled:opacity-35"
                      />
                    </label>
                    <button
                      type="button"
                      aria-label="Aumentar um BPM"
                      disabled={!realtimeReady || currentBpm == null}
                      onClick={() => changeTempo((currentBpm ?? originalBpm) + 1)}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-35"
                    >
                      <Plus size={21} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/50">
                    <span>Original: {Math.round(originalBpm)} BPM</span>
                    <span>
                      Limite: {Math.ceil(originalBpm * 0.5)}–
                      {Math.floor(originalBpm * 1.5)} BPM
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-pressed={speed === 1}
                    disabled={!realtimeReady}
                    onClick={() => changeTempo(originalBpm)}
                    className={`mt-3 min-h-10 w-full rounded-xl text-sm disabled:opacity-40 ${speed === 1 ? "bg-white text-[#203138]" : "bg-white/5 text-white/60"}`}
                  >
                    Usar BPM original
                  </button>
                </>
              ) : (
                <p className="text-xs text-white/50">
                  O BPM original ainda não foi identificado para esta música.
                </p>
              )}
            </>
          )}
          {panel === "metronome" && (
            <>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Metrônomo</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    Acompanha a velocidade da música.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="Ativar metrônomo"
                  aria-checked={metronome}
                  disabled={!originalBpm}
                  onClick={() => setMetronome((active) => !active)}
                  className={`relative h-8 w-14 rounded-full transition disabled:opacity-35 ${metronome ? "bg-cyan-400" : "bg-white/15"}`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${metronome ? "left-7" : "left-1"}`}
                  />
                </button>
              </div>
              {originalBpm != null ? (
                <>
                  <label className="mt-4 block text-xs text-white/60">
                    Volume do metrônomo
                    <input
                      aria-label="Volume do metrônomo"
                      className={styles.slider}
                      style={sliderStyle(metronomeVolume)}
                      type="range"
                      min="0"
                      max="1"
                      step=".01"
                      value={metronomeVolume}
                      onChange={(event) =>
                        setMetronomeVolume(Number(event.target.value))
                      }
                    />
                  </label>
                  <label className="mt-3 block text-xs text-white/60">
                    Balanço do clique
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true">L</span>
                      <input
                        aria-label="Balanço do metrônomo, esquerda e direita"
                        className={styles.slider}
                        style={sliderStyle((metronomePan + 1) / 2)}
                        type="range"
                        min="-1"
                        max="1"
                        step=".01"
                        value={metronomePan}
                        onChange={(event) =>
                          setMetronomePan(Number(event.target.value))
                        }
                      />
                      <span aria-hidden="true">R</span>
                    </div>
                  </label>
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-xs text-white/60">Subdivisão</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(
                        [
                          [0.5, "0,5×"],
                          [1, "1×"],
                          [2, "2×"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={metronomeSubdivision === value}
                          onClick={() => setMetronomeSubdivision(value)}
                          className={`min-h-11 rounded-xl text-sm ${metronomeSubdivision === value ? "bg-white text-[#203138]" : "bg-white/5 text-white/60"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-white/45">
                      0,5× marca a cada dois tempos; 2× marca duas vezes por
                      tempo.
                    </p>
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-4 text-center">
                    <p className="text-sm text-white/65">
                      {tempoName(currentBpm ?? Math.round(originalBpm))}
                    </p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums">
                      {currentBpm} BPM
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        aria-label="Diminuir um BPM"
                        disabled={!realtimeReady}
                        onClick={() =>
                          changeTempo((currentBpm ?? originalBpm) - 1)
                        }
                        className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10 disabled:opacity-35"
                      >
                        <Minus size={22} />
                      </button>
                      <button
                        type="button"
                        onClick={() => changeTempo(originalBpm)}
                        className="min-h-10 rounded-xl px-3 text-xs text-white/60 hover:bg-white/10"
                      >
                        BPM original
                      </button>
                      <button
                        type="button"
                        aria-label="Aumentar um BPM"
                        disabled={!realtimeReady}
                        onClick={() =>
                          changeTempo((currentBpm ?? originalBpm) + 1)
                        }
                        className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10 disabled:opacity-35"
                      >
                        <Plus size={22} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePanel("tempo")}
                      className="mt-2 min-h-9 text-xs text-white/50 underline hover:text-white"
                    >
                      Informar BPM exato
                    </button>
                    <p className="mt-3 border-t border-white/10 pt-3 text-[11px] text-white/40">
                      Sincronização automática com a batida da música.
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-xs text-white/50">
                  O BPM original ainda não foi identificado para esta música.
                </p>
              )}
            </>
          )}
          {panel === "loop" && (
            <>
              <p className="text-xs leading-relaxed text-white/60">
                Marque o início A, avance a música e marque o fim B.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={
                    !ready ||
                    (loop?.end === null && position <= loop.start + 0.5)
                  }
                  onClick={() =>
                    setLoop(
                      !loop || loop.end !== null
                        ? { start: position, end: null }
                        : { ...loop, end: position },
                    )
                  }
                  className={pill}
                >
                  {!loop || loop.end !== null
                    ? "Marcar início A"
                    : "Marcar fim B"}
                </button>
                {loop && (
                  <>
                    <span className="text-xs tabular-nums text-white/60">
                      {secondsText(loop.start)} →{" "}
                      {loop.end == null ? "…" : secondsText(loop.end)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLoop(null)}
                      className="min-h-10 text-xs underline"
                    >
                      Limpar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          {panel === "more" && (
            <>
              <label className="flex items-center gap-3 text-xs text-white/60">
                <Volume2 size={18} />
                Volume geral
                <input
                  aria-label="Volume geral"
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={master}
                  onChange={(e) => setMaster(Number(e.target.value))}
                  className={styles.slider + " min-w-0 flex-1"}
                  style={sliderStyle(master)}
                />
              </label>
              <button
                type="button"
                aria-controls="studio-options"
                onClick={() => togglePanel("loop")}
                className={`mt-3 flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm transition ${loop?.end != null ? "bg-emerald-200/15 text-emerald-100" : "bg-white/5 text-white/75 hover:bg-white/10"}`}
              >
                <span className="flex items-center gap-2">
                  <Repeat2 size={17} />
                  Repetir trecho
                </span>
                <span className="text-xs">
                  {loop?.end != null ? "Ativo" : "Configurar"}
                </span>
              </button>
              <details className="mt-3 text-xs text-white/60">
                <summary className="cursor-pointer py-2">
                  Corrigir tom original
                </summary>
                <label className="mt-2 block">
                  Tom identificado na gravação
                  <select
                    aria-label="Tom original"
                    disabled={!ready}
                    value={original}
                    onChange={(e) => {
                      const next = e.target.value;
                      setOriginal(next);
                      setKeyConfirmed(true);
                      setTarget(keyAt(next, currentSemitones));
                    }}
                    className={field}
                  >
                    {[false, true].flatMap((minor) =>
                      NOTES.map((note) => (
                        <option
                          key={note.value + (minor ? "m" : "")}
                          value={note.value + (minor ? "m" : "")}
                        >
                          {note.label} {minor ? "menor" : "maior"}
                        </option>
                      )),
                    )}
                  </select>
                </label>
                {!keyConfirmed && (
                  <button
                    type="button"
                    onClick={() => setKeyConfirmed(true)}
                    className="mt-2 min-h-10 underline"
                  >
                    Confirmar {original} como original
                  </button>
                )}
              </details>
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-sm font-medium">
                  Download de alta qualidade
                </p>
                <p className="mt-1 text-xs text-white/50">
                  A escuta muda na hora. Para baixar, prepare o arquivo no tom{" "}
                  {currentKey}
                  {currentBpm != null ? `, a ${currentBpm} BPM.` : "."}
                </p>
                <button
                  type="button"
                  disabled={busy || !keyConfirmed}
                  onClick={() => void prepare()}
                  className="mt-3 min-h-11 w-full rounded-xl bg-white px-3 text-sm font-semibold text-[#203138] disabled:opacity-35"
                >
                  {busy
                    ? "Preparando download…"
                    : "Preparar download neste tom"}
                </button>
              </div>
              {versions.some((v) => v.status === "concluido") && (
                <label className="mt-3 block text-xs text-white/60">
                  Downloads prontos
                  <select
                    aria-label="Downloads prontos"
                    className={field}
                    value={version?.id ?? ""}
                    onChange={(e) => {
                      const found = versions.find(
                        (v) => v.id === e.target.value,
                      );
                      setVersion(found ?? null);
                    }}
                  >
                    <option value="">Original</option>
                    {versions
                      .filter((v) => v.status === "concluido")
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {keyAt(original, v.semitones)} ·{" "}
                          {originalBpm
                            ? `${Math.round(originalBpm * v.speed)} BPM`
                            : "andamento ajustado"}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {version?.status === "concluido" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={pill}
                    onClick={() => void baixarArquivo(version.mix_mp3_url, "mix.mp3")}
                  >
                    <Download size={14} />
                    Mix MP3
                  </button>
                  <button
                    type="button"
                    className={pill}
                    onClick={() => void baixarArquivo(version.mix_wav_url, "mix.flac")}
                  >
                    <Download size={14} />
                    Mix FLAC
                  </button>
                </div>
              )}
              <p className="mt-3 text-xs leading-relaxed text-white/40">
                Para baixar uma faixa, abra suas opções (•••). Os controles de
                volume e solo afetam apenas a reprodução.
              </p>
            </>
          )}
        </div>
      )}
      <dialog
        ref={toneDialogRef}
        id="studio-tone-dialog"
        aria-labelledby="studio-tone-title"
        className={styles.toneDialog}
        onCancel={() => setPanel(null)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            setPanel(null);
        }}
      >
        <button
          type="button"
          aria-label="Fechar ajuste de tom"
          onClick={() => setPanel(null)}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-white/40 hover:bg-white/10"
        >
          <X size={18} />
        </button>
        <h4
          id="studio-tone-title"
          className="text-center text-base font-semibold"
        >
          Tom da música
        </h4>
        <div
          className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-semibold text-[#20272a]"
          aria-live="polite"
        >
          {keyConfirmed ? target : "—"}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            aria-label="Descer um semitom"
            disabled={!realtimeReady || !keyConfirmed || semitones <= -11}
            onClick={() => stepTone(-1)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-25"
          >
            <Minus size={24} />
          </button>
          <div
            aria-hidden="true"
            className="flex h-16 min-w-0 flex-1 items-center justify-between gap-1 overflow-hidden"
          >
            {Array.from({ length: 23 }, (_, i) => i - 11).map((value) => (
              <span
                key={value}
                className={`w-0.5 shrink-0 rounded-full transition-all ${value === semitones ? "h-16 bg-white" : value === 0 ? "h-12 bg-white/35" : "h-10 bg-white/10"}`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Subir um semitom"
            disabled={!realtimeReady || !keyConfirmed || semitones >= 11}
            onClick={() => stepTone(1)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-25"
          >
            <Plus size={24} />
          </button>
        </div>
        <div
          className="mt-3 min-h-5 text-center text-xs text-white/50"
          role="status"
          aria-live="polite"
        >
          {!realtimeReady
            ? ready
              ? "Transposição ao vivo indisponível"
              : "Carregando áudio…"
            : semitones === 0
              ? "Tom original"
              : `${semitones > 0 ? "+" : ""}${semitones} ${Math.abs(semitones) === 1 ? "semitom" : "semitons"}`}
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={semitones === 0 && speed === 1}
          className="mx-auto mt-3 block min-h-11 px-4 text-sm text-white/65 hover:text-white disabled:text-white/20"
        >
          Voltar ao original
        </button>
        {!keyConfirmed && (
          <button
            type="button"
            onClick={() => setPanel("more")}
            className="mt-3 w-full text-xs text-amber-100 underline"
          >
            Informe o tom original nas opções do player
          </button>
        )}
      </dialog>
    </section>
  );
}
