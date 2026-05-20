"use client";

import { useState, useMemo } from "react";
import { X, Search, Music2, Check, ExternalLink, Loader2, AlertCircle, ChevronRight, EyeOff, Eye } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { TONS } from "@/components/dashboard/EscalasTab";

// ── Transposição de cifra ──────────────────────────────────────────────────
const NOTES_S = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTES_F = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function noteIdx(n: string) {
  let i = NOTES_S.indexOf(n);
  if (i === -1) i = NOTES_F.indexOf(n);
  return i;
}

function tomIdx(tom: string) {
  // strip 'm' suffix for minor keys to get the root
  return noteIdx(tom.replace(/m$/, ""));
}

function transposeWord(word: string, semis: number): string {
  const m = word.match(/^([A-G][#b]?)(.*?)(\/?[A-G][#b]?)?$/);
  if (!m || noteIdx(m[1]) === -1) return word;
  const newRoot = NOTES_S[(noteIdx(m[1]) + semis + 12) % 12];
  let bass = "";
  if (m[3] && m[3].startsWith("/")) {
    const bassNote = m[3].slice(1);
    if (noteIdx(bassNote) !== -1) {
      bass = "/" + NOTES_S[(noteIdx(bassNote) + semis + 12) % 12];
    } else {
      bass = m[3];
    }
  }
  return newRoot + (m[2] || "") + bass;
}

// Suporta notação brasileira: F7M (Fmaj7), G7+ (Gaug7), Dm7b5, Csus4, etc.
const CHORD_RE = /^[A-G][#b]?(m(?:aj)?|M(?:aj)?|dim|aug|sus[24]?|add)?[0-9]*([\+Mb5])?(\/[A-G][#b]?)?$/;

function isChordLine(line: string) {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  return words.filter(w => CHORD_RE.test(w)).length / words.length >= 0.55;
}

function transposeCifra(lines: string[], semis: number): string[] {
  if (semis === 0) return lines;
  return lines.map(line =>
    isChordLine(line)
      ? line.replace(/\S+/g, w => transposeWord(w, semis))
      : line
  );
}
// ──────────────────────────────────────────────────────────────────────────

interface Sugestao {
  titulo: string;
  artista: string;
  url: string;
  artistaSlug: string;
  musicaSlug: string;
}

interface CifraResult {
  artist: string;
  name: string;
  tom_original?: string | null;
  youtube_url?: string;
  cifraclub_url?: string;
  cifra: string[];
}

interface Props {
  onClose: () => void;
  onSalva: (musica: { titulo: string; artista: string; tom: string; artistaSlug: string; musicaSlug: string }) => void;
}

export default function BuscarCifraModal({ onClose, onSalva }: Props) {
  const [query, setQuery] = useState("");
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [resultado, setResultado] = useState<CifraResult | null>(null);
  const [tomOriginal, setTomOriginal] = useState(""); // tom detectado da página
  const [tom, setTom] = useState("");                  // tom escolhido pelo usuário
  const [estilo, setEstilo] = useState("");
  const [erro, setErro] = useState("");
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [loadingCifra, setLoadingCifra] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [esconderTabs, setEsconderTabs] = useState(false);
  const [sugestaoSelecionada, setSugestaoSelecionada] = useState<Sugestao | null>(null);

  // Linha de tablatura: começa com nome de corda + | OU é cabeçalho/rodapé de bloco de tab
  function isTabLine(line: string) {
    if (/^\s*[EBGDAe]\s*\|/.test(line)) return true;
    // "[Tab - ...]", "[Tab]", "Parte N de N" que ficam em blocos de tablatura
    if (/^\s*\[Tab[\s\-]/i.test(line)) return true;
    if (/^\s*Parte\s+\d+\s+de\s+\d+/i.test(line)) return true;
    return false;
  }

  // Cifra transposta automaticamente quando o tom muda
  const cifraExibida = useMemo(() => {
    if (!resultado) return [];
    const orig = tomOriginal;
    const dest = tom;
    if (!orig || !dest || orig === dest) return resultado.cifra;
    const fromIdx = tomIdx(orig);
    const toIdx2  = tomIdx(dest);
    if (fromIdx === -1 || toIdx2 === -1) return resultado.cifra;
    const semis = (toIdx2 - fromIdx + 12) % 12;
    return transposeCifra(resultado.cifra, semis);
  }, [resultado, tom, tomOriginal]);

  // Cifra com tabs opcionalmente removidas (só para exibição)
  const cifraFiltrada = useMemo(() => {
    if (!esconderTabs) return cifraExibida;
    const filtered = cifraExibida.filter(line => !isTabLine(line));
    // Remove linhas em branco consecutivas que ficam após remover blocos de tab
    return filtered.reduce<string[]>((acc, line) => {
      if (line.trim() === "" && acc.length > 0 && acc[acc.length - 1].trim() === "") return acc;
      return [...acc, line];
    }, []);
  }, [cifraExibida, esconderTabs]);

  async function buscarSugestoes() {
    if (!query.trim()) return;
    setLoadingBusca(true);
    setErro("");
    setSugestoes([]);
    setResultado(null);
    setSalvo(false);

    const res = await fetch(`/api/buscar-cifra?q=${encodeURIComponent(query.trim())}`);
    const data = await res.json();

    if (!res.ok || !data.results?.length) {
      setErro("Nenhum resultado encontrado. Tente outro nome.");
    } else {
      setSugestoes(data.results);
    }
    setLoadingBusca(false);
  }

  async function buscarCifra(s: Sugestao) {
    setLoadingCifra(true);
    setErro("");
    setSugestoes([]);
    setSalvo(false);
    setSugestaoSelecionada(s);

    const params = new URLSearchParams({ artista: s.artistaSlug, musica: s.musicaSlug });
    const res = await fetch(`/api/buscar-cifra?${params}`);
    const data = await res.json();

    if (!res.ok) {
      setErro(data.error ?? "Erro ao buscar cifra.");
      setSugestoes([s]);
    } else {
      setResultado(data);
      const orig = data.tom_original ?? "";
      setTomOriginal(orig);
      setTom(orig); // começa no tom original
    }
    setLoadingCifra(false);
  }

  function salvar() {
    if (!resultado || !sugestaoSelecionada) return;
    setSalvo(true);
    onSalva({
      titulo: resultado.name,
      artista: resultado.artist,
      tom: tom || "",
      artistaSlug: sugestaoSelecionada.artistaSlug,
      musicaSlug: sugestaoSelecionada.musicaSlug,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Music2 className="w-5 h-5 text-grape-700" />
            <h2 className="text-base font-bold text-gray-900">Buscar no Cifra Club</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Campo de busca */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-2">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarSugestoes()}
              placeholder="Ex: Bondade de Deus, Oceans Hillsong..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-grape-400"
              autoFocus
            />
            <button
              onClick={buscarSugestoes}
              disabled={loadingBusca || loadingCifra}
              className="flex items-center gap-1.5 bg-grape-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-grape-800 transition disabled:opacity-60 shrink-0"
            >
              {loadingBusca ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erro}
            </div>
          )}
        </div>

        {/* Sugestões */}
        {sugestoes.length > 0 && !resultado && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-2">Selecione a música</p>
            {sugestoes.map((s, i) => (
              <button
                key={i}
                onClick={() => buscarCifra(s)}
                disabled={loadingCifra}
                className="w-full flex items-center justify-between gap-3 bg-gray-50 hover:bg-grape-50 border border-gray-100 hover:border-grape-200 rounded-xl px-4 py-3 transition text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.titulo || s.musicaSlug.replace(/-/g, " ")}</p>
                  <p className="text-xs text-gray-400">{s.artista || s.artistaSlug.replace(/-/g, " ")}</p>
                </div>
                {loadingCifra
                  ? <Loader2 className="w-4 h-4 text-grape-400 animate-spin shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                }
              </button>
            ))}
          </div>
        )}

        {/* Loading cifra */}
        {loadingCifra && !resultado && sugestoes.length === 0 && (
          <div className="flex-1 flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando cifra...
          </div>
        )}

        {/* Resultado da cifra */}
        {resultado && (
          <>
            <div className="px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{resultado.name}</p>
                  <p className="text-sm text-gray-500">{resultado.artist}</p>
                  {resultado.cifraclub_url && (
                    <a href={resultado.cifraclub_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-grape-600 flex items-center gap-1 mt-0.5 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Ver no Cifra Club
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
                  <div className="flex flex-col items-start sm:items-end gap-0.5">
                    {tomOriginal && tom !== tomOriginal && (
                      <span className="text-[10px] text-gray-400 leading-none">original: {tomOriginal}</span>
                    )}
                    <select
                      value={tom}
                      onChange={(e) => setTom(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white font-semibold"
                    >
                      <option value="">Tom...</option>
                      {TONS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <input
                    value={estilo}
                    onChange={(e) => setEstilo(e.target.value)}
                    placeholder="Estilo..."
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none w-24"
                  />
                </div>
              </div>
            </div>

            {/* Preview da cifra */}
            <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
              <div className="flex items-center justify-end px-5 py-1.5 border-b border-gray-100 bg-white shrink-0">
                <button
                  onClick={() => setEsconderTabs(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-grape-700 transition"
                >
                  {esconderTabs
                    ? <><Eye className="w-3.5 h-3.5" /> Mostrar tabs</>
                    : <><EyeOff className="w-3.5 h-3.5" /> Esconder tabs</>}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-3">
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-5">
                  {cifraFiltrada.join("\n")}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between gap-2">
              <button
                onClick={() => setResultado(null)}
                className="text-sm text-gray-400 hover:text-gray-600 transition whitespace-nowrap"
              >
                ← Voltar
              </button>
              <div className="flex gap-2 shrink-0">
                <button onClick={onClose} className="text-sm text-gray-500 px-3 sm:px-4 py-2 rounded-xl hover:bg-gray-100 transition whitespace-nowrap">
                  Cancelar
                </button>
                <button
                  onClick={salvar}
                  disabled={salvo}
                  className={clsx(
                    "flex items-center gap-2 text-sm font-semibold px-4 sm:px-5 py-2 rounded-xl transition whitespace-nowrap",
                    salvo ? "bg-green-600 text-white" : "bg-grape-700 text-white hover:bg-grape-800 disabled:opacity-60"
                  )}
                >
                  {salvo ? <Check className="w-4 h-4 shrink-0" /> : null}
                  <span>{salvo ? "Adicionado!" : "Adicionar à escala"}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
