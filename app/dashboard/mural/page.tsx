"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Ministerio, MuralMensagem, TipoMensagem } from "@/types";
import {
  Pin, Send, Music, Video, BookOpen, Baby, HeartHandshake,
  Mic, MicOff, Image as ImageIcon, X, Square,
} from "lucide-react";
import clsx from "clsx";

const MINISTERIOS: { label: string; value: Ministerio; icon: React.ElementType }[] = [
  { label: "Louvor",      value: "Louvor",      icon: Music           },
  { label: "Mídias",      value: "Mídias",      icon: Video           },
  { label: "Ensino",      value: "Ensino",       icon: BookOpen        },
  { label: "Infantil",    value: "Infantil",     icon: Baby            },
  { label: "Ação Social", value: "Ação Social",  icon: HeartHandshake  },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    pastor: "bg-gold-100 text-gold-700", admin: "bg-blue-100 text-blue-700",
    lider: "bg-vine-100 text-vine-700", voluntario: "bg-green-100 text-green-700",
    membro: "bg-gray-100 text-gray-600",
  };
  return map[role] ?? "bg-gray-100 text-gray-600";
}

export default function ConversasPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const paramMin = searchParams.get("min") as Ministerio | null;

  const [activeMin, setActiveMin] = useState<Ministerio>(paramMin ?? "Louvor");
  const [mensagens, setMensagens] = useState<MuralMensagem[]>([]);
  const [texto, setTexto] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Audio recording
  const [gravando, setGravando] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Image preview
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);

  useEffect(() => {
    if (paramMin && paramMin !== activeMin) setActiveMin(paramMin);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramMin]);

  useEffect(() => {
    supabase
      .from("mural_mensagens")
      .select()
      .eq("ministerio", activeMin)
      .order("criado_em", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setMensagens(
            data.map((m) => ({
              id: m.id, ministerio: m.ministerio, autorId: m.autor_id,
              autorNome: m.autor_nome, autorRole: m.autor_role,
              conteudo: m.conteudo, criadoEm: m.criado_em,
              fixada: m.fixada, tipo: m.tipo, mediaUrl: m.media_url,
              reacoes: m.reacoes ?? [], editadoEm: m.editado_em,
              respostaA: m.resposta_a,
            }))
          );
        }
      });
  }, [activeMin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, activeMin]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const filtradas = [...mensagens].sort((a, b) => {
      if (a.fixada && !b.fixada) return -1;
      if (!a.fixada && b.fixada) return 1;
      return a.criadoEm.localeCompare(b.criadoEm);
    });

  function enviar(tipo: TipoMensagem = "texto", mediaUrl?: string) {
    if (!user) return;
    if (tipo === "texto" && !texto.trim() && !mediaUrl) return;

    const conteudo = tipo === "texto" ? texto.trim() : tipo === "imagem" ? "📷 Imagem" : "🎙️ Áudio";

    supabase
      .from("mural_mensagens")
      .insert({
        ministerio: activeMin,
        autor_id: user.id,
        autor_nome: user.nome,
        autor_role: user.role,
        conteudo,
        tipo,
        media_url: mediaUrl ?? null,
        fixada: false,
      })
      .select()
      .single()
      .then(({ data }) => {
        if (data) {
          setMensagens((prev) => [...prev, {
            id: data.id, ministerio: data.ministerio, autorId: data.autor_id,
            autorNome: data.autor_nome, autorRole: data.autor_role,
            conteudo: data.conteudo, criadoEm: data.criado_em,
            fixada: data.fixada, tipo: data.tipo, mediaUrl: data.media_url,
            reacoes: data.reacoes ?? [],
          }]);
        }
      });
    setTexto("");
    setImagemPreview(null);
    setAudioUrl(null);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagemPreview(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function enviarImagem() {
    if (!imagemPreview) return;
    enviar("imagem", imagemPreview);
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url  = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setGravando(true);
      setTempoGravacao(0);
      timerRef.current = setInterval(() => setTempoGravacao((t) => t + 1), 1000);
    } catch {
      alert("Permissão de microfone negada.");
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setGravando(false);
  }

  function enviarAudio() {
    if (!audioUrl) return;
    enviar("audio", audioUrl);
  }

  function cancelarAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setGravando(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  const temMidia = !!imagemPreview || !!audioUrl;

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-sans font-semibold text-vine-950">Conversas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Comunicação interna por ministério — texto, imagens e áudios.
        </p>
      </div>

      {/* Ministry tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {MINISTERIOS.map(({ label, value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveMin(value)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition",
              activeMin === value
                ? "bg-vine-700 text-white shadow"
                : "bg-white text-gray-500 border border-gray-200 hover:border-vine-300 hover:text-vine-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {filtradas.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <p className="text-sm">Nenhuma mensagem neste canal ainda.</p>
          </div>
        )}

        {filtradas.map((msg) => {
          const isMe = msg.autorId === user?.id;
          return (
            <div
              key={msg.id}
              className={clsx(
                "flex gap-3",
                isMe ? "flex-row-reverse" : "flex-row",
                msg.fixada && "bg-amber-50 rounded-2xl px-3 py-2 border border-amber-100"
              )}
            >
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0",
                isMe ? "bg-vine-700" : "bg-gray-400"
              )}>
                {msg.autorNome.charAt(0)}
              </div>

              <div className={clsx("max-w-[75%]", isMe && "items-end flex flex-col")}>
                <div className={clsx("flex items-center gap-1.5 mb-1", isMe ? "flex-row-reverse" : "flex-row")}>
                  <span className="text-xs font-semibold text-gray-700">
                    {isMe ? "Você" : msg.autorNome.split(" ")[0]}
                  </span>
                  <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", roleBadge(msg.autorRole))}>
                    {msg.autorRole}
                  </span>
                  {msg.fixada && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">
                      <Pin className="w-3 h-3" /> fixada
                    </span>
                  )}
                </div>

                {/* Bubble */}
                <div className={clsx(
                  "rounded-2xl overflow-hidden text-sm",
                  (!msg.tipo || msg.tipo === "texto")
                    ? clsx("px-4 py-2.5 leading-relaxed", isMe ? "bg-vine-700 text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm")
                    : "border border-gray-200 bg-white"
                )}>
                  {(!msg.tipo || msg.tipo === "texto") && msg.conteudo}
                  {msg.tipo === "imagem" && msg.mediaUrl && (
                    <img
                      src={msg.mediaUrl}
                      alt="imagem"
                      className="max-w-[260px] max-h-[300px] object-cover rounded-2xl"
                    />
                  )}
                  {msg.tipo === "audio" && msg.mediaUrl && (
                    <div className="px-3 py-2">
                      <audio controls src={msg.mediaUrl} className="h-9 w-56" />
                    </div>
                  )}
                </div>

                <div className={clsx("flex items-center gap-2 mt-1", isMe ? "flex-row-reverse" : "flex-row")}>
                  <span className="text-[10px] text-gray-400">{formatTime(msg.criadoEm)}</span>
                  {msg.reacoes && (
                    <div className="flex gap-1">
                      {msg.reacoes.map((r) => (
                        <span
                          key={r.emoji}
                          className="text-xs bg-gray-100 rounded-full px-1.5 py-0.5 cursor-pointer hover:bg-vine-100 transition"
                        >
                          {r.emoji} {r.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Preview area (image or audio) */}
      {imagemPreview && !audioUrl && (
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <img src={imagemPreview} alt="preview" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
          <div className="flex-1 text-sm text-gray-600">Imagem pronta para enviar</div>
          <button onClick={() => setImagemPreview(null)} className="text-gray-400 hover:text-red-400 transition"><X className="w-4 h-4" /></button>
          <button
            onClick={enviarImagem}
            className="bg-vine-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-vine-600 transition flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Enviar
          </button>
        </div>
      )}

      {audioUrl && (
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <audio controls src={audioUrl} className="h-9 flex-1" />
          <button onClick={cancelarAudio} className="text-gray-400 hover:text-red-400 transition"><X className="w-4 h-4" /></button>
          <button
            onClick={enviarAudio}
            className="bg-vine-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-vine-600 transition flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Enviar
          </button>
        </div>
      )}

      {gravando && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-red-700 font-medium flex-1">
            Gravando... {Math.floor(tempoGravacao / 60).toString().padStart(2, "0")}:{(tempoGravacao % 60).toString().padStart(2, "0")}
          </span>
          <button
            onClick={pararGravacao}
            className="flex items-center gap-1.5 bg-red-500 text-white text-sm font-semibold px-3 py-1.5 rounded-xl hover:bg-red-600 transition"
          >
            <Square className="w-3.5 h-3.5 fill-white" /> Parar
          </button>
        </div>
      )}

      {/* Compose */}
      {!temMidia && !gravando && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), enviar())}
            placeholder={`Mensagem para ${activeMin}…`}
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vine-300 shadow-sm"
          />

          {/* Imagem */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <button
            onClick={() => fileRef.current?.click()}
            className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-vine-700 hover:border-vine-300 transition"
            title="Enviar imagem"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Gravar áudio */}
          <button
            onClick={iniciarGravacao}
            className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-vine-700 hover:border-vine-300 transition"
            title="Gravar áudio"
          >
            <Mic className="w-5 h-5" />
          </button>

          <button
            onClick={() => enviar()}
            disabled={!texto.trim()}
            className="bg-vine-700 hover:bg-vine-800 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 font-semibold text-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
