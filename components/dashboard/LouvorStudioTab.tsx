"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, Clock3, Disc3, Download, Drum, Guitar,
  Gauge, LoaderCircle, Mic2, Music2, Pause, Play, Search, Sparkles,
  Volume2, VolumeX,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type SearchResult = {
  id: string;
  titulo: string;
  artista: string;
  duracao?: number;
  url: string;
  thumbnailUrl?: string;
};

type Projeto = {
  id: string;
  titulo: string;
  artista?: string | null;
  youtube_url: string;
  thumbnail_url?: string | null;
  status: "aguardando" | "baixando" | "analisando" | "separando" | "concluido" | "erro";
  progresso: number;
  tom_original?: string | null;
  bpm?: number | null;
  duracao_segundos?: number | null;
  audio_url?: string | null;
  stem_urls?: Partial<Record<StemName, string | null>>;
  erro?: string | null;
  criado_em: string;
};

type StemName = "vocals" | "drums" | "bass" | "other";
type ToneModule = typeof import("tone");
type AudioEngine = {
  Tone: ToneModule;
  players: Partial<Record<StemName, import("tone").Player>>;
  pitch: Partial<Record<StemName, import("tone").PitchShift>>;
  gains: Partial<Record<StemName, import("tone").Gain>>;
  metronome: import("tone").Loop;
  synth: import("tone").Synth;
};

const STEMS: { id: StemName; label: string; Icon: typeof Mic2; color: string }[] = [
  { id: "vocals", label: "Voz", Icon: Mic2, color: "text-rose-600" },
  { id: "drums", label: "Bateria", Icon: Drum, color: "text-amber-600" },
  { id: "bass", label: "Baixo", Icon: Guitar, color: "text-blue-600" },
  { id: "other", label: "Outros", Icon: Music2, color: "text-violet-600" },
];

