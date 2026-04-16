"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  mockConversasDiretas,
  mockChatsCulto,
  mockCanais,
  mockUsers,
} from "@/lib/mockData";
import { ConversaDireta, ChatCulto, MensagemConversa, Ministerio } from "@/types";
import {
  MessageSquare,
  Users,
  Church,
  Send,
  ArrowLeft,
  Search,
  ExternalLink,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

// ─── helpers ──────────────────────────────────────────────────────────────────

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
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

type ChatTab = "direto" | "culto" | "ministerio";

type ActiveChat =
  | { tipo: "direto"; id: string }
  | { tipo: "culto"; id: string }
  | null;

const MIN_EMOJI: Record<string, string> = {
  Louvor: "🎸",
  "Mídias": "📹",
  Cantina: "🧹",
  Infantil: "🧒",
  "Ação Social": "🤝",
  Jovens: "⚡",
  Ensino: "📖",
};

const MIN_COR: Record<string, string> = {
  Louvor: "bg-grape-700",
  "Mídias": "bg-vine-700",
  Cantina: "bg-bark-600",
  Infantil: "bg-gold-500",
  "Ação Social": "bg-green-600",
  Jovens: "bg-blue-600",
  Ensino: "bg-purple-700",
};

// ─── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMe,
  showAuthor,
}: {
  msg: MensagemConversa;
  isMe: boolean;
  showAuthor: boolean;
}) {
  return (
    <div className={clsx("flex gap-2 max-w-[80%]", isMe ? "ml-auto flex-row-reverse" : "")}>
      {/* Avatar */}
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
        <div
          className={clsx(
            "px-3.5 py-2 rounded-2xl text-sm leading-relaxed max-w-full break-words",
            isMe
              ? "bg-vine-700 text-white rounded-br-sm"
              : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm"
          )}
        >
          {msg.conteudo}
        </div>
        <span className="text-[10px] text-gray-400 mt-0.5 px-1">{formatTime(msg.criadoEm)}</span>
      </div>
    </div>
  );
}

// ─── ConversationMessages ──────────────────────────────────────────────────────

function ConversationMessages({
  messages,
  myId,
  isGroup,
}: {
  messages: MensagemConversa[];
  myId: string;
  isGroup: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Group messages by day
  const groups: { date: string; msgs: MensagemConversa[] }[] = [];
  for (const msg of messages) {
    const day = msg.criadoEm.slice(0, 10);
    const last = groups[groups.length - 1];
    if (!last || last.date !== day) groups.push({ date: day, msgs: [msg] });
    else last.msgs.push(msg);
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50">
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
                />
              );
            })}
          </div>
        </div>
      ))}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 pt-12">
          <MessageSquare className="w-10 h-10 opacity-40" />
          <p className="text-sm">Nenhuma mensagem ainda. Diga olá!</p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── ComposeBar ───────────────────────────────────────────────────────────────

