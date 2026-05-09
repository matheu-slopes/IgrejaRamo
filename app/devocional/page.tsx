"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BookOpen, Calendar, ChevronLeft, ChevronRight, PlayCircle, Quote } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DevocionalBloco =
  | { id: string; tipo: "texto"; texto: string }
  | { id: string; tipo: "imagem"; url: string; legenda?: string }
  | { id: string; tipo: "video"; url: string; legenda?: string }
  | { id: string; tipo: "citacao"; texto: string; referencia?: string }
  | { id: string; tipo: "separador" };

interface DevocionalConteudoRico {
  versao: 1;
  blocos: DevocionalBloco[];
}

interface Devocional {
  id: string;
  titulo: string;
  subtitulo: string | null;
  conteudo: string;
  versiculo: string | null;
  referencia: string | null;
  imagem_url: string | null;
  data: string;
  ativo: boolean;
}

function parseConteudo(conteudo: string): DevocionalBloco[] {
  try {
    const parsed = JSON.parse(conteudo) as Partial<DevocionalConteudoRico>;
    if (parsed?.versao === 1 && Array.isArray(parsed.blocos)) {
      return parsed.blocos.filter((bloco): bloco is DevocionalBloco => Boolean(bloco && "tipo" in bloco));
    }
  } catch {
    // Conteúdos antigos continuam sendo texto puro.
  }

  return conteudo.trim()
    ? [{ id: "legacy-text", tipo: "texto", texto: conteudo }]
    : [];
}

function youtubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (host.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function isDirectVideoUrl(url: string) {
  try {
    return /\.(mp4|webm|mov|avi)(\?|$)/i.test(new URL(url).pathname);
  } catch {
    return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
  }
}

function ConteudoRico({ blocos }: { blocos: DevocionalBloco[] }) {
  return (
    <div className="space-y-5">
      {blocos.map((bloco) => {
        if (bloco.tipo === "texto") {
          return (
            <div key={bloco.id} className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
              {bloco.texto}
            </div>
          );
        }

        if (bloco.tipo === "imagem") {
          return (
            <figure key={bloco.id} className="space-y-2">
              <div className="relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 aspect-[16/9]">
                <Image src={bloco.url} alt={bloco.legenda || "Imagem do devocional"} fill className="object-cover" unoptimized />
              </div>
              {bloco.legenda && <figcaption className="text-xs text-gray-400 text-center">{bloco.legenda}</figcaption>}
            </figure>
          );
        }

        if (bloco.tipo === "video") {
          const embedUrl = youtubeEmbedUrl(bloco.url);
          return (
            <figure key={bloco.id} className="space-y-2">
              <div className="relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-950 aspect-video">
                {isDirectVideoUrl(bloco.url) ? (
                  <video src={bloco.url} controls className="h-full w-full object-cover" />
                ) : embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title={bloco.legenda || "Vídeo do devocional"}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <a href={bloco.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80 hover:text-white transition">
                    <PlayCircle className="w-12 h-12" />
                    <span className="text-sm font-semibold">Abrir vídeo</span>
                  </a>
                )}
              </div>
              {bloco.legenda && <figcaption className="text-xs text-gray-400 text-center">{bloco.legenda}</figcaption>}
            </figure>
          );
        }

        if (bloco.tipo === "citacao") {
          return (
            <blockquote key={bloco.id} className="rounded-2xl bg-vine-50 border border-vine-100 px-5 py-4">
              <Quote className="w-5 h-5 text-vine-400 mb-2" />
              <p className="text-vine-900 italic leading-relaxed">{bloco.texto}</p>
              {bloco.referencia && <cite className="text-vine-600 text-sm not-italic font-semibold mt-2 block">{bloco.referencia}</cite>}
            </blockquote>
          );
        }

        return <hr key={bloco.id} className="border-gray-100" />;
      })}
    </div>
  );
}

export default function DevocionalPage() {
  const [devs, setDevs] = useState<Devocional[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("devocionais")
      .select()
      .eq("ativo", true)
      .order("data", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setDevs(data as Devocional[]);
        setLoading(false);
      });
  }, []);

  const dev = devs[idx] ?? null;
  const blocos = dev ? parseConteudo(dev.conteudo) : [];

  function formatarData(data: string) {
    return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-vine-950 text-white px-4 py-4 flex items-center gap-3">
        <Link href="/" className="p-2 hover:bg-white/10 rounded-xl transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gold-400" />
          <span className="font-semibold text-base">Devocional Diário</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-vine-300 border-t-vine-700 rounded-full animate-spin" />
          </div>
        )}

        {!loading && devs.length === 0 && (
          <div className="text-center py-24 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum devocional disponível no momento.</p>
            <p className="text-sm mt-1">Volte em breve.</p>
          </div>
        )}

        {!loading && dev && (
          <>
            {/* Navegação entre devocionais */}
            {devs.length > 1 && (
              <div className="flex items-center justify-between mb-6 text-sm text-gray-500">
                <button
                  onClick={() => setIdx((i) => Math.min(i + 1, devs.length - 1))}
                  disabled={idx >= devs.length - 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-vine-50 disabled:opacity-30 transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
                <span className="text-xs text-gray-400">{idx + 1} / {devs.length}</span>
                <button
                  onClick={() => setIdx((i) => Math.max(i - 1, 0))}
                  disabled={idx <= 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-vine-50 disabled:opacity-30 transition"
                >
                  Próximo <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Card principal */}
            <article className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Imagem */}
              {dev.imagem_url && (
                <div className="relative h-52 w-full">
                  <Image
                    src={dev.imagem_url}
                    alt={dev.titulo}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
              )}

              {/* Sem imagem: header colorido */}
              {!dev.imagem_url && (
                <div className="h-32 bg-gradient-to-br from-vine-800 to-vine-950 flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-white/30" />
                </div>
              )}

              <div className="p-7 space-y-5">
                {/* Data */}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="capitalize">{formatarData(dev.data)}</span>
                </div>

                {/* Título */}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight">{dev.titulo}</h1>
                  {dev.subtitulo && (
                    <p className="text-gray-500 text-sm mt-1">{dev.subtitulo}</p>
                  )}
                </div>

                {/* Versículo destaque */}
                {dev.versiculo && (
                  <blockquote className="border-l-4 border-vine-400 pl-4 py-1">
                    <p className="text-vine-800 italic text-base leading-relaxed">&ldquo;{dev.versiculo}&rdquo;</p>
                    {dev.referencia && (
                      <cite className="text-vine-500 text-sm not-italic font-semibold mt-1 block">— {dev.referencia}</cite>
                    )}
                  </blockquote>
                )}

                {/* Conteúdo */}
                <ConteudoRico blocos={blocos} />
              </div>
            </article>

            {/* Rodapé */}
            <div className="text-center mt-8 text-xs text-gray-400">
              Igreja Ramo da Vida · Devocional Diário
            </div>
          </>
        )}
      </div>
    </main>
  );
}
