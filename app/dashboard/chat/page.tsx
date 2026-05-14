"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatUnread } from "@/contexts/ChatUnreadContext";
import { supabase } from "@/lib/supabase";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { ConversaDireta, Grupo, MensagemConversa } from "@/types";
import {
  MessageSquare, Users, Send, ArrowLeft, Search, Lock, Plus,
  Info, Smile, Paperclip, Mic, Star, X, FileText, Square, MicOff,
  Image as ImageIcon, MoreVertical, Trash2, LogOut, Check, Archive, Pencil, Reply,
  Download, Play,
} from "lucide-react";
import clsx from "clsx";

// --- Helper: retorna sempre um access_token fresco ----------------
// getSession() usa cache local sem validar expira��o. Se o token
// estiver a menos de 60 s do vencimento (ou j� vencido), for�a refresh.
async function getFreshToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "";
  const expiresAt = session.expires_at ?? 0; // segundos desde epoch
  if (Date.now() / 1000 > expiresAt - 60) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? "";
  }
  return session.access_token;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(input, init);
      if (res.status >= 500 && i < attempts) {
        await delay(i * 200);
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      if (i < attempts) {
        await delay(i * 200);
        continue;
      }
    }
  }
  throw lastError ?? new Error("Falha de rede");
}

// --- AudioPlayer -------------------------------------------------
// O MediaRecorder n�o escreve dura��o nos metadados do WebM.
// O hack: seek para 1e101 for�a o browser a varrer o arquivo e calcular a dura��o real.
function AudioPlayer({ src, isMe }: { src: string; isMe: boolean }) {
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
    el.addEventListener("loadedmetadata", tryFix);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    el.addEventListener("play",  () => setPlaying(true));
    el.addEventListener("pause", () => setPlaying(false));
    if (el.readyState >= 1) tryFix();
    return () => {
      el.removeEventListener("loadedmetadata", tryFix);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.removeEventListener("play",  () => setPlaying(true));
      el.removeEventListener("pause", () => setPlaying(false));
    };
  }, [src]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    playing ? el.pause() : el.play();
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
      "flex items-center gap-2 px-3 py-2.5 rounded-2xl w-[240px]",
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
          <span className={clsx("text-xs flex-1", isMe ? "text-white/60" : "text-gray-400")}>
            �udio indispon�vel
          </span>
        </>
      ) : (
        <>
          <button
            onClick={toggle}
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
            type="range" min={0} max={duration || 100} step={0.1} value={current}
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

// --- Constants ----------------------------------------------------

const EMOJIS = [
  "😀","😂","😍","🥰","😊","😎","🤗","😭",
  "😅","🤣","😇","😏","🙄","😤","🥺","🤩",
  "👍","👎","🙏","👏","❤️","🔥","✨","🎉",
  "😢","😡","🤔","😴","🤯","😬","🫡","🙌",
];

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// --- Helpers ------------------------------------------------------

function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return formatTime(iso);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatDateHeader(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function compareMensagemOrder(a: MensagemConversa, b: MensagemConversa) {
  const seqA = a.sequenceId ?? 0;
  const seqB = b.sequenceId ?? 0;

  if (seqA !== seqB) return seqA - seqB;

  const timeA = new Date(a.criadoEm).getTime();
  const timeB = new Date(b.criadoEm).getTime();

  if (timeA !== timeB) return timeA - timeB;

  return a.id.localeCompare(b.id);
}

function isMissingSequenceColumn(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const msg = String(err?.message ?? "").toLowerCase();
  return err?.code === "42703" && msg.includes("sequence_id");
}

type ChatTab = "direto" | "grupos";
type ActiveChat = { tipo: "direto"; id: string } | { tipo: "grupo"; id: string } | null;

// --- Toast --------------------------------------------------------

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-xl pointer-events-none">
      {msg}
    </div>
  );
}

// --- EmojiPicker -------------------------------------------------

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-2xl shadow-lg p-3 z-30 w-64">
      <div className="grid grid-cols-8 gap-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => { onSelect(e); onClose(); }}
            className="text-xl hover:bg-gray-100 rounded-lg p-1 transition leading-none"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- AttachMenu ---------------------------------------------------

function AttachMenu({ onAction, onClose }: { onAction: (label: string) => void; onClose: () => void }) {
  const options = [
    { icon: ImageIcon, label: "Foto/Video",   color: "text-purple-500" },
    { icon: FileText,  label: "Documento",    color: "text-blue-500"   },
    { icon: Smile,     label: "Figurinha",    color: "text-yellow-500" },
  ];
  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-2xl shadow-lg py-2 z-30 min-w-[150px]">
      {options.map(({ icon: Icon, label, color }) => (
        <button
          key={label}
          onClick={() => { onAction(label); onClose(); }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          <Icon className={clsx("w-4 h-4", color)} />
          {label}
        </button>
      ))}
    </div>
  );
}

// --- ComposeBar ---------------------------------------------------