function ComposeBar({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");

  function handleSend() {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <div className="border-t border-gray-100 bg-white px-3 py-3 flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Digite uma mensagem…"
        rows={1}
        className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-vine-300 focus:border-vine-400 leading-relaxed max-h-32 overflow-y-auto"
      />
      <button
        onClick={handleSend}
        disabled={!text.trim()}
        className="w-10 h-10 rounded-full bg-vine-700 text-white flex items-center justify-center shrink-0 hover:bg-vine-800 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ChatTab>("direto");
  const [activeChat, setActiveChat] = useState<ActiveChat>(null);
  const [search, setSearch] = useState("");

  // Local copies so we can append messages in the session
  const [dms, setDms] = useState<ConversaDireta[]>(mockConversasDiretas);
  const [cultos, setCultos] = useState<ChatCulto[]>(mockChatsCulto);

  if (!user) return null;
  // TypeScript can't narrow `user` through nested functions — alias it
  const u = user;

  function otherParticipant(dm: ConversaDireta) {
    const otherId = dm.participantes.find((p) => p !== u.id) ?? dm.participantes[1];
    const otherName = dm.participantesNomes[dm.participantes.indexOf(otherId as "0" | "1")];
    return { id: otherId, nome: otherName };
  }

  function sendDm(dmId: string, text: string) {
    const now = new Date().toISOString();
    const msg: MensagemConversa = {
      id: `dm_${Date.now()}`,
      autorId: u.id,
      autorNome: u.nome,
      conteudo: text,
      criadoEm: now,
      lida: true,
    };
    setDms((prev) =>
      prev.map((dm) =>
        dm.id === dmId ? { ...dm, mensagens: [...dm.mensagens, msg] } : dm
      )
    );
  }

  function sendCulto(cultoId: string, text: string) {
    const now = new Date().toISOString();
    const msg: MensagemConversa = {
      id: `cc_${Date.now()}`,
      autorId: u.id,
      autorNome: u.nome,
      conteudo: text,
      criadoEm: now,
      lida: true,
    };
    setCultos((prev) =>
      prev.map((c) =>
        c.id === cultoId ? { ...c, mensagens: [...c.mensagens, msg] } : c
      )
    );
  }

  // ── Active chat data ──────────────────────────────────────────────────────

  const activeDm = activeChat?.tipo === "direto" ? dms.find((d) => d.id === activeChat.id) : null;
  const activeCulto = activeChat?.tipo === "culto" ? cultos.find((c) => c.id === activeChat.id) : null;

  // ── filtered lists ────────────────────────────────────────────────────────

  const myDms = dms.filter((dm) => dm.participantes.includes(u.id));

  const filteredDms = myDms.filter((dm) => {
    if (!search) return true;
    const other = otherParticipant(dm);
    return other.nome.toLowerCase().includes(search.toLowerCase());
  });

  const filteredCultos = cultos.filter((c) => {
    if (!search) return true;
    return c.titulo.toLowerCase().includes(search.toLowerCase());
  });

  const ministeriosDoUser = u.ministerios ?? [];

  // ── Unread counts ─────────────────────────────────────────────────────────

  function dmUnread(dm: ConversaDireta) {
    return dm.mensagens.filter(
      (m) => m.autorId !== u.id && !m.lida
    ).length;
  }

  function cultoUnread(c: ChatCulto) {
    return c.mensagens.filter((m) => m.autorId !== u.id && !m.lida).length;
  }

  // ── Rendered chat panel ───────────────────────────────────────────────────

  function renderChatPanel() {
    if (!activeChat) return null;

    if (activeChat.tipo === "direto" && activeDm) {
      const other = otherParticipant(activeDm);
      const otherUser = mockUsers.find((mu) => mu.id === other.id);
      return (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
            <button
              onClick={() => setActiveChat(null)}
              className="lg:hidden text-gray-400 hover:text-vine-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-vine-700 text-white flex items-center justify-center text-sm font-bold">
              {iniciais(other.nome)}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{other.nome}</p>
              <p className="text-[11px] text-gray-400 capitalize">{otherUser?.role ?? "membro"}</p>
            </div>
          </div>

          <ConversationMessages
            messages={activeDm.mensagens}
            myId={u.id}
            isGroup={false}
          />
          <ComposeBar onSend={(t) => sendDm(activeDm.id, t)} />
        </div>
      );
    }

    if (activeChat.tipo === "culto" && activeCulto) {
      return (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
            <button
              onClick={() => setActiveChat(null)}
              className="lg:hidden text-gray-400 hover:text-vine-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-vine-600 text-white flex items-center justify-center shrink-0">
              <Church className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{activeCulto.titulo}</p>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {new Date(activeCulto.data + "T00:00:00").toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
                {" · "}
                {activeCulto.horario}
              </p>
            </div>
          </div>

          <ConversationMessages
            messages={activeCulto.mensagens}
            myId={u.id}
            isGroup
          />
          <ComposeBar onSend={(t) => sendCulto(activeCulto.id, t)} />
        </div>
      );
    }

    return null;
  }

  // ── Left sidebar list ─────────────────────────────────────────────────────

  function renderList() {
    return (
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-white shrink-0">
          {(
            [
              { id: "direto" as ChatTab, label: "Direto", icon: MessageSquare },
              { id: "culto" as ChatTab, label: "Culto", icon: Church },
              { id: "ministerio" as ChatTab, label: "Ministério", icon: Users },
            ] as { id: ChatTab; label: string; icon: React.ElementType }[]
          ).map(({ id, label, icon: Icon }) => {
            // Unread bubbles per tab
            const unread =
              id === "direto"
                ? myDms.reduce((s, dm) => s + dmUnread(dm), 0)
                : id === "culto"
                ? cultos.reduce((s, c) => s + cultoUnread(c), 0)
                : 0;
            return (
              <button
                key={id}
                onClick={() => { setTab(id); setActiveChat(null); }}
                className={clsx(
                  "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold border-b-2 transition relative",
                  tab === id
                    ? "border-vine-600 text-vine-700"
                    : "border-transparent text-gray-400 hover:text-vine-600"
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
            );
          })}
        </div>

        {/* Search */}
        {tab !== "ministerio" && (
          <div className="px-3 py-2.5 border-b border-gray-50 bg-white shrink-0">
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="bg-transparent text-sm outline-none flex-1 placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {/* List items */}
        <div className="flex-1 overflow-y-auto">
          {tab === "direto" && (
            <>
              {filteredDms.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">Nenhuma conversa encontrada.</div>
              )}
              {filteredDms.map((dm) => {
                const other = otherParticipant(dm);
                const last = dm.mensagens[dm.mensagens.length - 1];
                const unread = dmUnread(dm);
                const isActive = activeChat?.tipo === "direto" && activeChat.id === dm.id;
                return (
                  <button
                    key={dm.id}
                    onClick={() => setActiveChat({ tipo: "direto", id: dm.id })}
                    className={clsx(
                      "w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 transition text-left",
                      isActive ? "bg-vine-50" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-vine-700 text-white flex items-center justify-center text-sm font-bold">
                        {iniciais(other.nome)}
                      </div>
                      {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={clsx("text-sm truncate", unread > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700")}>
                          {other.nome.split(" ")[0]}{" "}
                          <span className="font-normal text-gray-400">{other.nome.split(" ").slice(1).join(" ")}</span>
                        </span>
                        {last && (
                          <span className="text-[10px] text-gray-400 shrink-0">{formatDay(last.criadoEm)}</span>
                        )}
                      </div>
                      {last && (
                        <p className={clsx("text-xs truncate mt-0.5", unread > 0 ? "text-gray-700 font-medium" : "text-gray-400")}>
                          {last.autorId === u.id ? "Você: " : ""}{last.conteudo}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {tab === "culto" && (
            <>
              {filteredCultos.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">Nenhum culto encontrado.</div>
              )}
              {filteredCultos.map((c) => {
                const last = c.mensagens[c.mensagens.length - 1];
                const unread = cultoUnread(c);
                const isActive = activeChat?.tipo === "culto" && activeChat.id === c.id;
                const isPast = c.data < new Date().toISOString().slice(0, 10);
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveChat({ tipo: "culto", id: c.id })}
                    className={clsx(
                      "w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 transition text-left",
                      isActive ? "bg-vine-50" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white text-base", isPast ? "bg-gray-400" : "bg-vine-700")}>
                        <Church className="w-5 h-5" />
                      </div>
                      {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={clsx("text-sm font-semibold truncate", unread > 0 ? "text-gray-900 font-bold" : "text-gray-700")}>
                          {c.titulo}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">{c.horario}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <CalendarDays className="w-2.5 h-2.5" />
                          {new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                        {last && (
                          <span className={clsx("text-xs truncate", unread > 0 ? "text-gray-700 font-medium" : "text-gray-400")}>
                            · {last.autorId === u.id ? "Você: " : last.autorNome.split(" ")[0] + ": "}{last.conteudo}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {tab === "ministerio" && (
            <div className="p-4 space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-3">
                Seus ministérios
              </p>
              {ministeriosDoUser.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  Você não está em nenhum ministério.
                </p>
              )}
              {ministeriosDoUser.map((m) => {
                const canal = mockCanais.find((c) => c.ministerio === m);
                return (
                  <Link
                    key={m}
                    href={`/dashboard/ministerio/${encodeURIComponent(m)}`}
                    className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:border-vine-300 hover:shadow-sm transition group"
                  >
                    <div
                      className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-lg text-white shrink-0",
                        MIN_COR[m] ?? "bg-vine-700"
                      )}
                    >
                      {MIN_EMOJI[m] ?? "📋"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 group-hover:text-vine-700 transition">{m}</p>
                      {canal && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{canal.descricao}</p>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-vine-500 transition shrink-0" />
                  </Link>
                );
              })}

              {/* Outros ministérios */}
              {mockCanais.filter((c) => !ministeriosDoUser.includes(c.ministerio)).length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1 mt-5 mb-3">
                    Outros canais
                  </p>
                  {mockCanais
                    .filter((c) => !ministeriosDoUser.includes(c.ministerio))
                    .map((canal) => (
                      <Link
                        key={canal.ministerio}
                        href={`/dashboard/ministerio/${encodeURIComponent(canal.ministerio)}`}
                        className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 hover:border-vine-300 hover:shadow-sm transition group opacity-70 hover:opacity-100"
                      >
                        <div
                          className={clsx(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-base text-white shrink-0",
                            MIN_COR[canal.ministerio] ?? "bg-vine-700"
                          )}
                        >
                          {MIN_EMOJI[canal.ministerio] ?? "📋"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-700">{canal.ministerio}</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-vine-500 transition shrink-0" />
                      </Link>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

  const showList = activeChat === null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-serif font-semibold text-vine-950">Mensagens</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conversas diretas, chat do culto e canais de ministério.
        </p>
      </div>

      {/* Split panel */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden" style={{ height: "calc(100vh - 200px)", minHeight: 520 }}>
        <div className="flex h-full">
          {/* Left: conversation list */}
          <div
            className={clsx(
              "flex flex-col border-r border-gray-100 shrink-0",
              "w-full lg:w-80",
              // On mobile: hide list when a chat is open
              activeChat !== null ? "hidden lg:flex" : "flex"
            )}
          >
            {renderList()}
          </div>

          {/* Right: chat area */}
          <div
            className={clsx(
              "flex-1 flex flex-col",
              activeChat === null ? "hidden lg:flex" : "flex"
            )}
          >
            {activeChat ? (
              renderChatPanel()
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
                <MessageSquare className="w-12 h-12 opacity-30" />
                <p className="text-base font-medium">Selecione uma conversa</p>
                <p className="text-xs text-gray-400 max-w-[200px] text-center">
                  Escolha uma das conversas à esquerda para começar
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