const STATUS_LABEL: Record<Projeto["status"], string> = {
  aguardando: "Na fila",
  baixando: "Baixando áudio",
  analisando: "Analisando tom e BPM",
  separando: "Separando instrumentos",
  concluido: "Pronto",
  erro: "Falha no processamento",
};

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function studioFetch(url: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await token()}`,
      ...(init?.headers ?? {}),
    },
  });
}

function formatDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return "--:--";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function tomTransposto(original: string | null | undefined, semitons: number) {
  if (!original) return "?";
  const match = original.match(/^([A-G])(#|b)?(m)?$/);
  if (!match) return original;
  const sharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flats: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
  const base = flats[`${match[1]}${match[2] ?? ""}`] ?? `${match[1]}${match[2] ?? ""}`;
  const index = sharp.indexOf(base);
  if (index < 0) return original;
  return `${sharp[(index + semitons + 120) % 12]}${match[3] ?? ""}`;
}

export function LouvorStudioTab({ workerConfigurado }: { workerConfigurado: boolean }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const response = await studioFetch("/api/louvor-studio/projects");
    const data = await response.json().catch(() => ({})) as { projetos?: Projeto[]; error?: string };
    if (response.ok) {
      setProjects(data.projetos ?? []);
      setSelectedId((current) => current ?? data.projetos?.find((p) => p.status === "concluido")?.id ?? data.projetos?.[0]?.id ?? null);
    } else {
      setMessage(data.error ?? "Não foi possível carregar o Studio.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProjects(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProjects]);

  const pending = projects.some((project) => !["concluido", "erro"].includes(project.status));
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => void loadProjects(), 5000);
    return () => window.clearInterval(timer);
  }, [loadProjects, pending]);

  async function pesquisar(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim() || !workerConfigurado) return;
    setSearching(true);
    setMessage(null);
    try {
      const response = await studioFetch("/api/louvor-studio/search", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
      const data = await response.json().catch(() => ({})) as { resultados?: SearchResult[]; error?: string; detail?: string };
      if (!response.ok) throw new Error(data.error ?? data.detail ?? "A pesquisa falhou.");
      setResults(data.resultados ?? []);
      if (!data.resultados?.length) setMessage("Nenhum resultado encontrado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A pesquisa falhou.");
    } finally {
      setSearching(false);
    }
  }

  async function processar(result: SearchResult) {
    setMessage(null);
    const response = await studioFetch("/api/louvor-studio/projects", {
      method: "POST",
      body: JSON.stringify({
        url: result.url,
        titulo: result.titulo,
        artista: result.artista,
        thumbnailUrl: result.thumbnailUrl,
      }),
    });
    const data = await response.json().catch(() => ({})) as { projeto?: Projeto; error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Não foi possível iniciar o processamento.");
      return;
    }
    setResults([]);
    setQuery("");
    setSelectedId(data.projeto?.id ?? null);
    await loadProjects();
  }

  const selected = projects.find((project) => project.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-rose-700" />
              <h2 className="text-lg font-semibold text-gray-900">Louvor Studio</h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Pesquise uma música autorizada, detecte o tom e o BPM, separe as faixas e ensaie em outro tom.
            </p>
          </div>
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
            Privado para ministros e líderes
          </span>
        </div>

        {!workerConfigurado && (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Interface pronta. Falta publicar o processador de áudio e configurar as duas variáveis do worker na Vercel.</span>
          </div>
        )}

        <form onSubmit={pesquisar} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: Morada É Tudo Sobre Você"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <button
            disabled={searching || !query.trim() || !workerConfigurado}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Pesquisar no YouTube
          </button>
        </form>
        <p className="mt-2 text-[11px] text-gray-400">Use apenas conteúdo próprio, licenciado ou autorizado pelos titulares.</p>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {message}
        </div>
      )}

      {results.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-3 md:p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Resultados</h3>
          <div className="grid gap-2 lg:grid-cols-2">
            {results.map((result) => (
              <article key={result.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5">
                {result.thumbnailUrl ? (
                  // A miniatura vem diretamente do YouTube e não contém dados do usuário.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.thumbnailUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
                ) : <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-gray-100"><Music2 /></div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{result.titulo}</p>
                  <p className="truncate text-xs text-gray-500">{result.artista} · {formatDuration(result.duracao)}</p>
                </div>
                <button
                  onClick={() => void processar(result)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600"
                >
                  <Download className="h-3.5 w-3.5" /> Preparar
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-gray-100 bg-white p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-gray-800">Músicas preparadas</h3>
            <span className="text-xs text-gray-400">{projects.length}</span>
          </div>
          <div className="max-h-[560px] space-y-2 overflow-y-auto">
            {!projects.length && <p className="rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-400">Nenhuma música processada.</p>}
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedId(project.id)}
                className={`w-full rounded-xl border p-2.5 text-left transition ${selectedId === project.id ? "border-rose-200 bg-rose-50" : "border-gray-100 hover:bg-gray-50"}`}
              >
                <p className="truncate text-sm font-semibold text-gray-900">{project.titulo}</p>
                <p className="mt-0.5 truncate text-xs text-gray-400">{project.artista || "YouTube"}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
                  {project.status === "concluido" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> :
                    project.status === "erro" ? <AlertCircle className="h-3.5 w-3.5 text-red-500" /> :
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-500" />}
                  {STATUS_LABEL[project.status]}
                </div>
                {!['concluido', 'erro'].includes(project.status) && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-rose-600 transition-all" style={{ width: `${project.progresso}%` }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0">
          {!selected && (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center">
              <Disc3 className="mb-2 h-9 w-9 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Escolha ou prepare uma música</p>
            </div>
          )}
          {selected && selected.status !== "concluido" && (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-5 text-center">
              {selected.status === "erro" ? <AlertCircle className="mb-3 h-9 w-9 text-red-400" /> : <LoaderCircle className="mb-3 h-9 w-9 animate-spin text-rose-600" />}
              <p className="font-semibold text-gray-900">{STATUS_LABEL[selected.status]}</p>
              <p className="mt-1 max-w-md text-sm text-gray-500">{selected.erro || "Você pode sair desta tela. O processamento continuará no servidor."}</p>
              {selected.status !== "erro" && <p className="mt-3 text-xs font-medium text-rose-700">{selected.progresso}%</p>}
            </div>
          )}
          {selected?.status === "concluido" && <StudioPlayer key={selected.id} project={selected} />}
        </main>
      </div>
    </div>
  );
}

function StudioPlayer({ project }: { project: Projeto }) {
  const engineRef = useRef<AudioEngine | null>(null);
  const animationRef = useRef<number | null>(null);
  const metronomeEnabledRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [semitones, setSemitones] = useState(0);
  const [metronome, setMetronome] = useState(false);
  const [volumes, setVolumes] = useState<Record<StemName, number>>({ vocals: 1, drums: 1, bass: 1, other: 1 });
  const [muted, setMuted] = useState<Record<StemName, boolean>>({ vocals: false, drums: false, bass: false, other: false });
  const vocalsUrl = project.stem_urls?.vocals;
  const drumsUrl = project.stem_urls?.drums;
  const bassUrl = project.stem_urls?.bass;
  const otherUrl = project.stem_urls?.other;
  const stemUrls = useMemo(() => ({
    vocals: vocalsUrl,
    drums: drumsUrl,
    bass: bassUrl,
    other: otherUrl,
  }), [vocalsUrl, drumsUrl, bassUrl, otherUrl]);
  const duration = Number(project.duracao_segundos || 0);

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const Tone = await import("tone");
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel();
      transport.seconds = 0;
      transport.bpm.value = Number(project.bpm || 100);

      const players: AudioEngine["players"] = {};
      const pitch: AudioEngine["pitch"] = {};
      const gains: AudioEngine["gains"] = {};
      for (const stem of STEMS) {
        const url = stemUrls[stem.id];
        if (!url) continue;
        const gain = new Tone.Gain(1).toDestination();
        const shifter = new Tone.PitchShift({ pitch: 0, windowSize: 0.08 }).connect(gain);
        const player = new Tone.Player({ url }).connect(shifter).sync().start(0);
        gains[stem.id] = gain;
        pitch[stem.id] = shifter;
        players[stem.id] = player;
      }
      const synth = new Tone.Synth({ volume: -16, oscillator: { type: "sine" } }).toDestination();
      const loop = new Tone.Loop((time) => {
        if (metronomeEnabledRef.current) synth.triggerAttackRelease("C6", "32n", time);
      }, "4n").start(0);
      await Tone.loaded();
      if (cancelled) {
        Object.values(players).forEach((player) => player?.dispose());
        Object.values(pitch).forEach((effect) => effect?.dispose());
        Object.values(gains).forEach((gain) => gain?.dispose());
        loop.dispose(); synth.dispose();
        return;
      }
      engineRef.current = { Tone, players, pitch, gains, metronome: loop, synth };
      setReady(true);
    }
    void setup();
    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      const engine = engineRef.current;
      if (engine) {
        engine.Tone.getTransport().stop();
        Object.values(engine.players).forEach((player) => player?.dispose());
        Object.values(engine.pitch).forEach((effect) => effect?.dispose());
        Object.values(engine.gains).forEach((gain) => gain?.dispose());
        engine.metronome.dispose(); engine.synth.dispose();
      }
      engineRef.current = null;
    };
  }, [project.bpm, stemUrls]);

  useEffect(() => {
    const tick = () => {
      const engine = engineRef.current;
      if (engine) {
        const current = Math.min(duration, engine.Tone.getTransport().seconds);
        setPosition(current);
        if (duration && current >= duration) {
          engine.Tone.getTransport().stop();
          setPlaying(false);
          setPosition(0);
          return;
        }
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    if (playing) animationRef.current = requestAnimationFrame(tick);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [duration, playing]);

  async function togglePlay() {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.Tone.start();
    const transport = engine.Tone.getTransport();
    if (playing) transport.pause(); else transport.start();
    setPlaying(!playing);
  }

  function seek(value: number) {
    const engine = engineRef.current;
    if (!engine) return;
    engine.Tone.getTransport().seconds = value;
    setPosition(value);
  }

  function updatePitch(next: number) {
    const limited = Math.max(-6, Math.min(6, next));
    setSemitones(limited);
    Object.values(engineRef.current?.pitch ?? {}).forEach((effect) => { if (effect) effect.pitch = limited; });
  }

  function updateVolume(stem: StemName, value: number) {
    setVolumes((current) => ({ ...current, [stem]: value }));
    engineRef.current?.gains[stem]?.gain.rampTo(muted[stem] ? 0 : value, 0.05);
  }

  function toggleMute(stem: StemName) {
    const next = !muted[stem];
    setMuted((current) => ({ ...current, [stem]: next }));
    engineRef.current?.gains[stem]?.gain.rampTo(next ? 0 : volumes[stem], 0.05);
  }

  function toggleMetronome() {
    const next = !metronome;
    metronomeEnabledRef.current = next;
    setMetronome(next);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-[#101820] text-white shadow-sm">
      <div className="border-b border-white/10 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{project.titulo}</p>
            <p className="truncate text-xs text-white/50">{project.artista || "Artista não informado"}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-3 py-1.5">Tom original: <strong>{project.tom_original || "?"}</strong></span>
            <span className="rounded-full bg-white/10 px-3 py-1.5"><Gauge className="mr-1 inline h-3.5 w-3.5" />{Math.round(Number(project.bpm || 0))} BPM</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 md:p-6">
        {STEMS.map(({ id, label, Icon, color }) => (
          <div key={id} className="grid grid-cols-[38px_72px_minmax(0,1fr)_38px] items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-3">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="text-sm font-medium">{label}</span>
            <input
              aria-label={`Volume de ${label}`}
              type="range" min="0" max="1.2" step="0.01" value={volumes[id]}
              onChange={(event) => updateVolume(id, Number(event.target.value))}
              className="h-1.5 w-full accent-rose-500"
            />
            <button onClick={() => toggleMute(id)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10" title={muted[id] ? "Ativar" : "Silenciar"}>
              {muted[id] ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-white/60" />}
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-4 border-t border-white/10 bg-black/20 p-4 md:grid-cols-[minmax(0,1fr)_230px] md:p-6">
        <div className="space-y-4">
          <input
            aria-label="Posição da música"
            type="range" min="0" max={duration || 1} step="0.1" value={position}
            onChange={(event) => seek(Number(event.target.value))}
            className="h-1.5 w-full accent-white"
          />
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>{formatDuration(position)}</span><span>-{formatDuration(Math.max(0, duration - position))}</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleMetronome}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${metronome ? "bg-rose-600 text-white" : "bg-white/10 text-white/60 hover:bg-white/15"}`}
            >
              <Clock3 className="mr-1.5 inline h-4 w-4" /> Metrônomo
            </button>
            <button
              onClick={() => void togglePlay()}
              disabled={!ready}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-gray-950 transition hover:scale-105 disabled:opacity-40"
            >
              {!ready ? <LoaderCircle className="h-6 w-6 animate-spin" /> : playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-1 h-6 w-6 fill-current" />}
            </button>
            <div className="w-[102px]" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Tom da música</p>
          <p className="my-2 text-3xl font-semibold">{tomTransposto(project.tom_original, semitones)}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => updatePitch(semitones - 1)} disabled={semitones <= -6} className="h-9 w-9 rounded-full bg-white/10 text-xl disabled:opacity-30">−</button>
            <span className="w-20 text-xs text-white/55">{semitones === 0 ? "Original" : `${semitones > 0 ? "+" : ""}${semitones} semitons`}</span>
            <button onClick={() => updatePitch(semitones + 1)} disabled={semitones >= 6} className="h-9 w-9 rounded-full bg-white/10 text-xl disabled:opacity-30">+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
