"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatUnread } from "@/contexts/ChatUnreadContext";
import { supabase } from "@/lib/supabase";
import { ConversaDireta, Grupo, MensagemConversa } from "@/types";
import {
  MessageSquare, Users, Send, ArrowLeft, Search, Lock, Plus,
  Phone, Video, Info, Smile, Paperclip, Mic, Star, X, FileText,
  Image as ImageIcon, MoreVertical, Trash2, LogOut, Check, Archive, Pencil, Reply,
} from "lucide-react";
import clsx from "clsx";

// ─── Constants ────────────────────────────────────────────────────

const EMOJIS = [
  "😀","😂","❤️","🙏","👍","🎉","🔥","😭",
  "😍","🤔","😊","✅","🙌","💪","🎸","📖",
  "⛪","🕊️","✝️","🌿","😅","🤣","💕","🥰",
  "👏","🎵","🙋","💬","📋","🤝","🍞","🧒",
];

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "🙏"];

const MOCK_MEDIA = [
  "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=200&q=60",
  "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?w=200&q=60",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&q=60",
  "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=200&q=60",
  "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=200&q=60",
  "https://images.unsplash.com/photo-1484820540004-14229fe36ca4?w=200&q=60",
];

// ─── Helpers ──────────────────────────────────────────────────────

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

type ChatTab = "direto" | "grupos";
type ActiveChat = { tipo: "direto"; id: string } | { tipo: "grupo"; id: string } | null;

// ─── Toast ────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-xl pointer-events-none">
      {msg}
    </div>
  );
}

// ─── EmojiPicker ─────────────────────────────────────────────────

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

// ─── AttachMenu ───────────────────────────────────────────────────

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

// ─── ComposeBar ───────────────────────────────────────────────────