function ComposeBar({
  onSend, onSendImage, onSendAudio, onSendDoc, disabled, onToast,
}: {
  onSend: (t: string) => void;
  onSendImage: (file: File) => void;
  onSendAudio: (blob: Blob, name: string) => void;
  onSendDoc: (file: File) => void;
  disabled?: boolean;
  onToast: (msg: string) => void;
}) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [imgPreview, setImgPreview] = useState<{ file: File; url: string } | null>(null);
  const [docPreview, setDocPreview] = useState<File | null>(null);
  // -- Grava��o de �udio --
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioPreview, setAudioPreview] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const docInputRef     = useRef<HTMLInputElement>(null);

  function handleSend() {
    if (imgPreview) {
      onSendImage(imgPreview.file);
      URL.revokeObjectURL(imgPreview.url);
      setImgPreview(null);
      setShowAttach(false);
      return;
    }
    if (docPreview) {
      onSendDoc(docPreview);
      setDocPreview(null);
      setShowAttach(false);
      return;
    }
    if (audioPreview) {
      onSendAudio(audioPreview.blob, audioPreview.name);
      URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
      return;
    }
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
    setShowEmoji(false);
  }

  // Comprime a imagem via canvas antes de enviar
  function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1280;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;
    if (!raw.type.startsWith("image/")) { onToast("Apenas imagens s�o suportadas"); return; }
    const compressed = await compressImage(raw);
    setImgPreview({ file: compressed, url: URL.createObjectURL(compressed) });
    setShowAttach(false);
  }

  function handleDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;
    if (raw.size > 20 * 1024 * 1024) { onToast("Documento muito grande (m�x 20 MB)"); return; }
    setDocPreview(raw);
    setShowAttach(false);
  }

  // -- Grava��o --
  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        const ext = rec.mimeType.includes("ogg") ? "ogg" : "webm";
        const name = `audio_${Date.now()}.${ext}`;
        setAudioPreview({ blob, url: URL.createObjectURL(blob), name });
        setRecording(false);
        setRecSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      rec.start(250);
      mediaRecRef.current = rec;
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      onToast("Microfone n�o dispon�vel ou permiss�o negada");
    }
  }

  function stopRecording() {
    mediaRecRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function cancelRecording() {
    mediaRecRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRecRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setRecSeconds(0);
    chunksRef.current = [];
  }

  function formatSecs(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  }

  const hasContent = text.trim() || imgPreview || docPreview || audioPreview;

  if (disabled) {
    return (
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex items-center gap-2 text-gray-400 shrink-0">
        <Lock className="w-4 h-4 shrink-0" />
        <span className="text-xs">Somente pastores e lideres podem enviar mensagens aqui.</span>
      </div>
    );
  }

  // -- UI de grava��o ativo --
  if (recording) {
    return (
      <div className="border-t border-gray-100 bg-white px-3 py-3 shrink-0">
        <div className="flex items-center gap-3 bg-red-50 rounded-2xl border border-red-200 px-4 py-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm text-red-600 font-medium tabular-nums flex-1">{formatSecs(recSeconds)}</span>
          <button
            onClick={cancelRecording}
            className="text-gray-400 hover:text-gray-600 transition"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={stopRecording}
            className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition"
            title="Parar grava��o"
          >
            <Square className="w-4 h-4 fill-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-t border-gray-100 bg-white px-3 pt-3 shrink-0"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {/* Preview da imagem */}
      {imgPreview && (
        <div className="relative mb-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgPreview.url} alt="preview" className="max-h-32 rounded-xl border border-gray-200 object-cover" />
          <button
            onClick={() => { URL.revokeObjectURL(imgPreview.url); setImgPreview(null); }}
            className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 transition"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {/* Preview do documento */}
      {docPreview && (
        <div className="flex items-center gap-2 mb-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
          <FileText className="w-5 h-5 text-blue-500 shrink-0" />
          <span className="text-xs text-gray-700 truncate flex-1">{docPreview.name}</span>
          <button
            onClick={() => setDocPreview(null)}
            className="text-gray-400 hover:text-red-500 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Preview do �udio */}
      {audioPreview && (
        <div className="flex items-center gap-2 mb-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
          <Mic className="w-4 h-4 text-gray-800 shrink-0" />
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audioPreview.url} controls preload="metadata" className="h-8 flex-1 min-w-0" />
          <button
            onClick={() => { URL.revokeObjectURL(audioPreview.url); setAudioPreview(null); }}
            className="text-gray-400 hover:text-red-500 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 relative">
        {showEmoji && (
          <EmojiPicker
            onSelect={(e) => setText((prev) => prev + e)}
            onClose={() => setShowEmoji(false)}
          />
        )}
        {showAttach && (
          <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-2xl shadow-lg py-2 z-30 min-w-[150px]">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <ImageIcon className="w-4 h-4 text-purple-500" />
              Foto
            </button>
            <button
              onClick={() => docInputRef.current?.click()}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <FileText className="w-4 h-4 text-blue-500" />
              Documento
            </button>
          </div>
        )}

        {/* Input de imagem oculto */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {/* Input de documento oculto */}
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          className="hidden"
          onChange={handleDocChange}
        />

        {/* Attach */}
        <button
          onClick={() => { setShowAttach((v) => !v); setShowEmoji(false); }}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition shrink-0"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text + emoji */}
        <div className="flex-1 relative flex items-end">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={imgPreview || docPreview || audioPreview ? "Legenda (opcional)..." : "Digite uma mensagem..."}
            rows={1}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 leading-relaxed max-h-32 overflow-y-auto"
          />
          <button
            onClick={() => { setShowEmoji((v) => !v); setShowAttach(false); }}
            className="absolute right-2 bottom-2 text-gray-400 hover:text-yellow-500 transition"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>

        {/* Send / Mic */}
        {hasContent ? (
          <button
            onClick={handleSend}
            className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 hover:bg-slate-800 active:scale-95 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 hover:bg-slate-800 active:scale-95 transition"
            title="Gravar �udio"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// --- MessageBubble ------------------------------------------------

function MessageBubble({
  msg, isMe, showAuthor, onStar, isStarred, onEdit, onReply, onReact, myReacted,
}: {
  msg: MensagemConversa;
  isMe: boolean;
  showAuthor: boolean;
  onStar: (id: string) => void;
  isStarred: boolean;
  onEdit: (id: string, newText: string) => void;
  onReply: (msg: MensagemConversa) => void;
  onReact: (emoji: string) => void;
  myReacted: string[];
}) {
  const [hover, setHover] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    setEditText(msg.conteudo);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }
  function cancelEdit() { setEditing(false); }
  function saveEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== msg.conteudo) onEdit(msg.id, trimmed);
    setEditing(false);
  }

  return (
    <div
      className={clsx("flex gap-2 max-w-[92%]", isMe ? "ml-auto flex-row-reverse" : "")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!isMe && (
        <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 self-end mb-1">
          {iniciais(msg.autorNome)}
        </div>
      )}
      {/* Coluna de conte�do � relative para posicionar bot�es de a��o sem afetar o layout */}
      <div className={clsx("relative flex flex-col", isMe ? "items-end" : "items-start")}>
        {showAuthor && !isMe && (
          <span className="text-[10px] font-semibold text-gray-800 mb-0.5 px-1">
            {msg.autorNome.split(" ")[0]}
          </span>
        )}

        {/* Quoted reply block */}
        {msg.respostaA && !editing && (
          <div
            className={clsx(
              "mb-1 rounded-xl px-3 py-1.5 text-xs max-w-full border-l-2",
              isMe ? "bg-gray-800 border-white/50 text-white/90" : "bg-gray-100 border-gray-400 text-gray-600"
            )}
          >
            <p className={clsx("font-semibold text-[10px] truncate mb-0.5", isMe ? "text-white/70" : "text-gray-800")}>
              {msg.respostaA.autorNome}
            </p>
            <p className="truncate leading-snug">{msg.respostaA.conteudo}</p>
          </div>
        )}

        {/* Bubble / audio / edit mode */}
        {editing ? (
          <div className="w-64">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === "Escape") cancelEdit();
              }}
              rows={2}
              className="w-full resize-none rounded-2xl border-2 border-gray-400 bg-white px-3.5 py-2 text-sm text-gray-800 focus:outline-none leading-relaxed max-h-32 overflow-y-auto"
            />
            <div className="flex justify-end gap-2 mt-1 px-1">
              <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600 transition px-2 py-0.5">
                Cancelar
              </button>
              <button onClick={saveEdit} className="text-xs bg-slate-700 text-white rounded-full px-3 py-0.5 hover:bg-slate-800 transition">
                Salvar
              </button>
            </div>
          </div>
        ) : msg.tipo === "audio" && msg.mediaUrl ? (
          /* �udio fica fora da bolha para evitar duplo fundo */
          <AudioPlayer src={msg.mediaUrl} isMe={isMe} />
        ) : (
          <div
            className={clsx(
              "rounded-2xl text-sm leading-relaxed max-w-full break-words overflow-hidden",
              msg.tipo === "imagem" || msg.tipo === "documento" ? "" : "px-3.5 py-2",
              isMe ? "bg-slate-700 text-white rounded-br-sm" : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm"
            )}
          >
            {msg.tipo === "imagem" && msg.mediaUrl ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={msg.mediaUrl}
                  alt="imagem"
                  className="max-w-[320px] max-h-[400px] object-cover cursor-pointer rounded-2xl"
                  onClick={() => window.open(msg.mediaUrl, "_blank")}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {msg.conteudo && <p className="px-3.5 py-2 text-sm">{msg.conteudo}</p>}
              </div>
            ) : msg.tipo === "documento" && msg.mediaUrl ? (
              <a
                href={msg.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl min-w-[160px] max-w-[240px] transition",
                  isMe ? "hover:bg-slate-800" : "hover:bg-gray-50"
                )}
              >
                <FileText className={clsx("w-8 h-8 shrink-0", isMe ? "text-gray-200" : "text-blue-500")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight truncate">{msg.conteudo || "Documento"}</p>
                  <p className={clsx("text-[10px] mt-0.5", isMe ? "text-gray-300" : "text-gray-400")}>
                    Toque para abrir
                  </p>
                </div>
                <Download className={clsx("w-3.5 h-3.5 shrink-0", isMe ? "text-gray-300" : "text-gray-400")} />
              </a>
            ) : (
              msg.conteudo
            )}
          </div>
        )}

        {/* Reaction pills */}
        {!editing && msg.reacoes && msg.reacoes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {msg.reacoes.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(r.emoji)}
                className={clsx(
                  "flex items-center gap-1 text-sm bg-white border rounded-full px-2 py-0.5 transition hover:border-gray-300",
                  myReacted.includes(r.emoji) ? "border-gray-400 bg-gray-50" : "border-gray-200"
                )}
              >
                {r.emoji}
                <span className="text-[10px] text-gray-500 font-medium">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 mt-0.5 px-1">
          {isStarred && <Star className="w-2.5 h-2.5 text-gold-500 fill-gold-500" />}
          {msg.editadoEm && <span className="text-[10px] text-gray-400 italic">editado</span>}
          <span className="text-[10px] text-gray-400">{formatTime(msg.criadoEm)}</span>
        </div>

        {/* Bot�es de a��o � absolutamente posicionados (sem impacto no layout) */}
        {(hover || emojiOpen) && !editing && (
          <div className={clsx(
            "absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10",
            isMe ? "right-full pr-1.5" : "left-full pl-1.5"
          )}>
            {emojiOpen && <div className="fixed inset-0 z-20" onClick={() => setEmojiOpen(false)} />}
            <div className="relative">
              {emojiOpen && (
                <div className={clsx(
                  "absolute bottom-full mb-1 z-30 bg-white border border-gray-200 rounded-full shadow-lg px-1.5 py-1 flex gap-0.5",
                  isMe ? "right-0" : "left-0"
                )}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { onReact(emoji); setEmojiOpen(false); }}
                      className={clsx(
                        "text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition",
                        myReacted.includes(emoji) && "bg-gray-50 ring-1 ring-gray-300"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setEmojiOpen(!emojiOpen)}
                className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[14px] hover:border-gray-300 transition"
                title="Reagir"
              >
                ??
              </button>
            </div>
            <button
              onClick={() => onReply(msg)}
              className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-800 hover:border-gray-300 transition"
              title="Responder"
            >
              <Reply className="w-3 h-3" />
            </button>
            {isMe && (
              <button
                onClick={startEdit}
                className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-800 hover:border-gray-300 transition"
                title="Editar"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => onStar(msg.id)}
              className={clsx(
                "w-6 h-6 rounded-full bg-white border shadow-sm flex items-center justify-center transition hover:border-gray-300",
                isStarred ? "border-gold-300 text-gold-500" : "border-gray-200 text-gray-400"
              )}
              title="Favoritar"
            >
              <Star className={clsx("w-3 h-3", isStarred && "fill-gold-500")} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- ConversationMessages -----------------------------------------

function ConversationMessages({
  messages, myId, isGroup, searchQuery, onStar, starredIds, onEdit, onReply, onReact, myReacoes,
}: {
  messages: MensagemConversa[];
  myId: string;
  isGroup: boolean;
  searchQuery: string;
  onStar: (id: string) => void;
  starredIds: Set<string>;
  onEdit: (id: string, newText: string) => void;
  onReply: (msg: MensagemConversa) => void;
  onReact: (msgId: string, emoji: string) => void;
  myReacoes: Set<string>;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!searchQuery) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, searchQuery]);

  const filtered = searchQuery
    ? messages.filter((m) => m.conteudo.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const groups: { date: string; msgs: MensagemConversa[] }[] = [];
  for (const msg of filtered) {
    const day = msg.criadoEm.slice(0, 10);
    const last = groups[groups.length - 1];
    if (!last || last.date !== day) groups.push({ date: day, msgs: [msg] });
    else last.msgs.push(msg);
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-2 py-4 space-y-1 bg-gray-50 overscroll-contain">
      {searchQuery && filtered.length > 0 && (
        <p className="text-center text-xs text-gray-400 mb-3">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
      {groups.map((g) => (
        <div key={g.date}>
          <div className="flex justify-center my-3">
            <span className="text-[10px] font-semibold text-gray-400 bg-white border border-gray-200 px-3 py-0.5 rounded-full capitalize">
              {formatDateHeader(g.date + "T12:00:00")}
            </span>
          </div>
          <div className="space-y-2">
            {g.msgs.map((msg, i) => {
              const prevAuthor = i > 0 ? g.msgs[i - 1].autorId : null;
              const showAuthor = isGroup && msg.autorId !== prevAuthor;
              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isMe={msg.autorId === myId}
                  showAuthor={showAuthor}
                  onStar={onStar}
                  isStarred={starredIds.has(msg.id)}
                  onEdit={onEdit}
                  onReply={onReply}
                  onReact={(emoji) => onReact(msg.id, emoji)}
                  myReacted={msg.reacoes?.filter((r) => myReacoes.has(`${msg.id}_${r.emoji}`)).map((r) => r.emoji) ?? []}
                />
              );
            })}
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 pt-12">
          <MessageSquare className="w-10 h-10 opacity-40" />
          <p className="text-sm">{searchQuery ? "Nenhuma mensagem encontrada." : "Nenhuma mensagem ainda. Diga ola!"}</p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// --- InfoPanel ----------------------------------------------------

function InfoPanel({
  name, description, emoji, cor, messages, starredIds, onClose,
}: {
  name: string;
  description?: string;
  emoji?: string;
  cor?: string;
  messages: MensagemConversa[];
  starredIds: Set<string>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"midia" | "favoritos">("midia");
  const starred = messages.filter((m) => starredIds.has(m.id));
  const mediaImages = messages.filter((m) => m.tipo === "imagem" && m.mediaUrl);

  return (
    <div className="w-72 flex flex-col border-l border-gray-100 bg-white h-full shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <h3 className="font-semibold text-gray-800 text-sm">Informacoes</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center gap-2 py-5 px-4 border-b border-gray-100 shrink-0">
        {emoji ? (
          <div className={clsx("w-14 h-14 rounded-full flex items-center justify-center text-3xl text-white", cor ?? "bg-slate-700")}>
            {emoji}
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-slate-700 text-white flex items-center justify-center text-xl font-bold">
            {iniciais(name)}
          </div>
        )}
        <p className="font-semibold text-gray-800 text-sm text-center">{name}</p>
        {description && <p className="text-xs text-gray-400 text-center capitalize">{description}</p>}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 shrink-0">
        {(["midia", "favoritos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "flex-1 py-2.5 text-xs font-semibold border-b-2 transition",
              tab === t ? "border-slate-600 text-slate-800" : "border-transparent text-gray-400 hover:text-gray-800"
            )}
          >
            {t === "midia" ? "Midia" : "Favoritos"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "midia" && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 pt-3 pb-2">
              Fotos e videos
            </p>
            {mediaImages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-gray-300">
                <p className="text-xs text-center text-gray-400 leading-relaxed">Nenhuma foto ou vídeo compartilhado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {mediaImages.map((m) => (
                  <div
                    key={m.id}
                    className="aspect-square bg-gray-100 cursor-pointer hover:opacity-90 transition"
                    style={{ backgroundImage: `url(${m.mediaUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "favoritos" && (
          <div className="p-3 space-y-2">
            {starred.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-gray-300">
                <Star className="w-8 h-8" />
                <p className="text-xs text-center text-gray-400 leading-relaxed">
                  Nenhuma mensagem favoritada.<br />Passe o mouse sobre uma mensagem e clique na estrela.
                </p>
              </div>
            ) : (
              starred.map((m) => (
                <div key={m.id} className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-800 mb-0.5">{m.autorNome.split(" ")[0]}</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{m.conteudo}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{formatTime(m.criadoEm)}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- NewDmModal --------------------------------------------------

function NewDmModal({
  currentUserId, dms, usuarios, onStart, onClose,
}: {
  currentUserId: string;
  dms: ConversaDireta[];
  usuarios: import("@/types").User[];
  onStart: (userId: string, nome: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const others = usuarios.filter((mu) => mu.id !== currentUserId);
  const filtered = others.filter((mu) => !search || mu.nome.toLowerCase().includes(search.toLowerCase()));
  const existingIds = new Set(
    dms.flatMap((dm) => dm.participantes).filter((id) => id !== currentUserId)
  );
  return (
    <div className="fixed inset-0 bg-slate-700/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Nova Conversa</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar membro..." className="bg-transparent text-sm outline-none flex-1" />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.map((mu) => {
            const hasChat = existingIds.has(mu.id);
            return (
              <button key={mu.id} onClick={() => onStart(mu.id, mu.nome)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left border-b border-gray-50 last:border-0">
                <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold shrink-0">{iniciais(mu.nome)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{mu.nome}</p>
                  <p className="text-xs text-gray-400 capitalize truncate">{mu.role}</p>
                </div>
                {hasChat && (
                  <span className="text-[10px] text-gray-800 font-semibold bg-gray-50 px-2 py-0.5 rounded-full shrink-0">Abrir</span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Nenhum membro encontrado.</p>}
        </div>
      </div>
    </div>
  );
}

// --- NewGroupModal ------------------------------------------------

function NewGroupModal({
  currentUserId, usuarios, onClose, onCreate,
}: {
  currentUserId: string;
  usuarios: import("@/types").User[];
  onClose: () => void;
  onCreate: (nome: string, emoji: string, membros: string[]) => void;
}) {
  const [nome, setNome] = useState("");
  const [membros, setMembros] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const others = usuarios.filter((mu) => mu.id !== currentUserId);
  const filtered = others.filter((mu) => !search || mu.nome.toLowerCase().includes(search.toLowerCase()));
  function toggle(id: string) {
    setMembros((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  }
  return (
    <div className="fixed inset-0 bg-slate-700/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Criar Grupo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do grupo" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Adicionar membros</p>
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 mb-2">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar membro..." className="bg-transparent text-sm outline-none flex-1" />
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {filtered.map((mu) => (
                <button key={mu.id} onClick={() => toggle(mu.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition text-left">
                  <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold shrink-0">{iniciais(mu.nome)}</div>
                  <span className="flex-1 text-sm text-gray-700 truncate">{mu.nome}</span>
                  {membros.includes(mu.id) && <Check className="w-4 h-4 text-gray-800 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-4">
          <button onClick={() => nome.trim() && onCreate(nome.trim(), "", membros)} disabled={!nome.trim()} className="w-full bg-slate-700 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition">
            Criar Grupo{membros.length > 0 ? ` (${membros.length + 1} membros)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- GrupoAvatar -------------------------------------------------

function GrupoAvatar({ grupo, size = "md" }: { grupo: Grupo; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-9 h-9 text-base" : "w-10 h-10 text-xl";
  return (
    <div className={clsx("rounded-full flex items-center justify-center text-white shrink-0", sz, grupo.cor)}>
      {grupo.emoji}
    </div>
  );
}

// --- Page ---------------------------------------------------------

export default function ChatPage() {
  const { user, usuarios } = useAuth();
  const { setTotalUnread, setActiveChatId } = useChatUnread();
  const [tab, setTab] = useState<ChatTab>("direto");
  const [activeChat, setActiveChat] = useState<ActiveChat>(null);
  const [isMobileChatViewport, setIsMobileChatViewport] = useState(false);
  const [search, setSearch] = useState("");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [dms, setDms] = useState<ConversaDireta[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const cacheLoadedRef = useRef(false);
  const [archivedDms, setArchivedDms] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<MensagemConversa | null>(null);
  const [myReacoes, setMyReacoes] = useState<Set<string>>(new Set());

  // Carrega rea��es persistidas do localStorage ao montar
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`chat_reacoes_${user.id}`);
      if (raw) setMyReacoes(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, [user?.id]);
  const [ctxMenu, setCtxMenu] = useState<{ id: string; type: "dm" | "grupo" } | null>(null);
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [conversaIds, setConversaIds] = useState<string[]>([]);
  const startingDmRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broadcastChannelsRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatesChannelRef = useRef<any>(null);
  const activeChatRef = useRef<ActiveChat>(null);
  // Refs para leitura s�ncrona no beforeunload e closures
  const dmsRef = useRef<ConversaDireta[]>([]);
  const gruposRef = useRef<Grupo[]>([]);
  const conversaIdsRef = useRef<string[]>([]);
  const lastBackfillRef = useRef<string>(new Date(Date.now() - 5 * 60 * 1000).toISOString());
  const lastSequenceRef = useRef<number>(0);
  const syncRunningRef = useRef(false);
  // Inbox de mensagens recebidas enquanto estava em outra p�gina
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inboxRef = useRef<Record<string, any[]>>({});

  useEffect(() => {
    if (!ctxMenu) return;
    function handleClick() { setCtxMenu(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [ctxMenu]);

  // -- cache localStorage --------------------------------------------
  function cacheKey(uid: string) { return `chat_v1_${uid}`; }

  function salvarCache(uid: string, newDms: ConversaDireta[], newGrupos: Grupo[]) {
    try {
      // Mensagens com blob: URL = upload ainda em andamento.
      // Salva com mediaUrl removida e tipo="texto" temporariamente, para n�o perder
      // o texto e o hor�rio. Quando o upload terminar, o cache ser� atualizado com a URL real.
      const clean = (msgs: MensagemConversa[]) =>
        msgs
          .slice(-200)
          .map(m => m.mediaUrl?.startsWith("blob:")
            ? { ...m, mediaUrl: undefined, conteudo: m.conteudo || "? enviando m�dia�" }
            : m
          );
      const dmsSave    = newDms.map(d => ({ ...d, mensagens: clean(d.mensagens) }));
      const gruposSave = newGrupos.map(g => ({ ...g, mensagens: clean(g.mensagens) }));
      localStorage.setItem(cacheKey(uid), JSON.stringify({ dms: dmsSave, grupos: gruposSave }));
    } catch { /* private mode ou storage cheio */ }
  }

  function lerCache(uid: string): { dms: ConversaDireta[]; grupos: Grupo[] } | null {
    try {
      const raw = localStorage.getItem(cacheKey(uid));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Remove mensagens que ficaram presas como "? enviando m�dia�"
      // (upload n�o conclu�do antes de recarregar a p�gina)
      const limpar = (msgs: MensagemConversa[]) =>
        msgs.filter((m) => m.conteudo !== "? enviando m�dia�");
      return {
        dms:    parsed.dms?.map((d: ConversaDireta) => ({ ...d, mensagens: limpar(d.mensagens) })) ?? [],
        grupos: parsed.grupos?.map((g: Grupo) => ({ ...g, mensagens: limpar(g.mensagens) })) ?? [],
      };
    } catch { return null; }
  }

  // -- helpers Supabase ---------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function rowToMensagem(row: any): MensagemConversa {
    return {
      id: row.id,
      autorId: row.autor_id,
      autorNome: row.autor_nome ?? "?",
      conteudo: row.conteudo ?? "",
      tipo: row.tipo ?? "texto",
      mediaUrl: row.media_url ?? undefined,
      sequenceId: typeof row.sequence_id === "number" ? row.sequence_id : undefined,
      criadoEm: row.criado_em,
      editadoEm: row.editado_em ?? undefined,
      reacoes: Array.isArray(row.reacoes) ? row.reacoes : (row.reacoes ? JSON.parse(row.reacoes) : undefined),
      respostaA: row.resposta_a_id ? {
        id: row.resposta_a_id,
        autorNome: row.resposta_a_autor_nome ?? "",
        conteudo: row.resposta_a_conteudo ?? "",
      } : undefined,
    };
  }

  // -- carregar conversas --------------------------------------------
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    // 1) Carrega cache + inbox de forma S�NCRONA (zero lat�ncia, sem race conditions)
    if (!cacheLoadedRef.current) {
      cacheLoadedRef.current = true;

      // -- L� e limpa inbox ANTES de qualquer opera��o ass�ncrona ------
      // Motivo: se lido depois de fetch ass�ncrono, o inbox pode ser
      // sobrescrito ou sobreposto por outros setDms concorrentes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inbox: Record<string, any[]> = {};
      try {
        const raw = localStorage.getItem(`chat_inbox_${uid}`);
        if (raw) {
          localStorage.removeItem(`chat_inbox_${uid}`);
          const parsed = JSON.parse(raw);
          for (const cid of Object.keys(parsed)) {
            const entry = parsed[cid];
            inbox[cid] = Array.isArray(entry) ? entry : (entry ? [entry] : []);
          }
        }
      } catch { /* localStorage indispon�vel */ }
      inboxRef.current = inbox; // mant�m para uso em carregarMensagens tamb�m

      // -- Mescla inbox no cache antes de setar estado -----------------
      const cached = lerCache(uid);
      const baseDms: ConversaDireta[]   = cached?.dms    ?? [];
      const baseGrupos: Grupo[]         = cached?.grupos ?? [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buildInboxMsg = (im: any): MensagemConversa => ({
        id: im.id, autorId: im.autorId, autorNome: im.autorNome,
        conteudo: im.conteudo ?? "", tipo: im.tipo ?? "texto",
        mediaUrl: im.mediaUrl, criadoEm: im.criadoEm, lida: false,
      });

      const mergeInboxInto = <T extends { id: string; mensagens: MensagemConversa[] }>(list: T[]): T[] =>
        list.map(conv => {
          const arr = inbox[conv.id];
          if (!arr?.length) return conv;
          const existIds = new Set(conv.mensagens.map(m => m.id));
          const novas = arr.filter(im => !existIds.has(im.id)).map(buildInboxMsg);
          if (!novas.length) return conv;
          const merged = [...conv.mensagens, ...novas].sort(compareMensagemOrder);
          return { ...conv, mensagens: merged };
        });

      const mergedDms    = mergeInboxInto(baseDms);
      const mergedGrupos = mergeInboxInto(baseGrupos);

      setDms(mergedDms);
      setGrupos(mergedGrupos);
      const ids = [...mergedDms.map(d => d.id), ...mergedGrupos.map(g => g.id)];
      setConversaIds(ids);
      conversaIdsRef.current = ids;
    }

    // 2) Busca do servidor em background (mescla, nunca substitui)
    carregarConversas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function carregarConversas() {
    if (!user) return;
    const { data: participacoes } = await supabase
      .from("chat_participantes").select("conversa_id").eq("user_id", user.id);
    if (!participacoes?.length) return;

    const ids = (participacoes as { conversa_id: string }[]).map(p => p.conversa_id);

    const [{ data: conversas }, { data: todosParticipantes }, mensagensResult] = await Promise.all([
      supabase.from("chat_conversas").select("*").in("id", ids),
      supabase.from("chat_participantes").select("conversa_id, user_id").in("conversa_id", ids),
      supabase.from("chat_mensagens").select("*").in("conversa_id", ids).order("sequence_id", { ascending: false }).order("criado_em", { ascending: false }).limit(ids.length * 3),
    ]);

    let ultimasMsgs = mensagensResult.data;
    if (mensagensResult.error && isMissingSequenceColumn(mensagensResult.error)) {
      const fallbackMensagens = await supabase
        .from("chat_mensagens")
        .select("*")
        .in("conversa_id", ids)
        .order("criado_em", { ascending: false })
        .limit(ids.length * 3);
      ultimasMsgs = fallbackMensagens.data;
    }

    const participantesPorConversa: Record<string, string[]> = {};
    for (const p of (todosParticipantes ?? []) as { conversa_id: string; user_id: string }[]) {
      if (!participantesPorConversa[p.conversa_id]) participantesPorConversa[p.conversa_id] = [];
      participantesPorConversa[p.conversa_id].push(p.user_id);
    }

    const lastMsgPorConversa: Record<string, MensagemConversa> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (ultimasMsgs ?? []) as any[]) {
      if (!lastMsgPorConversa[row.conversa_id]) lastMsgPorConversa[row.conversa_id] = rowToMensagem(row);
    }

    const newDms: ConversaDireta[] = [];
    const newGrupos: Grupo[] = [];

    // Buscar nomes dos outros participantes direto da tabela perfis
    const outrosIds = [...new Set(
      Object.values(participantesPorConversa).flat().filter(id => id !== user.id)
    )];
    const nomePorId: Record<string, string> = {};
    if (outrosIds.length > 0) {
      const { data: perfisData } = await supabase
        .from("perfis").select("id, nome").in("id", outrosIds);
      for (const p of (perfisData ?? []) as { id: string; nome: string }[]) {
        nomePorId[p.id] = p.nome;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (conversas ?? []) as any[]) {
      const membrosIds = participantesPorConversa[c.id] ?? [];
      const lastMsg = lastMsgPorConversa[c.id];
      const mensagens = lastMsg ? [{ ...lastMsg, lida: true }] : [];

      if (c.tipo === "direto") {
        const otherId = membrosIds.find((id: string) => id !== user.id) ?? "";
        const otherNome = nomePorId[otherId] ?? usuarios.find(mu => mu.id === otherId)?.nome ?? "Usu�rio";
        newDms.push({
          id: c.id,
          participantes: [user.id, otherId] as [string, string],
          participantesNomes: [user.nome, otherNome] as [string, string],
          mensagens,
        });
      } else {
        newGrupos.push({
          id: c.id, nome: c.nome ?? "Grupo", tipo: "geral",
          emoji: c.emoji ?? "??", cor: c.cor ?? "bg-slate-700",
          descricao: c.descricao ?? undefined, adminId: c.admin_id ?? undefined,
          somenteAdmin: c.somente_admin ?? false, institucional: c.institucional ?? false,
          membros: membrosIds, mensagens,
        });
      }
    }

    // -- MERGE: nunca substituir mensagens existentes -----------------
    // Mant�m todas as mensagens j� no estado (cache + broadcasts recebidos).
    // Adiciona apenas as que vieram do banco e ainda n�o existem no estado.
    // Isso evita apagar mensagens de broadcast recebidas entre o carregamento
    // do cache e a conclus�o desta query ass�ncrona.
    setDms(prev => {
      const prevMap = new Map(prev.map(d => [d.id, d]));
      return newDms.map(newDm => {
        const existing = prevMap.get(newDm.id);
        if (!existing) return newDm;
        const existingIds = new Set(existing.mensagens.map(m => m.id));
        const apenasNovas = newDm.mensagens.filter(m => !existingIds.has(m.id));
        const merged = [...existing.mensagens, ...apenasNovas].sort(compareMensagemOrder);
        return { ...newDm, mensagens: merged };
      });
    });
    setGrupos(prev => {
      const prevMap = new Map(prev.map(g => [g.id, g]));
      return newGrupos.map(newG => {
        const existing = prevMap.get(newG.id);
        if (!existing) return newG;
        const existingIds = new Set(existing.mensagens.map(m => m.id));
        const apenasNovas = newG.mensagens.filter(m => !existingIds.has(m.id));
        const merged = [...existing.mensagens, ...apenasNovas].sort(compareMensagemOrder);
        return { ...newG, mensagens: merged };
      });
    });
    const allIds = [...newDms.map(d => d.id), ...newGrupos.map(g => g.id)];
    setConversaIds(allIds);
    conversaIdsRef.current = allIds;

    // Atualiza cursor de backfill para buscar apenas novidades daqui pra frente.
    let latest = "";
    for (const dm of newDms) {
      for (const m of dm.mensagens) {
        if (!latest || new Date(m.criadoEm).getTime() > new Date(latest).getTime()) latest = m.criadoEm;
        if ((m.sequenceId ?? 0) > lastSequenceRef.current) lastSequenceRef.current = m.sequenceId ?? 0;
      }
    }
    for (const g of newGrupos) {
      for (const m of g.mensagens) {
        if (!latest || new Date(m.criadoEm).getTime() > new Date(latest).getTime()) latest = m.criadoEm;
        if ((m.sequenceId ?? 0) > lastSequenceRef.current) lastSequenceRef.current = m.sequenceId ?? 0;
      }
    }
    if (latest) lastBackfillRef.current = latest;
    // Cache: o auto-save useEffect[dms,grupos] salva os dados MESCLADOS
  }

  async function carregarMensagens(conversaId: string) {
    let { data, error } = await supabase
      .from("chat_mensagens").select("*")
      .eq("conversa_id", conversaId)
      .order("sequence_id", { ascending: true })
      .order("criado_em", { ascending: true })
      .limit(500);

    if (error && isMissingSequenceColumn(error)) {
      const fallback = await supabase
        .from("chat_mensagens").select("*")
        .eq("conversa_id", conversaId)
        .order("criado_em", { ascending: true })
        .limit(500);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("chat load mensagens error:", error);
      return;
    }
    if (!data) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbMsgs = (data as any[]).map(row => ({ ...rowToMensagem(row), lida: true }));
    const dbIds = new Set(dbMsgs.map((m: MensagemConversa) => m.id));

    // Mensagens do inbox para esta conversa que ainda n�o est�o no banco
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inboxExtra: MensagemConversa[] = (inboxRef.current[conversaId] ?? [])
      .filter((im: { id: string }) => !dbIds.has(im.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((im: any): MensagemConversa => ({
        id: im.id, autorId: im.autorId, autorNome: im.autorNome,
        conteudo: im.conteudo ?? "", tipo: im.tipo ?? "texto",
        mediaUrl: im.mediaUrl, criadoEm: im.criadoEm, lida: false,
      }));

    // MIN(cacheTime, dbTime): cache tem o tempo do broadcast (envio real do cliente),
    // banco tem o tempo do INSERT no servidor. O menor reflete o envio real.
    const sortByTime = (arr: MensagemConversa[]) =>
      arr.slice().sort(compareMensagemOrder);

    setDms(prev => prev.map(dm => {
      if (dm.id !== conversaId) return dm;
      const pending = dm.mensagens.filter(m => !dbIds.has(m.id));
      const cacheById = new Map(dm.mensagens.map(m => [m.id, m]));
      const mergedDb = dbMsgs.map(dbMsg => {
        const cached = cacheById.get(dbMsg.id);
        // Preserva mediaUrl do cache se o banco n�o tem
        const mediaUrl = (!dbMsg.mediaUrl && cached?.mediaUrl) ? cached.mediaUrl : dbMsg.mediaUrl;
        // MIN(cacheTime, dbTime) para corrigir delay de insert no banco
        const criadoEm = cached && new Date(cached.criadoEm).getTime() < new Date(dbMsg.criadoEm).getTime()
          ? cached.criadoEm
          : dbMsg.criadoEm;
        return { ...dbMsg, mediaUrl, criadoEm };
      });
      const pendingIds = new Set(pending.map(m => m.id));
      const uniqueInbox = inboxExtra.filter(m => !pendingIds.has(m.id));
      return { ...dm, mensagens: sortByTime([...mergedDb, ...pending, ...uniqueInbox]) };
    }));
    setGrupos(prev => prev.map(g => {
      if (g.id !== conversaId) return g;
      const pending = g.mensagens.filter(m => !dbIds.has(m.id));
      const cacheById = new Map(g.mensagens.map(m => [m.id, m]));
      const mergedDb = dbMsgs.map(dbMsg => {
        const cached = cacheById.get(dbMsg.id);
        const mediaUrl = (!dbMsg.mediaUrl && cached?.mediaUrl) ? cached.mediaUrl : dbMsg.mediaUrl;
        const criadoEm = cached && new Date(cached.criadoEm).getTime() < new Date(dbMsg.criadoEm).getTime()
          ? cached.criadoEm
          : dbMsg.criadoEm;
        return { ...dbMsg, mediaUrl, criadoEm };
      });
      const pendingIds = new Set(pending.map(m => m.id));
      const uniqueInbox = inboxExtra.filter(m => !pendingIds.has(m.id));
      return { ...g, mensagens: sortByTime([...mergedDb, ...pending, ...uniqueInbox]) };
    }));
    // cache salvo automaticamente pelo useEffect [dms, grupos]
  }

  async function markConversaAsRead(conversaId: string) {
    try {
      const token = await getFreshToken();
      if (!token) return;
      await fetchWithRetry("/api/chat/ack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: "read", conversaId }),
      }, 2);
    } catch (e) {
      console.error("chat read ack error:", e);
    }
  }

  useAppRefresh(() => {
    void carregarConversas();
    const activeId = activeChatRef.current?.id;
    if (activeId) void carregarMensagens(activeId);
  }, [user?.id], { runOnMount: false, minIntervalMs: 2000 });

  async function sincronizarMensagensRecentes() {
    if (!user?.id) return;
    if (syncRunningRef.current) return;

    syncRunningRef.current = true;
    try {
      const since = lastBackfillRef.current;
      const afterSequence = lastSequenceRef.current;
      const token = await getFreshToken();
      if (!token) return;
      const query = afterSequence > 0
        ? `/api/chat/sync?after_sequence=${encodeURIComponent(String(afterSequence))}`
        : `/api/chat/sync?since=${encodeURIComponent(since)}`;
      const res = await fetchWithRetry(query, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (json.mensagens ?? []) as any[];
      if (!rows.length) return;

      const knownIds = new Set(conversaIdsRef.current);
      const unknownConversation = rows.some((r) => !knownIds.has(r.conversa_id));
      if (unknownConversation) {
        await carregarConversas();
      }

      // Agrupa por conversa para reduzir custo de atualizações de estado.
      const byCid = new Map<string, MensagemConversa[]>();
      for (const row of rows) {
        const cid = row.conversa_id as string;
        const list = byCid.get(cid) ?? [];
        list.push({
          ...rowToMensagem(row),
          lida: row.autor_id === user.id || activeChatRef.current?.id === cid,
        });
        byCid.set(cid, list);
      }

      const mergeMsgs = (current: MensagemConversa[], incoming: MensagemConversa[]) => {
        const map = new Map(current.map((m) => [m.id, m]));
        for (const msg of incoming) {
          const existing = map.get(msg.id);
          if (!existing) {
            map.set(msg.id, msg);
            continue;
          }
          const bestTime = new Date(existing.criadoEm).getTime() < new Date(msg.criadoEm).getTime()
            ? existing.criadoEm
            : msg.criadoEm;
          map.set(msg.id, { ...existing, ...msg, criadoEm: bestTime });
        }
        return Array.from(map.values()).sort(
          compareMensagemOrder
        );
      };

      setDms((prev) => prev.map((dm) => {
        const incoming = byCid.get(dm.id);
        if (!incoming?.length) return dm;
        return { ...dm, mensagens: mergeMsgs(dm.mensagens, incoming) };
      }));

      setGrupos((prev) => prev.map((g) => {
        const incoming = byCid.get(g.id);
        if (!incoming?.length) return g;
        return { ...g, mensagens: mergeMsgs(g.mensagens, incoming) };
      }));

      const newestSequence = Number(json.max_sequence_id ?? rows[rows.length - 1]?.sequence_id ?? 0);
      if (Number.isFinite(newestSequence) && newestSequence > lastSequenceRef.current) {
        lastSequenceRef.current = newestSequence;
      }
      const newest = (json.max_criado_em as string | undefined) ?? (rows[rows.length - 1]?.criado_em as string | undefined);
      if (newest) lastBackfillRef.current = newest;
    } finally {
      syncRunningRef.current = false;
    }
  }

  // Backfill contínuo: garante consistência mesmo quando Realtime perde eventos.
  useEffect(() => {
    if (!user?.id) return;

    const onFocus = () => {
      carregarConversas();
      sincronizarMensagensRecentes();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        carregarConversas();
        sincronizarMensagensRecentes();
      }
    };

    sincronizarMensagensRecentes();
    const interval = window.setInterval(() => {
      sincronizarMensagensRecentes();
    }, 1000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // -- broadcast: subscribe a cada conversa (WebSocket puro, sem banco) --
  useEffect(() => {
    if (!user?.id || conversaIds.length === 0) return;
    const map = broadcastChannelsRef.current;
    const toAdd = conversaIds.filter(id => !map.has(id));
    for (const cid of toAdd) {
      const ch = supabase.channel(`room:${cid}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("broadcast", { event: "msg" }, ({ payload }: { payload: any }) => {
          const raw = payload as MensagemConversa;
          const isActive = activeChatRef.current?.id === cid;
          const isMine = raw.autorId === user?.id;
          const msg: MensagemConversa = { ...raw, lida: isMine || isActive };
          const insertSorted = (msgs: MensagemConversa[]) => {
            if (msgs.some(m => m.id === msg.id)) return msgs;
            return [...msgs, msg].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
          };
          setDms(prev => prev.map(dm => dm.id === cid ? { ...dm, mensagens: insertSorted(dm.mensagens) } : dm));
          setGrupos(prev => prev.map(g => g.id === cid ? { ...g, mensagens: insertSorted(g.mensagens) } : g));
          // Atualiza o cursor do servidor se o usuário está visualizando a conversa agora
          if (isActive && !isMine) markConversaAsRead(cid);
        })
        .subscribe();
      map.set(cid, ch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaIds.join(","), user?.id]);

  // Limpa canais de broadcast ao desmontar
  useEffect(() => {
    return () => {
      broadcastChannelsRef.current.forEach(ch => supabase.removeChannel(ch));
      broadcastChannelsRef.current.clear();
      if (updatesChannelRef.current) supabase.removeChannel(updatesChannelRef.current);
    };
  }, []);

  // -- postgres_changes: s� para UPDATE (edi��es) e novas participa��es --
  useEffect(() => {
    if (!user?.id) return;
    if (updatesChannelRef.current) supabase.removeChannel(updatesChannelRef.current);
    const ch = supabase.channel(`chat_updates_${user.id}`)
      // -- UPDATE: edi��es de mensagens --------------------------------
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "UPDATE", schema: "public", table: "chat_mensagens",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const msg = rowToMensagem(payload.new);
        const cid = payload.new.conversa_id as string;
        setDms(prev => prev.map(dm => dm.id === cid ? {
          ...dm, mensagens: dm.mensagens.map(m => m.id === msg.id ? msg : m),
        } : dm));
        setGrupos(prev => prev.map(g => g.id === cid ? {
          ...g, mensagens: g.mensagens.map(m => m.id === msg.id ? msg : m),
        } : g));
      })
      // -- INSERT chat_participantes: detecta novas conversas em tempo real --
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public", table: "chat_participantes",
        filter: `user_id=eq.${user.id}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, async (payload: any) => {
        const cid = payload.new.conversa_id as string;
        if (conversaIdsRef.current.includes(cid)) return;
        const [{ data: conv }, { data: parts }] = await Promise.all([
          supabase.from("chat_conversas").select("*").eq("id", cid).single(),
          supabase.from("chat_participantes").select("conversa_id, user_id").eq("conversa_id", cid),
        ]);
        if (!conv) return;
        const membrosIds = ((parts ?? []) as { user_id: string }[]).map(p => p.user_id);
        const outrosIds = membrosIds.filter(id => id !== user.id);
        const nomePorId: Record<string, string> = {};
        if (outrosIds.length) {
          const { data: perfisData } = await supabase.from("perfis").select("id, nome").in("id", outrosIds);
          for (const p of (perfisData ?? []) as { id: string; nome: string }[]) nomePorId[p.id] = p.nome;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = conv as any;
        if (c.tipo === "direto") {
          const otherId = membrosIds.find(id => id !== user.id) ?? "";
          const otherNome = nomePorId[otherId] ?? "Usuário";
          setDms(prev => prev.some(d => d.id === cid) ? prev : [...prev, {
            id: cid,
            participantes: [user.id, otherId] as [string, string],
            participantesNomes: [user.nome, otherNome] as [string, string],
            mensagens: [],
          }]);
        } else {
          setGrupos(prev => prev.some(g => g.id === cid) ? prev : [...prev, {
            id: cid, nome: c.nome ?? "Grupo", tipo: "geral",
            emoji: c.emoji ?? "", cor: c.cor ?? "bg-slate-700",
            descricao: c.descricao ?? undefined, adminId: c.admin_id ?? undefined,
            somenteAdmin: c.somente_admin ?? false, institucional: c.institucional ?? false,
            membros: membrosIds, mensagens: [],
          }]);
        }
        setConversaIds(prev => prev.includes(cid) ? prev : [...prev, cid]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // -- carrega hist�rico ao abrir conversa ----------------------------
  useEffect(() => {
    if (!activeChat) return;
    carregarMensagens(activeChat.id);
    markConversaAsRead(activeChat.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  // -- atualiza totalUnread no contexto -----------------------------
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const total =
      dms.reduce((s, dm) => s + dm.mensagens.filter(m => m.autorId !== uid && !m.lida).length, 0) +
      grupos.reduce((s, g) => s + g.mensagens.filter(m => m.autorId !== uid && !m.lida).length, 0);
    setTotalUnread(total);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dms, grupos]);

  // -- auto-salva cache sempre que dms/grupos mudam -----------------
  // Cobre mensagens chegadas por broadcast que antes eram perdidas no reload
  useEffect(() => {
    if (!user?.id) return;
    // Mant�m refs atualizadas para uso s�ncrono (beforeunload, closures)
    dmsRef.current = dms;
    gruposRef.current = grupos;
    salvarCache(user.id, dms, grupos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dms, grupos]);

  // -- mant�m conversaIdsRef sempre atualizado -----------------------
  useEffect(() => { conversaIdsRef.current = conversaIds; }, [conversaIds]);

  // -- salva cache de forma s�ncrona ao fechar a aba -----------------
  // O useEffect[dms,grupos] pode n�o ter rodado antes do unload.
  // O beforeunload garante que o cache tenha os dados mais recentes.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const handler = () => salvarCache(uid, dmsRef.current, gruposRef.current);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // -- sincroniza activeChatId no contexto global -------------------
  useEffect(() => {
    setActiveChatId(activeChat?.id ?? null);
    return () => { setActiveChatId(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function updateVvh() {
      const isMobile = window.innerWidth < 768;
      setIsMobileChatViewport(isMobile);
      const viewport = window.visualViewport;
      const vvh = Math.round(viewport?.height ?? window.innerHeight);
      const offsetTop = Math.round(viewport?.offsetTop ?? 0);
      root.style.setProperty("--chat-vvh", `${vvh}px`);
      root.style.setProperty("--vv-offset-top", `${offsetTop}px`);
      if (activeChat && isMobile) body.classList.add("chat-conversation-open");
      else body.classList.remove("chat-conversation-open");
    }

    function scheduleUpdate() {
      updateVvh();
      if (timer) clearTimeout(timer);
      timer = setTimeout(updateVvh, 250);
    }

    updateVvh();
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    window.addEventListener("focusout", scheduleUpdate);
    document.addEventListener("visibilitychange", scheduleUpdate);

    return () => {
      if (timer) clearTimeout(timer);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.removeEventListener("focusout", scheduleUpdate);
      document.removeEventListener("visibilitychange", scheduleUpdate);
      body.classList.remove("chat-conversation-open");
    };
  }, [activeChat?.id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  if (!user) return null;
  const u = user;

  function toggleStar(id: string) {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteDm(id: string) {
    // deleta conversa � ON DELETE CASCADE remove participantes e mensagens
    await supabase.from("chat_conversas").delete().eq("id", id);
    setDms((prev) => prev.filter((dm) => dm.id !== id));
    if (activeChat?.tipo === "direto" && activeChat.id === id) openChat(null);
    setCtxMenu(null);
  }

  async function leaveGrupo(id: string) {
    await supabase.from("chat_participantes").delete().eq("conversa_id", id).eq("user_id", u.id);
    setGrupos((prev) => prev.filter((g) => g.id !== id));
    if (activeChat?.tipo === "grupo" && activeChat.id === id) openChat(null);
    setCtxMenu(null);
  }

  async function deleteGrupo(id: string) {
    await supabase.from("chat_conversas").delete().eq("id", id);
    setGrupos((prev) => prev.filter((g) => g.id !== id));
    if (activeChat?.tipo === "grupo" && activeChat.id === id) openChat(null);
    setCtxMenu(null);
  }

  async function startDm(userId: string, userNome: string) {
    if (startingDmRef.current) return;
    startingDmRef.current = true;
    try {
    const existing = dms.find((dm) => dm.participantes.includes(u.id) && dm.participantes.includes(userId));
    if (existing) {
      openChat({ tipo: "direto", id: existing.id });
      setShowNewDmModal(false);
      return;
    }
    const res = await fetch("/api/chat/criar-conversa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "direto", participantes: [u.id, userId] }),
    });
    const json = await res.json();
    if (!res.ok || !json.id) {
      showToast("Erro ao criar conversa: " + (json.error ?? res.statusText));
      return;
    }
    const cid: string = json.id;
    // Se a conversa já existe no estado local (API retornou existente), só abre
    const alreadyLocal = dms.find(dm => dm.id === cid);
    if (alreadyLocal) {
      openChat({ tipo: "direto", id: cid });
      setShowNewDmModal(false);
      return;
    }
    setDms((prev) => [...prev, {
      id: cid,
      participantes: [u.id, userId] as [string, string],
      participantesNomes: [u.nome, userNome] as [string, string],
      mensagens: [],
    }]);
    setConversaIds(prev => prev.includes(cid) ? prev : [...prev, cid]);
    openChat({ tipo: "direto", id: cid });
    setShowNewDmModal(false);
    } finally {
      startingDmRef.current = false;
    }
  }

  async function createGroup(nome: string, emoji: string, membros: string[]) {
    const allMembros = membros.includes(u.id) ? membros : [...membros, u.id];
    const res = await fetch("/api/chat/criar-conversa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "grupo", nome, emoji, cor: "bg-slate-700",
        descricao: `Grupo criado por ${u.nome}`, admin_id: u.id, somente_admin: false,
        participantes: allMembros,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.id) {
      showToast("Erro ao criar grupo: " + (json.error ?? res.statusText));
      return;
    }
    const cid: string = json.id;
    setGrupos((prev) => [...prev, {
      id: cid, nome, tipo: "geral", emoji, cor: "bg-slate-700",
      descricao: `Grupo criado por ${u.nome}`, adminId: u.id,
      somenteAdmin: false, institucional: false, membros: allMembros, mensagens: [],
    }]);
    setConversaIds(prev => prev.includes(cid) ? prev : [...prev, cid]);
    openChat({ tipo: "grupo", id: cid });
    setShowNewGroupModal(false);
  }

  function otherParticipant(dm: ConversaDireta) {
    const otherId = dm.participantes.find((p) => p !== u.id) ?? dm.participantes[1];
    const idx = dm.participantes.indexOf(otherId as "0" | "1");
    return { id: otherId, nome: dm.participantesNomes[idx] };
  }

  function canWrite(grupo: Grupo) {
    if (!grupo.somenteAdmin) return true;
    return u.role === "admin" || u.role === "pastor" || u.role === "lider";
  }

  async function sendDm(dmId: string, text: string) {
    const msgId = crypto.randomUUID();
    const replySnapshot = replyTo;
    const clientTime = new Date().toISOString();
    const msg: MensagemConversa = {
      id: msgId, autorId: u.id, autorNome: u.nome,
      conteudo: text, criadoEm: clientTime, lida: true,
      respostaA: replySnapshot ? { id: replySnapshot.id, autorNome: replySnapshot.autorNome, conteudo: replySnapshot.conteudo } : undefined,
    };
    // 1) Optimistic: voc� v� sua mensagem imediatamente
    setDms((prev) => prev.map((dm) => dm.id === dmId ? {
      ...dm,
      mensagens: [...dm.mensagens, msg].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()),
    } : dm));
    setReplyTo(null);

    // 2) Persiste no DB primeiro � o servidor retorna o criado_em autoritativo (NOW())
    // O broadcast S� acontece depois, carregando o timestamp do servidor.
    // Isso garante que todos os clientes ordenam mensagens pelo rel�gio do servidor.
    try {
      const token = await getFreshToken();
      const r = await fetchWithRetry("/api/chat/mensagem", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          id: msgId, conversa_id: dmId, autor_id: u.id, autor_nome: u.nome, conteudo: text,
          resposta_a_id: replySnapshot?.id ?? null,
          resposta_a_autor_nome: replySnapshot?.autorNome ?? null,
          resposta_a_conteudo: replySnapshot?.conteudo ?? null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.error("sendDm error:", j.error);
        setDms((prev) => prev.map((dm) => dm.id === dmId ? { ...dm, mensagens: dm.mensagens.filter((m) => m.id !== msgId) } : dm));
        showToast("Erro ao enviar: " + (j.error ?? r.statusText));
        return;
      }
      const j = await r.json().catch(() => ({}));
      const serverTime: string = j.criado_em ?? clientTime;
      // 3) Atualiza seu estado local com o tempo do servidor + re-ordena
      const finalMsg = { ...msg, criadoEm: serverTime };
      setDms((prev) => prev.map((dm) => dm.id === dmId ? {
        ...dm,
        mensagens: dm.mensagens
          .map((m) => m.id === msgId ? finalMsg : m)
          .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()),
      } : dm));
      // 4) Broadcast com timestamp do servidor � amigo recebe na ordem correta
      broadcastChannelsRef.current.get(dmId)?.send({ type: "broadcast", event: "msg", payload: finalMsg });
    } catch (err) {
      console.error("sendDm network error:", err);
      setDms((prev) => prev.map((dm) => dm.id === dmId ? { ...dm, mensagens: dm.mensagens.filter((m) => m.id !== msgId) } : dm));
      showToast("Sem conex�o � mensagem n�o enviada");
    }
  }

  async function sendGrupo(grupoId: string, text: string) {
    const msgId = crypto.randomUUID();
    const replySnapshot = replyTo;
    const clientTime = new Date().toISOString();
    const msg: MensagemConversa = {
      id: msgId, autorId: u.id, autorNome: u.nome,
      conteudo: text, criadoEm: clientTime, lida: true,
      respostaA: replySnapshot ? { id: replySnapshot.id, autorNome: replySnapshot.autorNome, conteudo: replySnapshot.conteudo } : undefined,
    };
    // 1) Optimistic local
    setGrupos((prev) => prev.map((g) => g.id === grupoId ? {
      ...g,
      mensagens: [...g.mensagens, msg].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()),
    } : g));
    setReplyTo(null);

    // 2) DB primeiro ? timestamp do servidor
    try {
      const token = await getFreshToken();
      const r = await fetchWithRetry("/api/chat/mensagem", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          id: msgId, conversa_id: grupoId, autor_id: u.id, autor_nome: u.nome, conteudo: text,
          resposta_a_id: replySnapshot?.id ?? null,
          resposta_a_autor_nome: replySnapshot?.autorNome ?? null,
          resposta_a_conteudo: replySnapshot?.conteudo ?? null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.error("sendGrupo error:", j.error);
        setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, mensagens: g.mensagens.filter((m) => m.id !== msgId) } : g));
        showToast("Erro ao enviar: " + (j.error ?? r.statusText));
        return;
      }
      const j = await r.json().catch(() => ({}));
      const serverTime: string = j.criado_em ?? clientTime;
      // 3) Atualiza estado local com tempo do servidor
      const finalMsg = { ...msg, criadoEm: serverTime };
      setGrupos((prev) => prev.map((g) => g.id === grupoId ? {
        ...g,
        mensagens: g.mensagens
          .map((m) => m.id === msgId ? finalMsg : m)
          .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()),
      } : g));
      // 4) Broadcast com timestamp do servidor
      broadcastChannelsRef.current.get(grupoId)?.send({ type: "broadcast", event: "msg", payload: finalMsg });
    } catch (err) {
      console.error("sendGrupo network error:", err);
      setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, mensagens: g.mensagens.filter((m) => m.id !== msgId) } : g));
      showToast("Sem conex�o � mensagem n�o enviada");
    }
  }

  async function sendImage(conversaId: string, tipo: "direto" | "grupo", file: File) {
    const msgId = crypto.randomUUID();
    const localUrl = URL.createObjectURL(file);
    const msg: MensagemConversa = {
      id: msgId, autorId: u.id, autorNome: u.nome,
      conteudo: "", tipo: "imagem", mediaUrl: localUrl,
      criadoEm: new Date().toISOString(), lida: true,
    };
    // Optimistic: mostra imagem local imediatamente (s� para o remetente)
    if (tipo === "direto") setDms(prev => prev.map(dm => dm.id === conversaId ? { ...dm, mensagens: [...dm.mensagens, msg] } : dm));
    else setGrupos(prev => prev.map(g => g.id === conversaId ? { ...g, mensagens: [...g.mensagens, msg] } : g));
    // N�o faz broadcast ainda � blob: URL s� funciona localmente

    try {
      const token = await getFreshToken();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("conversa_id", conversaId);
      const upRes = await fetch("/api/chat/upload-imagem", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!upRes.ok) { const j = await upRes.json().catch(() => ({})); throw new Error(j.error ?? "Upload falhou"); }
      const { url: finalUrl } = await upRes.json();

      // Substitui URL local pela URL final
      const updater = (m: MensagemConversa) => m.id === msgId ? { ...m, mediaUrl: finalUrl } : m;
      if (tipo === "direto") setDms(prev => prev.map(dm => dm.id === conversaId ? { ...dm, mensagens: dm.mensagens.map(updater) } : dm));
      else setGrupos(prev => prev.map(g => g.id === conversaId ? { ...g, mensagens: g.mensagens.map(updater) } : g));
      URL.revokeObjectURL(localUrl);

      // Persiste no banco antes do broadcast para garantir push em ambiente serverless.
      const saveRes = await fetchWithRetry("/api/chat/mensagem", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: msgId, conversa_id: conversaId, autor_id: u.id, autor_nome: u.nome, conteudo: "", tipo: "imagem", media_url: finalUrl }),
      });
      if (!saveRes.ok) {
        const j = await saveRes.json().catch(() => ({}));
        throw new Error(j.error ?? "Erro ao salvar imagem");
      }
      const saveJson = await saveRes.json().catch(() => ({}));
      const serverTime = saveJson.criado_em ?? msg.criadoEm;

      // Atualiza horário com o timestamp do servidor e só então faz broadcast.
      const finalMsg = { ...msg, mediaUrl: finalUrl, criadoEm: serverTime };
      const updaterFinal = (m: MensagemConversa) => m.id === msgId ? finalMsg : m;
      if (tipo === "direto") {
        setDms(prev => prev.map(dm => dm.id === conversaId ? { ...dm, mensagens: dm.mensagens.map(updaterFinal) } : dm));
      } else {
        setGrupos(prev => prev.map(g => g.id === conversaId ? { ...g, mensagens: g.mensagens.map(updaterFinal) } : g));
      }
      broadcastChannelsRef.current.get(conversaId)?.send({ type: "broadcast", event: "msg", payload: finalMsg });
    } catch (err: unknown) {
      const msg2 = err instanceof Error ? err.message : "Erro ao enviar imagem";
      showToast(msg2);
      if (tipo === "direto") setDms(prev => prev.map(dm => dm.id === conversaId ? { ...dm, mensagens: dm.mensagens.filter(m => m.id !== msgId) } : dm));
      else setGrupos(prev => prev.map(g => g.id === conversaId ? { ...g, mensagens: g.mensagens.filter(m => m.id !== msgId) } : g));
      URL.revokeObjectURL(localUrl);
    }
  }

  async function sendArquivo(conversaId: string, tipo: "direto" | "grupo", fileOrBlob: File | Blob, tipoMsg: "audio" | "documento", nomeArquivo: string) {
    const msgId = crypto.randomUUID();
    const localUrl = URL.createObjectURL(fileOrBlob);
    const msg: MensagemConversa = {
      id: msgId, autorId: u.id, autorNome: u.nome,
      conteudo: tipoMsg === "documento" ? nomeArquivo : "",
      tipo: tipoMsg, mediaUrl: localUrl,
      criadoEm: new Date().toISOString(), lida: true,
    };
    if (tipo === "direto") setDms(prev => prev.map(dm => dm.id === conversaId ? { ...dm, mensagens: [...dm.mensagens, msg] } : dm));
    else setGrupos(prev => prev.map(g => g.id === conversaId ? { ...g, mensagens: [...g.mensagens, msg] } : g));
    // N�o faz broadcast ainda � blob: URL s� funciona localmente

    try {
      const token = await getFreshToken();
      const file = fileOrBlob instanceof File ? fileOrBlob : new File([fileOrBlob], nomeArquivo, { type: fileOrBlob.type });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("conversa_id", conversaId);
      fd.append("file_type", tipoMsg);
      const upRes = await fetch("/api/chat/upload-arquivo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!upRes.ok) { const j = await upRes.json().catch(() => ({})); throw new Error(j.error ?? "Upload falhou"); }
      const { url: finalUrl } = await upRes.json();

      const updater = (m: MensagemConversa) => m.id === msgId ? { ...m, mediaUrl: finalUrl } : m;
      if (tipo === "direto") setDms(prev => prev.map(dm => dm.id === conversaId ? { ...dm, mensagens: dm.mensagens.map(updater) } : dm));
      else setGrupos(prev => prev.map(g => g.id === conversaId ? { ...g, mensagens: g.mensagens.map(updater) } : g));
      URL.revokeObjectURL(localUrl);

      // Persiste no banco antes do broadcast para garantir push em ambiente serverless.
      const saveRes = await fetchWithRetry("/api/chat/mensagem", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: msgId, conversa_id: conversaId, autor_id: u.id, autor_nome: u.nome, conteudo: tipoMsg === "documento" ? nomeArquivo : "", tipo: tipoMsg, media_url: finalUrl }),
      });
      if (!saveRes.ok) {
        const j = await saveRes.json().catch(() => ({}));
        throw new Error(j.error ?? "Erro ao salvar arquivo");
      }
      const saveJson = await saveRes.json().catch(() => ({}));
      const serverTime = saveJson.criado_em ?? msg.criadoEm;

      // Atualiza horário com o timestamp do servidor e só então faz broadcast.
      const finalMsg = { ...msg, mediaUrl: finalUrl, criadoEm: serverTime };
      const updaterFinal = (m: MensagemConversa) => m.id === msgId ? finalMsg : m;
      if (tipo === "direto") {
        setDms(prev => prev.map(dm => dm.id === conversaId ? { ...dm, mensagens: dm.mensagens.map(updaterFinal) } : dm));
      } else {
        setGrupos(prev => prev.map(g => g.id === conversaId ? { ...g, mensagens: g.mensagens.map(updaterFinal) } : g));
      }
      broadcastChannelsRef.current.get(conversaId)?.send({ type: "broadcast", event: "msg", payload: finalMsg });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erro ao enviar arquivo";
      showToast(errMsg);
      if (tipo === "direto") setDms(prev => prev.map(dm => dm.id === conversaId ? { ...dm, mensagens: dm.mensagens.filter(m => m.id !== msgId) } : dm));
      else setGrupos(prev => prev.map(g => g.id === conversaId ? { ...g, mensagens: g.mensagens.filter(m => m.id !== msgId) } : g));
      URL.revokeObjectURL(localUrl);
    }
  }

  function editMsg(msgId: string, newText: string) {
    if (!activeChat) return;
    const updater = (msgs: MensagemConversa[]) =>
      msgs.map((m) => m.id === msgId ? { ...m, conteudo: newText, editadoEm: new Date().toISOString() } : m);
    if (activeChat.tipo === "direto") {
      setDms((prev) => prev.map((dm) => dm.id === activeChat.id ? { ...dm, mensagens: updater(dm.mensagens) } : dm));
    } else {
      setGrupos((prev) => prev.map((g) => g.id === activeChat.id ? { ...g, mensagens: updater(g.mensagens) } : g));
    }
    // fire-and-forget
    supabase.from("chat_mensagens")
      .update({ conteudo: newText, editado_em: new Date().toISOString() }).eq("id", msgId);
  }

  function toggleReaction(msgId: string, emoji: string) {
    if (!activeChat || !user?.id) return;
    const key = `${msgId}_${emoji}`;
    const already = myReacoes.has(key);

    // 1) Atualiza estado local e persiste no localStorage
    setMyReacoes((prev) => {
      const next = new Set(prev);
      already ? next.delete(key) : next.add(key);
      try { localStorage.setItem(`chat_reacoes_${user.id}`, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });

    // 2) Calcula novo array de rea��es para o banco e para outros usu�rios
    const getMsg = () => {
      const msgs = activeChat.tipo === "direto"
        ? dms.find(d => d.id === activeChat.id)?.mensagens
        : grupos.find(g => g.id === activeChat.id)?.mensagens;
      return msgs?.find(m => m.id === msgId);
    };
    const current = getMsg();
    const reacoes = current?.reacoes ?? [];
    const newReacoes = already
      ? reacoes.map(r => r.emoji === emoji ? { ...r, count: r.count - 1 } : r).filter(r => r.count > 0)
      : (() => { const ex = reacoes.find(r => r.emoji === emoji); return ex ? reacoes.map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r) : [...reacoes, { emoji, count: 1 }]; })();

    // 3) Atualiza estado local imediatamente (optimistic)
    const updater = (msgs: MensagemConversa[]): MensagemConversa[] =>
      msgs.map(m => m.id === msgId ? { ...m, reacoes: newReacoes } : m);
    if (activeChat.tipo === "direto") {
      setDms(prev => prev.map(dm => dm.id === activeChat.id ? { ...dm, mensagens: updater(dm.mensagens) } : dm));
    } else {
      setGrupos(prev => prev.map(g => g.id === activeChat.id ? { ...g, mensagens: updater(g.mensagens) } : g));
    }

    // 4) Persiste no banco � dispara UPDATE que o postgres_changes j� escuta
    // O outro usu�rio receber� a atualiza��o automaticamente via postgres_changes UPDATE
    supabase.from("chat_mensagens")
      .update({ reacoes: newReacoes })
      .eq("id", msgId)
      .then(({ error }) => {
        if (error) console.error("toggleReaction DB error:", error.message);
      });
  }

  const myDms = dms.filter((dm) => dm.participantes.includes(u.id) && !archivedDms.has(dm.id));
  const filteredDms = myDms.filter((dm) => !search || otherParticipant(dm).nome.toLowerCase().includes(search.toLowerCase()));
  const myGrupos = grupos.filter((g) => g.membros.includes(u.id));
  const filteredGrupos = myGrupos.filter((g) => !search || g.nome.toLowerCase().includes(search.toLowerCase()));

  function dmUnread(dm: ConversaDireta) { return dm.mensagens.filter((m) => m.autorId !== u.id && !m.lida).length; }
  function grupoUnread(g: Grupo) { return g.mensagens.filter((m) => m.autorId !== u.id && !m.lida).length; }

  const totalDmUnread = myDms.reduce((s, dm) => s + dmUnread(dm), 0);
  const totalGrupoUnread = myGrupos.reduce((s, g) => s + grupoUnread(g), 0);

  const activeDm = activeChat?.tipo === "direto" ? dms.find((d) => d.id === activeChat.id) : null;
  const activeGrupo = activeChat?.tipo === "grupo" ? grupos.find((g) => g.id === activeChat.id) : null;

  const gruposBySection = [
    { label: "Canais", items: filteredGrupos.filter((g) => !!g.institucional) },
    { label: "Grupos", items: filteredGrupos.filter((g) => !g.institucional) },
  ].filter((s) => s.items.length > 0);

  function getMessages() {
    if (activeDm) return activeDm.mensagens;
    if (activeGrupo) return activeGrupo.mensagens;
    return [] as MensagemConversa[];
  }

  function openChat(chat: ActiveChat) {
    setActiveChat(chat);
    activeChatRef.current = chat;
    setActiveChatId(chat?.id ?? null);
    setInfoOpen(false);
    setChatSearchOpen(false);
    setChatSearchQuery("");
    // Marca todas as mensagens da conversa aberta como lidas
    if (chat?.tipo === "direto") {
      setDms(prev => prev.map(dm => dm.id === chat.id
        ? { ...dm, mensagens: dm.mensagens.map(m => ({ ...m, lida: true })) }
        : dm));
    } else if (chat?.tipo === "grupo") {
      setGrupos(prev => prev.map(g => g.id === chat.id
        ? { ...g, mensagens: g.mensagens.map(m => ({ ...m, lida: true })) }
        : g));
    }
  }

  // -- Chat header ---------------------------------------------------

  function renderChatHeader(name: string, subtitle: string, avatarEl: ReactNode) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white shrink-0"
        style={isMobileChatViewport ? { paddingTop: "calc(0.75rem + env(safe-area-inset-top))" } : undefined}
      >
        <button
          onClick={() => openChat(null)}
          className="lg:hidden text-gray-400 hover:text-gray-800 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Clickable name/avatar ? info panel */}
        <button
          onClick={() => setInfoOpen((v) => !v)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition"
        >
          {avatarEl}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{name}</p>
            <p className="text-[11px] text-gray-400 truncate capitalize">{subtitle}</p>
          </div>
        </button>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => { setChatSearchOpen((v) => !v); setChatSearchQuery(""); }}
            className={clsx("w-8 h-8 rounded-full flex items-center justify-center transition",
              chatSearchOpen ? "bg-gray-100 text-slate-800" : "text-gray-400 hover:text-gray-800 hover:bg-gray-100")}
            title="Pesquisar na conversa"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setInfoOpen((v) => !v)}
            className={clsx("w-8 h-8 rounded-full flex items-center justify-center transition",
              infoOpen ? "bg-gray-100 text-slate-800" : "text-gray-400 hover:text-gray-800 hover:bg-gray-100")}
            title="Informacoes"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // -- Chat panel ----------------------------------------------------

  function renderChatPanel() {
    if (!activeChat) return null;
    const messages = getMessages();
    let headerEl: ReactNode = null;
    let infoProps: { name: string; description?: string; emoji?: string; cor?: string } | null = null;
    let locked = false;

    if (activeChat.tipo === "direto" && activeDm) {
      const other = otherParticipant(activeDm);
      const otherUser = usuarios.find((mu) => mu.id === other.id);
      const avatarEl = (
        <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
          {iniciais(other.nome)}
        </div>
      );
      headerEl = renderChatHeader(other.nome, otherUser?.role ?? "membro", avatarEl);
      infoProps = { name: other.nome, description: otherUser?.role };
    } else if (activeChat.tipo === "grupo" && activeGrupo) {
      locked = !canWrite(activeGrupo);
      const avatarEl = <GrupoAvatar grupo={activeGrupo} size="sm" />;
      headerEl = renderChatHeader(
        activeGrupo.nome,
        activeGrupo.somenteAdmin ? "Somente lideranca" : (activeGrupo.descricao ?? ""),
        avatarEl
      );
      infoProps = { name: activeGrupo.nome, description: activeGrupo.descricao, emoji: activeGrupo.emoji, cor: activeGrupo.cor };
    }

    return (
      <div className="flex flex-1 h-full min-h-0 min-w-0">
        {/* Chat column */}
        <div className="flex flex-col flex-1 h-full min-h-0 min-w-0">
          {headerEl}

          {/* In-chat search bar */}
          {chatSearchOpen && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white shrink-0">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                autoFocus
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Pesquisar na conversa..."
                className="flex-1 text-sm outline-none placeholder:text-gray-400"
              />
              {chatSearchQuery && (
                <button onClick={() => setChatSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <ConversationMessages
            messages={messages}
            myId={u.id}
            isGroup={activeChat.tipo === "grupo"}
            searchQuery={chatSearchOpen ? chatSearchQuery : ""}
            onStar={toggleStar}
            starredIds={starredIds}
            onEdit={editMsg}
            onReply={setReplyTo}
            onReact={toggleReaction}
            myReacoes={myReacoes}
          />

          {/* Reply preview bar */}
          {replyTo && (
            <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-100 bg-gray-50 shrink-0">
              <div className="w-0.5 h-9 rounded-full bg-gray-800 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-800">{replyTo.autorNome}</p>
                <p className="text-xs text-gray-500 truncate">{replyTo.conteudo}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <ComposeBar
            onSend={(t) => activeChat.tipo === "direto" ? sendDm(activeChat.id, t) : sendGrupo(activeChat.id, t)}
            onSendImage={(f) => sendImage(activeChat.id, activeChat.tipo, f)}
            onSendAudio={(blob, name) => sendArquivo(activeChat.id, activeChat.tipo, blob, "audio", name)}
            onSendDoc={(f) => sendArquivo(activeChat.id, activeChat.tipo, f, "documento", f.name)}
            disabled={locked}
            onToast={showToast}
          />
        </div>

        {/* Info panel (right) */}
        {infoOpen && infoProps && (
          <InfoPanel
            {...infoProps}
            messages={messages}
            starredIds={starredIds}
            onClose={() => setInfoOpen(false)}
          />
        )}
      </div>
    );
  }

  // -- Left list -----------------------------------------------------

  function renderList() {
    return (
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-white shrink-0">
          {([
            { id: "direto" as ChatTab, label: "Mensagens", icon: MessageSquare, unread: totalDmUnread },
            { id: "grupos" as ChatTab, label: "Grupos",    icon: Users,         unread: totalGrupoUnread },
          ]).map(({ id, label, icon: Icon, unread }) => (
            <button
              key={id}
              onClick={() => { setTab(id); openChat(null); setSearch(""); }}
              className={clsx(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold border-b-2 transition",
                tab === id ? "border-slate-600 text-slate-800" : "border-transparent text-gray-400 hover:text-gray-800"
              )}
            >
              <span className="relative">
                <Icon className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </span>
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-gray-50 bg-white shrink-0 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="bg-transparent text-sm outline-none flex-1 placeholder:text-gray-400"
            />
          </div>
          <button
            onClick={() => tab === "direto" ? setShowNewDmModal(true) : setShowNewGroupModal(true)}
            className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 hover:bg-slate-800 active:scale-95 transition"
            title={tab === "direto" ? "Nova conversa" : "Criar grupo"}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {tab === "direto" && (
            <>
              {filteredDms.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-gray-300">
                  <MessageSquare className="w-8 h-8 opacity-40" />
                  <p className="text-sm text-gray-400">Nenhuma conversa ainda.</p>
                  <button onClick={() => setShowNewDmModal(true)} className="text-xs text-gray-800 font-semibold mt-1 hover:underline">Iniciar conversa</button>
                </div>
              )}
              {filteredDms.map((dm) => {
                const other = otherParticipant(dm);
                const last = dm.mensagens[dm.mensagens.length - 1];
                const unread = dmUnread(dm);
                const isActive = activeChat?.tipo === "direto" && activeChat.id === dm.id;
                const ctxOpen = ctxMenu?.id === dm.id && ctxMenu.type === "dm";
                return (
                  <div
                    key={dm.id}
                    className={clsx("relative group w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 transition cursor-pointer select-none", isActive ? "bg-gray-50" : "hover:bg-gray-50")}
                    onClick={() => openChat({ tipo: "direto", id: dm.id })}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold">
                        {iniciais(other.nome)}
                      </div>
                      {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={clsx("text-sm truncate", unread > 0 ? "font-bold text-slate-800" : "font-semibold text-gray-700")}>
                          {other.nome.split(" ")[0]}{" "}<span className="font-normal text-gray-400">{other.nome.split(" ").slice(1).join(" ")}</span>
                        </span>
                        {last && <span className="text-[10px] text-gray-400 shrink-0">{formatDay(last.criadoEm)}</span>}
                      </div>
                      {last && (
                        <p className={clsx("text-xs truncate mt-0.5", unread > 0 ? "text-gray-700 font-medium" : "text-gray-400")}>
                          {last.autorId === u.id ? "Voce: " : ""}{last.tipo === "imagem" ? "?? Foto" : last.tipo === "audio" ? "?? �udio" : last.tipo === "documento" ? "?? " + (last.conteudo || "Documento") : last.conteudo}
                        </p>
                      )}
                    </div>
                    {/* Context menu */}
                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setCtxMenu(ctxOpen ? null : { id: dm.id, type: "dm" })}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {ctxOpen && (
                        <div className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[170px]">
                          <button
                            onClick={() => deleteDm(dm.id)}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Apagar conversa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {tab === "grupos" && (
            <>
              {gruposBySection.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-gray-300">
                  <Users className="w-8 h-8 opacity-40" />
                  <p className="text-sm text-gray-400">Voce nao participa de nenhum grupo.</p>
                  <button onClick={() => setShowNewGroupModal(true)} className="text-xs text-gray-800 font-semibold mt-1 hover:underline">Criar grupo</button>
                </div>
              )}
              {gruposBySection.map((section) => (
                <div key={section.label}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 pt-4 pb-1.5">{section.label}</p>
                  {section.items.map((g) => {
                    const last = g.mensagens[g.mensagens.length - 1];
                    const unread = grupoUnread(g);
                    const isActive = activeChat?.tipo === "grupo" && activeChat.id === g.id;
                    const ctxOpen = ctxMenu?.id === g.id && ctxMenu.type === "grupo";
                    const isAdmin = g.adminId === u.id;
                    return (
                      <div
                        key={g.id}
                        className={clsx("relative group w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition cursor-pointer select-none", isActive ? "bg-gray-50" : "hover:bg-gray-50")}
                        onClick={() => openChat({ tipo: "grupo", id: g.id })}
                      >
                        <div className="relative shrink-0">
                          <GrupoAvatar grupo={g} size="sm" />
                          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={clsx("text-sm truncate", unread > 0 ? "font-bold text-slate-800" : "font-semibold text-gray-700")}>{g.nome}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {g.somenteAdmin && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                              {last && <span className="text-[10px] text-gray-400">{formatDay(last.criadoEm)}</span>}
                            </div>
                          </div>
                          {last ? (
                            <p className={clsx("text-xs truncate mt-0.5", unread > 0 ? "text-gray-700 font-medium" : "text-gray-400")}>
                              {last.autorId === u.id ? "Voce: " : last.autorNome.split(" ")[0] + ": "}{last.tipo === "imagem" ? "?? Foto" : last.tipo === "audio" ? "?? �udio" : last.tipo === "documento" ? "?? " + (last.conteudo || "Documento") : last.conteudo}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-300 mt-0.5 italic">{g.descricao}</p>
                          )}
                        </div>
                        {/* Context menu � apenas grupos nao institucionais */}
                        {!g.institucional && (
                          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setCtxMenu(ctxOpen ? null : { id: g.id, type: "grupo" })}
                              className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {ctxOpen && (
                              <div className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[150px]">
                                {isAdmin ? (
                                  <button
                                    onClick={() => deleteGrupo(g.id)}
                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Excluir grupo
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => leaveGrupo(g.id)}
                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 transition"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Sair do grupo
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Layout -------------------------------------------------------

  return (
    <div>
      {toast && <Toast msg={toast} />}
      {showNewDmModal && <NewDmModal currentUserId={u.id} dms={dms} usuarios={usuarios} onStart={startDm} onClose={() => setShowNewDmModal(false)} />}
      {showNewGroupModal && <NewGroupModal currentUserId={u.id} usuarios={usuarios} onClose={() => setShowNewGroupModal(false)} onCreate={createGroup} />}
      <div className="mb-3">
        <h1 className="text-xl md:text-2xl font-sans font-semibold text-black">Mensagens</h1>
        <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">
          Conversas diretas, chat do culto e canais de minist�rio.
        </p>
      </div>

      <div
        className={clsx(
          "bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden",
          activeChat && isMobileChatViewport && "fixed inset-x-0 z-50 rounded-none border-0 shadow-none"
        )}
        style={activeChat && isMobileChatViewport
          ? {
              top: "var(--vv-offset-top, 0px)",
              bottom: "auto",
              height: "var(--chat-vvh, 100dvh)",
              minHeight: 0,
              zIndex: 60,
            }
          : { height: "calc(100dvh - 180px)", minHeight: 400 }
        }
      >
        <div className="flex h-full min-h-0">
          {/* Left list */}
          <div className={clsx("flex flex-col border-r border-gray-100 shrink-0 w-full md:w-72 lg:w-80", activeChat !== null ? "hidden md:flex" : "flex")}>
            {renderList()}
          </div>

          {/* Right chat area */}
          <div className={clsx("flex-1 flex min-h-0 min-w-0", activeChat === null ? "hidden md:flex" : "flex")}>
            {activeChat ? renderChatPanel() : (
              <div className="flex flex-col items-center justify-center w-full text-gray-300 gap-3">
                <MessageSquare className="w-12 h-12 opacity-30" />
                <p className="text-base font-medium text-gray-400">Selecione uma conversa</p>
                <p className="text-xs text-gray-400 max-w-[220px] text-center">Mensagens diretas ou entre em um dos grupos da igreja</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