function ComposeBar({
  onSend, disabled, onToast,
}: {
  onSend: (t: string) => void;
  disabled?: boolean;
  onToast: (msg: string) => void;
}) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);

  function handleSend() {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
    setShowEmoji(false);
  }

  if (disabled) {
    return (
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex items-center gap-2 text-gray-400 shrink-0">
        <Lock className="w-4 h-4 shrink-0" />
        <span className="text-xs">Somente pastores e lideres podem enviar mensagens aqui.</span>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 bg-white px-3 py-3 shrink-0">
      <div className="flex items-end gap-2 relative">
        {showEmoji && (
          <EmojiPicker
            onSelect={(e) => setText((prev) => prev + e)}
            onClose={() => setShowEmoji(false)}
          />
        )}
        {showAttach && (
          <AttachMenu
            onAction={(label) => onToast(`${label}: disponivel em breve`)}
            onClose={() => setShowAttach(false)}
          />
        )}

        {/* Attach */}
        <button
          onClick={() => { setShowAttach((v) => !v); setShowEmoji(false); }}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-vine-600 hover:bg-gray-100 transition shrink-0"
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
            placeholder="Digite uma mensagem..."
            rows={1}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-vine-300 focus:border-vine-400 leading-relaxed max-h-32 overflow-y-auto"
          />
          <button
            onClick={() => { setShowEmoji((v) => !v); setShowAttach(false); }}
            className="absolute right-2 bottom-2 text-gray-400 hover:text-yellow-500 transition"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>

        {/* Send / Mic */}
        {text.trim() ? (
          <button
            onClick={handleSend}
            className="w-10 h-10 rounded-full bg-vine-700 text-white flex items-center justify-center shrink-0 hover:bg-vine-800 active:scale-95 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => onToast("Gravacao de audio: disponivel em breve")}
            className="w-10 h-10 rounded-full bg-vine-700 text-white flex items-center justify-center shrink-0 hover:bg-vine-800 active:scale-95 transition"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────

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
      className={clsx("flex gap-2 max-w-[80%] relative", isMe ? "ml-auto flex-row-reverse" : "")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!isMe && (
        <div className="w-7 h-7 rounded-full bg-vine-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 self-end mb-1">
          {iniciais(msg.autorNome)}
        </div>
      )}
      <div className={clsx("flex flex-col", isMe ? "items-end" : "items-start")}>
        {showAuthor && !isMe && (
          <span className="text-[10px] font-semibold text-vine-600 mb-0.5 px-1">
            {msg.autorNome.split(" ")[0]}
          </span>
        )}

        {/* Quoted reply block */}
        {msg.respostaA && !editing && (
          <div
            className={clsx(
              "mb-1 rounded-xl px-3 py-1.5 text-xs max-w-full border-l-2",
              isMe ? "bg-vine-600 border-white/50 text-white/90" : "bg-gray-100 border-vine-400 text-gray-600"
            )}
          >
            <p className={clsx("font-semibold text-[10px] truncate mb-0.5", isMe ? "text-white/70" : "text-vine-600")}>
              {msg.respostaA.autorNome}
            </p>
            <p className="truncate leading-snug">{msg.respostaA.conteudo}</p>
          </div>
        )}

        {/* Bubble or edit mode */}
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
              className="w-full resize-none rounded-2xl border-2 border-vine-400 bg-white px-3.5 py-2 text-sm text-gray-800 focus:outline-none leading-relaxed max-h-32 overflow-y-auto"
            />
            <div className="flex justify-end gap-2 mt-1 px-1">
              <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600 transition px-2 py-0.5">
                Cancelar
              </button>
              <button onClick={saveEdit} className="text-xs bg-vine-700 text-white rounded-full px-3 py-0.5 hover:bg-vine-800 transition">
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div
            className={clsx(
              "px-3.5 py-2 rounded-2xl text-sm leading-relaxed max-w-full break-words",
              isMe ? "bg-vine-700 text-white rounded-br-sm" : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm"
            )}
          >
            {msg.conteudo}
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
                  "flex items-center gap-1 text-sm bg-white border rounded-full px-2 py-0.5 transition hover:border-vine-300",
                  myReacted.includes(r.emoji) ? "border-vine-400 bg-vine-50" : "border-gray-200"
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
      </div>

      {/* Action buttons beside bubble — appear on hover */}
      {(hover || emojiOpen) && !editing && (
        <div className="flex flex-col items-center gap-1 self-center relative">
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
                      myReacted.includes(emoji) && "bg-vine-50 ring-1 ring-vine-300"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setEmojiOpen(!emojiOpen)}
              className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[14px] hover:border-vine-300 transition"
              title="Reagir"
            >
              😊
            </button>
          </div>
          <button
            onClick={() => onReply(msg)}
            className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-vine-600 hover:border-vine-300 transition"
            title="Responder"
          >
            <Reply className="w-3 h-3" />
          </button>
          {isMe && (
            <button
              onClick={startEdit}
              className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-vine-600 hover:border-vine-300 transition"
              title="Editar"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => onStar(msg.id)}
            className={clsx(
              "w-6 h-6 rounded-full bg-white border shadow-sm flex items-center justify-center transition hover:border-vine-300",
              isStarred ? "border-gold-300 text-gold-500" : "border-gray-200 text-gray-400"
            )}
            title="Favoritar"
          >
            <Star className={clsx("w-3 h-3", isStarred && "fill-gold-500")} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ConversationMessages ─────────────────────────────────────────

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
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50">
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

// ─── InfoPanel ────────────────────────────────────────────────────

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
          <div className={clsx("w-14 h-14 rounded-full flex items-center justify-center text-3xl text-white", cor ?? "bg-vine-700")}>
            {emoji}
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-vine-700 text-white flex items-center justify-center text-xl font-bold">
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
              tab === t ? "border-vine-600 text-vine-700" : "border-transparent text-gray-400 hover:text-vine-600"
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
            <div className="grid grid-cols-3 gap-0.5">
              {MOCK_MEDIA.map((url, i) => (
                <div
                  key={i}
                  className="aspect-square bg-gray-100 cursor-pointer hover:opacity-90 transition"
                  style={{ backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }}
                />
              ))}
            </div>
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
                  <p className="text-[10px] font-semibold text-vine-600 mb-0.5">{m.autorNome.split(" ")[0]}</p>
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

// ─── NewDmModal ──────────────────────────────────────────────────

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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
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
                <div className="w-9 h-9 rounded-full bg-vine-700 text-white flex items-center justify-center text-sm font-bold shrink-0">{iniciais(mu.nome)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{mu.nome}</p>
                  <p className="text-xs text-gray-400 capitalize truncate">{mu.role}</p>
                </div>
                {hasChat && (
                  <span className="text-[10px] text-vine-600 font-semibold bg-vine-50 px-2 py-0.5 rounded-full shrink-0">Abrir</span>
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

// ─── NewGroupModal ────────────────────────────────────────────────

const GROUP_EMOJIS = ["💬","⛪","🎸","📖","✝️","🌿","🤝","📋","🎉","🙏","👑","⚡","🕊️","🎵"];

function NewGroupModal({
  currentUserId, usuarios, onClose, onCreate,
}: {
  currentUserId: string;
  usuarios: import("@/types").User[];
  onClose: () => void;
  onCreate: (nome: string, emoji: string, membros: string[]) => void;
}) {
  const [nome, setNome] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [membros, setMembros] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const others = usuarios.filter((mu) => mu.id !== currentUserId);
  const filtered = others.filter((mu) => !search || mu.nome.toLowerCase().includes(search.toLowerCase()));
  function toggle(id: string) {
    setMembros((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Criar Grupo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-vine-100 border-2 border-vine-200 flex items-center justify-center text-2xl">{emoji}</div>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do grupo" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vine-300" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} className={clsx("text-xl w-9 h-9 rounded-xl flex items-center justify-center transition", emoji === e ? "bg-vine-100 ring-2 ring-vine-400" : "hover:bg-gray-100")}>{e}</button>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Adicionar membros</p>
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 mb-2">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar membro..." className="bg-transparent text-sm outline-none flex-1" />
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {filtered.map((mu) => (
                <button key={mu.id} onClick={() => toggle(mu.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition text-left">
                  <div className="w-8 h-8 rounded-full bg-vine-700 text-white flex items-center justify-center text-xs font-bold shrink-0">{iniciais(mu.nome)}</div>
                  <span className="flex-1 text-sm text-gray-700 truncate">{mu.nome}</span>
                  {membros.includes(mu.id) && <Check className="w-4 h-4 text-vine-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-4">
          <button onClick={() => nome.trim() && onCreate(nome.trim(), emoji, membros)} disabled={!nome.trim()} className="w-full bg-vine-700 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-vine-800 disabled:opacity-40 disabled:cursor-not-allowed transition">
            Criar Grupo{membros.length > 0 ? ` (${membros.length + 1} membros)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GrupoAvatar ─────────────────────────────────────────────────

function GrupoAvatar({ grupo, size = "md" }: { grupo: Grupo; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-9 h-9 text-base" : "w-10 h-10 text-xl";
  return (
    <div className={clsx("rounded-full flex items-center justify-center text-white shrink-0", sz, grupo.cor)}>
      {grupo.emoji}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user, usuarios } = useAuth();
  const { setTotalUnread } = useChatUnread();
  const [tab, setTab] = useState<ChatTab>("direto");
  const [activeChat, setActiveChat] = useState<ActiveChat>(null);
  const [search, setSearch] = useState("");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [dms, setDms] = useState<ConversaDireta[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [archivedDms, setArchivedDms] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<MensagemConversa | null>(null);
  const [myReacoes, setMyReacoes] = useState<Set<string>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<{ id: string; type: "dm" | "grupo" } | null>(null);
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [conversaIds, setConversaIds] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broadcastChannelsRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatesChannelRef = useRef<any>(null);
  const activeChatRef = useRef<ActiveChat>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    function handleClick() { setCtxMenu(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [ctxMenu]);

  // ── helpers Supabase ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function rowToMensagem(row: any): MensagemConversa {
    return {
      id: row.id,
      autorId: row.autor_id,
      autorNome: row.autor_nome ?? "?",
      conteudo: row.conteudo,
      criadoEm: row.criado_em,
      editadoEm: row.editado_em ?? undefined,
      respostaA: row.resposta_a_id ? {
        id: row.resposta_a_id,
        autorNome: row.resposta_a_autor_nome ?? "",
        conteudo: row.resposta_a_conteudo ?? "",
      } : undefined,
    };
  }

  // ── carregar conversas ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    carregarConversas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function carregarConversas() {
    if (!user) return;
    const { data: participacoes } = await supabase
      .from("chat_participantes").select("conversa_id").eq("user_id", user.id);
    if (!participacoes?.length) return;

    const ids = (participacoes as { conversa_id: string }[]).map(p => p.conversa_id);

    const [{ data: conversas }, { data: todosParticipantes }, { data: ultimasMsgs }] = await Promise.all([
      supabase.from("chat_conversas").select("*").in("id", ids),
      supabase.from("chat_participantes").select("conversa_id, user_id").in("conversa_id", ids),
      supabase.from("chat_mensagens").select("*").in("conversa_id", ids).order("criado_em", { ascending: false }).limit(ids.length * 3),
    ]);

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
        const otherNome = nomePorId[otherId] ?? usuarios.find(mu => mu.id === otherId)?.nome ?? "Usuário";
        newDms.push({
          id: c.id,
          participantes: [user.id, otherId] as [string, string],
          participantesNomes: [user.nome, otherNome] as [string, string],
          mensagens,
        });
      } else {
        newGrupos.push({
          id: c.id, nome: c.nome ?? "Grupo", tipo: "geral",
          emoji: c.emoji ?? "💬", cor: c.cor ?? "bg-vine-700",
          descricao: c.descricao ?? undefined, adminId: c.admin_id ?? undefined,
          somenteAdmin: c.somente_admin ?? false, institucional: c.institucional ?? false,
          membros: membrosIds, mensagens,
        });
      }
    }

    setDms(newDms);
    setGrupos(newGrupos);
    setConversaIds([...newDms.map(d => d.id), ...newGrupos.map(g => g.id)]);
  }

  async function carregarMensagens(conversaId: string) {
    const { data } = await supabase
      .from("chat_mensagens").select("*")
      .eq("conversa_id", conversaId)
      .order("criado_em", { ascending: true })
      .limit(100);
    if (!data) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbMsgs = (data as any[]).map(row => ({ ...rowToMensagem(row), lida: true }));
    const dbIds = new Set(dbMsgs.map((m: MensagemConversa) => m.id));
    // Merge: mantém mensagens otimistas (enviadas mas insert ainda em voo) que não estão no banco ainda
    setDms(prev => prev.map(dm => {
      if (dm.id !== conversaId) return dm;
      const pending = dm.mensagens.filter(m => !dbIds.has(m.id));
      return { ...dm, mensagens: [...dbMsgs, ...pending] };
    }));
    setGrupos(prev => prev.map(g => {
      if (g.id !== conversaId) return g;
      const pending = g.mensagens.filter(m => !dbIds.has(m.id));
      return { ...g, mensagens: [...dbMsgs, ...pending] };
    }));
  }

  // ── broadcast: subscribe a cada conversa (WebSocket puro, sem banco) ──
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
          setDms(prev => prev.map(dm => dm.id === cid ? {
            ...dm,
            mensagens: dm.mensagens.some(m => m.id === msg.id) ? dm.mensagens : [...dm.mensagens, msg],
          } : dm));
          setGrupos(prev => prev.map(g => g.id === cid ? {
            ...g,
            mensagens: g.mensagens.some(m => m.id === msg.id) ? g.mensagens : [...g.mensagens, msg],
          } : g));
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

  // ── postgres_changes: só para UPDATE (edições) e novas participações ──
  useEffect(() => {
    if (!user?.id) return;
    if (updatesChannelRef.current) supabase.removeChannel(updatesChannelRef.current);
    const ch = supabase.channel(`chat_updates_${user.id}`)
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
      .subscribe();
    updatesChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── carrega histórico ao abrir conversa ────────────────────────────
  useEffect(() => {
    if (!activeChat) return;
    carregarMensagens(activeChat.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  // ── atualiza totalUnread no contexto ─────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const total =
      dms.reduce((s, dm) => s + dm.mensagens.filter(m => m.autorId !== uid && !m.lida).length, 0) +
      grupos.reduce((s, g) => s + g.mensagens.filter(m => m.autorId !== uid && !m.lida).length, 0);
    setTotalUnread(total);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dms, grupos]);

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
    // deleta conversa — ON DELETE CASCADE remove participantes e mensagens
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
    setDms((prev) => [...prev, {
      id: cid,
      participantes: [u.id, userId] as [string, string],
      participantesNomes: [u.nome, userNome] as [string, string],
      mensagens: [],
    }]);
    setConversaIds(prev => prev.includes(cid) ? prev : [...prev, cid]);
    openChat({ tipo: "direto", id: cid });
    setShowNewDmModal(false);
  }

  async function createGroup(nome: string, emoji: string, membros: string[]) {
    const allMembros = membros.includes(u.id) ? membros : [...membros, u.id];
    const res = await fetch("/api/chat/criar-conversa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "grupo", nome, emoji, cor: "bg-vine-700",
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
      id: cid, nome, tipo: "geral", emoji, cor: "bg-vine-700",
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

  function sendDm(dmId: string, text: string) {
    const msgId = crypto.randomUUID();
    const replySnapshot = replyTo;
    const msg: MensagemConversa = {
      id: msgId, autorId: u.id, autorNome: u.nome,
      conteudo: text, criadoEm: new Date().toISOString(), lida: true,
      respostaA: replySnapshot ? { id: replySnapshot.id, autorNome: replySnapshot.autorNome, conteudo: replySnapshot.conteudo } : undefined,
    };
    setDms((prev) => prev.map((dm) => dm.id === dmId ? { ...dm, mensagens: [...dm.mensagens, msg] } : dm));
    setReplyTo(null);
    // Broadcast: entrega instantânea via WebSocket
    broadcastChannelsRef.current.get(dmId)?.send({ type: "broadcast", event: "msg", payload: msg });
    // DB: persistência via API route (service role + keepalive garante salvar mesmo em reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch("/api/chat/mensagem", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({
          id: msgId, conversa_id: dmId, autor_id: u.id, autor_nome: u.nome, conteudo: text,
          resposta_a_id: replySnapshot?.id ?? null,
          resposta_a_autor_nome: replySnapshot?.autorNome ?? null,
          resposta_a_conteudo: replySnapshot?.conteudo ?? null,
        }),
      }).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          console.error("sendDm error:", j.error);
          setDms((prev) => prev.map((dm) => dm.id === dmId ? { ...dm, mensagens: dm.mensagens.filter((m) => m.id !== msgId) } : dm));
          showToast("Erro ao enviar: " + (j.error ?? r.statusText));
        }
      });
    });
  }

  function sendGrupo(grupoId: string, text: string) {
    const msgId = crypto.randomUUID();
    const replySnapshot = replyTo;
    const msg: MensagemConversa = {
      id: msgId, autorId: u.id, autorNome: u.nome,
      conteudo: text, criadoEm: new Date().toISOString(), lida: true,
      respostaA: replySnapshot ? { id: replySnapshot.id, autorNome: replySnapshot.autorNome, conteudo: replySnapshot.conteudo } : undefined,
    };
    setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, mensagens: [...g.mensagens, msg] } : g));
    setReplyTo(null);
    // Broadcast: entrega instantânea via WebSocket
    broadcastChannelsRef.current.get(grupoId)?.send({ type: "broadcast", event: "msg", payload: msg });
    // DB: persistência via API route (service role + keepalive garante salvar mesmo em reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch("/api/chat/mensagem", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({
          id: msgId, conversa_id: grupoId, autor_id: u.id, autor_nome: u.nome, conteudo: text,
          resposta_a_id: replySnapshot?.id ?? null,
          resposta_a_autor_nome: replySnapshot?.autorNome ?? null,
          resposta_a_conteudo: replySnapshot?.conteudo ?? null,
        }),
      }).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          console.error("sendGrupo error:", j.error);
          setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, mensagens: g.mensagens.filter((m) => m.id !== msgId) } : g));
          showToast("Erro ao enviar: " + (j.error ?? r.statusText));
        }
      });
    });
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
    const key = `${msgId}_${emoji}`;
    const already = myReacoes.has(key);
    setMyReacoes((prev) => {
      const next = new Set(prev);
      already ? next.delete(key) : next.add(key);
      return next;
    });
    const updater = (msgs: MensagemConversa[]): MensagemConversa[] =>
      msgs.map((m) => {
        if (m.id !== msgId) return m;
        const reacoes = m.reacoes ?? [];
        if (already) {
          return { ...m, reacoes: reacoes.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1 } : r).filter((r) => r.count > 0) };
        } else {
          const ex = reacoes.find((r) => r.emoji === emoji);
          return { ...m, reacoes: ex ? reacoes.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1 } : r) : [...reacoes, { emoji, count: 1 }] };
        }
      });
    if (activeChat?.tipo === "direto") {
      setDms((prev) => prev.map((dm) => dm.id === activeChat!.id ? { ...dm, mensagens: updater(dm.mensagens) } : dm));
    } else if (activeChat?.tipo === "grupo") {
      setGrupos((prev) => prev.map((g) => g.id === activeChat!.id ? { ...g, mensagens: updater(g.mensagens) } : g));
    }
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

  // ── Chat header ───────────────────────────────────────────────────

  function renderChatHeader(name: string, subtitle: string, avatarEl: ReactNode) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          onClick={() => openChat(null)}
          className="lg:hidden text-gray-400 hover:text-vine-600 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Clickable name/avatar → info panel */}
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
              chatSearchOpen ? "bg-vine-100 text-vine-700" : "text-gray-400 hover:text-vine-600 hover:bg-gray-100")}
            title="Pesquisar na conversa"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => showToast("Chamada de voz: disponivel em breve")}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-vine-600 hover:bg-gray-100 transition"
            title="Ligar"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={() => showToast("Chamada de video: disponivel em breve")}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-vine-600 hover:bg-gray-100 transition"
            title="Video chamada"
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            onClick={() => setInfoOpen((v) => !v)}
            className={clsx("w-8 h-8 rounded-full flex items-center justify-center transition",
              infoOpen ? "bg-vine-100 text-vine-700" : "text-gray-400 hover:text-vine-600 hover:bg-gray-100")}
            title="Informacoes"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Chat panel ────────────────────────────────────────────────────

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
        <div className="w-9 h-9 rounded-full bg-vine-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
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
      <div className="flex flex-1 h-full min-w-0">
        {/* Chat column */}
        <div className="flex flex-col flex-1 h-full min-w-0">
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
            <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-100 bg-vine-50 shrink-0">
              <div className="w-0.5 h-9 rounded-full bg-vine-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-vine-700">{replyTo.autorNome}</p>
                <p className="text-xs text-gray-500 truncate">{replyTo.conteudo}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <ComposeBar
            onSend={(t) => activeChat.tipo === "direto" ? sendDm(activeChat.id, t) : sendGrupo(activeChat.id, t)}
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

  // ── Left list ─────────────────────────────────────────────────────

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
                tab === id ? "border-vine-600 text-vine-700" : "border-transparent text-gray-400 hover:text-vine-600"
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
            className="w-9 h-9 rounded-full bg-vine-700 text-white flex items-center justify-center shrink-0 hover:bg-vine-800 active:scale-95 transition"
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
                  <button onClick={() => setShowNewDmModal(true)} className="text-xs text-vine-600 font-semibold mt-1 hover:underline">Iniciar conversa</button>
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
                    className={clsx("relative group w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 transition cursor-pointer select-none", isActive ? "bg-vine-50" : "hover:bg-gray-50")}
                    onClick={() => openChat({ tipo: "direto", id: dm.id })}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-vine-700 text-white flex items-center justify-center text-sm font-bold">
                        {iniciais(other.nome)}
                      </div>
                      {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={clsx("text-sm truncate", unread > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700")}>
                          {other.nome.split(" ")[0]}{" "}<span className="font-normal text-gray-400">{other.nome.split(" ").slice(1).join(" ")}</span>
                        </span>
                        {last && <span className="text-[10px] text-gray-400 shrink-0">{formatDay(last.criadoEm)}</span>}
                      </div>
                      {last && (
                        <p className={clsx("text-xs truncate mt-0.5", unread > 0 ? "text-gray-700 font-medium" : "text-gray-400")}>
                          {last.autorId === u.id ? "Voce: " : ""}{last.conteudo}
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
                  <button onClick={() => setShowNewGroupModal(true)} className="text-xs text-vine-600 font-semibold mt-1 hover:underline">Criar grupo</button>
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
                        className={clsx("relative group w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition cursor-pointer select-none", isActive ? "bg-vine-50" : "hover:bg-gray-50")}
                        onClick={() => openChat({ tipo: "grupo", id: g.id })}
                      >
                        <div className="relative shrink-0">
                          <GrupoAvatar grupo={g} size="sm" />
                          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={clsx("text-sm truncate", unread > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700")}>{g.nome}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {g.somenteAdmin && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                              {last && <span className="text-[10px] text-gray-400">{formatDay(last.criadoEm)}</span>}
                            </div>
                          </div>
                          {last ? (
                            <p className={clsx("text-xs truncate mt-0.5", unread > 0 ? "text-gray-700 font-medium" : "text-gray-400")}>
                              {last.autorId === u.id ? "Voce: " : last.autorNome.split(" ")[0] + ": "}{last.conteudo}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-300 mt-0.5 italic">{g.descricao}</p>
                          )}
                        </div>
                        {/* Context menu — apenas grupos nao institucionais */}
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

  // ─── Layout ───────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">
      {toast && <Toast msg={toast} />}
      {showNewDmModal && <NewDmModal currentUserId={u.id} dms={dms} usuarios={usuarios} onStart={startDm} onClose={() => setShowNewDmModal(false)} />}
      {showNewGroupModal && <NewGroupModal currentUserId={u.id} usuarios={usuarios} onClose={() => setShowNewGroupModal(false)} onCreate={createGroup} />}
      <div className="mb-4">
        <h1 className="text-2xl font-sans font-semibold text-vine-950">Mensagens</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conversas diretas, chat do culto e canais de ministério.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden" style={{ height: "calc(100vh - 200px)", minHeight: 520 }}>
        <div className="flex h-full">
          {/* Left list */}
          <div className={clsx("flex flex-col border-r border-gray-100 shrink-0 w-full lg:w-80", activeChat !== null ? "hidden lg:flex" : "flex")}>
            {renderList()}
          </div>

          {/* Right chat area */}
          <div className={clsx("flex-1 flex min-w-0", activeChat === null ? "hidden lg:flex" : "flex")}>
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