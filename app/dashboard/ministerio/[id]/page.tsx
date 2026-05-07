"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare, Users, CalendarDays, Send, Lock, Unlock,
  Plus, Trash2, Pencil, X, Check, Calendar, ExternalLink,
  Pin, ChevronDown, ShieldCheck, ChevronUp,
  Star, Mic, Square, Image as ImageIcon, Grid3x3, Link2,
  Phone, Video as VideoIcon, MoreVertical, PhoneOff,
  Music2, ChevronUp as ArrowUp, ChevronDown as ArrowDown, Save, Eye, EyeOff, UserCheck,
  Reply,
} from "lucide-react";
import clsx from "clsx";
import { Local, Ministerio, MuralMensagem, MembroMinisterio, Evento, FuncaoMinisterio, Escala, EscalaMusica, Musica, FuncaoEscala, ItemEscala } from "@/types";
import { supabase } from "@/lib/supabase";
import { downloadICS, linkGoogleCalendar, formatarData, diaSemana } from "@/lib/calendarUtils";

type Tab = "chat" | "membros" | "eventos" | "escalas";

const corMap: Record<string, string> = {
  grape: "bg-grape-800",
  vine:  "bg-vine-800",
  bark:  "bg-bark-700",
  gold:  "bg-gold-500",
};

export default function CanalMinisterioPage() {
  const params = useParams();
  const slug = decodeURIComponent(params.id as string) as Ministerio;
  const { user, temPermissao } = useAuth();

  // ── estado global ─────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("chat");
  const [canalBase, setCanalBase] = useState<{ ministerio: string; descricao: string; chatBloqueado: boolean; cor: string } | null>(null);
  const [chatBloqueado, setChatBloqueado] = useState(false);
  const [chamada, setChamada] = useState<"audio" | "video" | null>(null);

  useEffect(() => {
    supabase.from("canais_ministerio").select().eq("ministerio", slug).limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        setCanalBase({ ministerio: data[0].ministerio, descricao: data[0].descricao ?? "", chatBloqueado: data[0].chat_bloqueado, cor: data[0].cor });
        setChatBloqueado(data[0].chat_bloqueado);
      } else {
        // Fallback: canal existe no enum mas não na tabela ainda
        setCanalBase({ ministerio: slug, descricao: "", chatBloqueado: false, cor: "vine" });
      }
    });
  }, [slug]);

  // ── permissão ─────────────────────────────────────────────────────
  const podeBloquearChat    = temPermissao("bloquear_chat");
  const podeGerenciarMembros = temPermissao("gerenciar_membros_ministerio");
  const podeCriarEvento     = temPermissao("criar_evento");
  const podeEditarEvento    = temPermissao("editar_evento");  const podeAtribuirPermissoes = temPermissao("atribuir_permissoes");

  if (!canalBase) {
    return (
      <div className="flex items-center justify-center h-60 text-gray-400">
        Carregando canal...
      </div>
    );
  }

  const corBg = corMap[canalBase.cor] ?? "bg-vine-800";

  return (
    <div className="space-y-0">
      {/* Header do canal */}
      <div className={clsx("rounded-2xl px-6 py-5 mb-6 text-white", corBg)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-60 mb-0.5">Canal</p>
            <h1 className="text-2xl font-sans font-semibold">{slug}</h1>
            <p className="text-sm opacity-70 mt-1">{canalBase.descricao}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Chamadas */}
            <button
              onClick={() => setChamada("audio")}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full border border-white/30 text-white/80 hover:bg-white/10 transition"
              title="Chamada de áudio em grupo"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChamada("video")}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full border border-white/30 text-white/80 hover:bg-white/10 transition"
              title="Chamada de vídeo em grupo"
            >
              <VideoIcon className="w-4 h-4" />
            </button>
            {tab === "chat" && (
              <button
                onClick={() => podeBloquearChat && setChatBloqueado(!chatBloqueado)}
                disabled={!podeBloquearChat}
                className={clsx(
                  "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border transition",
                  !podeBloquearChat && "opacity-40 cursor-not-allowed",
                  chatBloqueado
                    ? "border-white/40 text-white bg-white/20 hover:bg-white/30"
                    : "border-white/30 text-white/80 hover:bg-white/10"
                )}
              >
                {chatBloqueado ? (<><Lock className="w-4 h-4" /> Chat bloqueado</>) : (<><Unlock className="w-4 h-4" /> Chat livre</>)}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-5 border-t border-white/20 pt-4">
          {([
            { id: "chat",    label: "Chat",    icon: MessageSquare },
            { id: "membros", label: "Membros", icon: Users         },
            { id: "eventos", label: "Eventos", icon: CalendarDays  },
            { id: "escalas", label: "Escalas", icon: Music2        },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition",
                tab === id
                  ? "bg-white text-gray-900"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo da tab */}
      {tab === "chat"    && <ChatTab ministerio={slug} chatBloqueado={chatBloqueado} podeEnviar={temPermissao("enviar_chat")} podeFixar={temPermissao("fixar_mensagem")} user={user} />}
      {tab === "membros" && <MembrosTab ministerio={slug} isLider={podeGerenciarMembros} podeAtribuirPermissoes={podeAtribuirPermissoes} />}
      {tab === "eventos" && <EventosTab ministerio={slug} isLider={podeCriarEvento} podeEditar={podeEditarEvento} />}
      {tab === "escalas" && <EscalasLouvorTab ministerio={slug} isLider={temPermissao("criar_escala")} />}

      {/* Modal de chamada */}
      {chamada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={clsx("rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl text-white w-80", corBg)}>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              {chamada === "audio" ? <Phone className="w-7 h-7" /> : <VideoIcon className="w-7 h-7" />}
            </div>
            <div className="text-center">
              <p className="font-sans text-xl font-semibold">{slug}</p>
              <p className="text-white/70 text-sm mt-1">
                {chamada === "audio" ? "Chamada de áudio em grupo" : "Chamada de vídeo em grupo"}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-white/80">Conectando membros do canal…</span>
            </div>
            <p className="text-xs text-white/50 text-center">
              Funcionalidade de chamada em grupo disponível com integração WebRTC / servidor de sinalização.
            </p>
            <button
              onClick={() => setChamada(null)}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-full transition"
            >
              <PhoneOff className="w-4 h-4" /> Encerrar chamada
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: CHAT ────────────────────────────────────────────────────────────────

type InfoPanel = "midia" | "links" | "favoritos" | null;

function detectarLinks(texto: string): string[] {
  return Array.from(texto.matchAll(/https?:\/\/[^\s]+/g)).map((m) => m[0]);
}

function renderTextoComLinks(texto: string, isMe: boolean) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const parts = texto.split(urlRegex);
  const urls = texto.match(urlRegex) ?? [];
  return parts.flatMap((part, i) => [
    part,
    urls[i] ? (
      <a
        key={`link-${i}`}
        href={urls[i]}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx("underline break-all", isMe ? "text-white/80 hover:text-white" : "text-vine-600 hover:text-vine-800")}
      >
        {urls[i]}
      </a>
    ) : null,
  ]);
}

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "🙏"];

function ChatTab({
  ministerio, chatBloqueado, podeEnviar: podeEnviarProp, podeFixar, user,
}: {
  ministerio: Ministerio;
  chatBloqueado: boolean;
  podeEnviar: boolean;
  podeFixar: boolean;
  user: { id?: string; nome: string; role: string } | null;
}) {
  const [msgs, setMsgs] = useState<MuralMensagem[]>([]);

  useEffect(() => {
    supabase
      .from("mural_mensagens")
      .select()
      .eq("ministerio", ministerio)
      .order("criado_em", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          setMsgs(
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
  }, [ministerio]);
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

  // Image
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);

  // Favorites & menu
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [emojiMenuId, setEmojiMenuId] = useState<string | null>(null);

  // Right info panel
  const [infoPanel, setInfoPanel] = useState<InfoPanel>(null);

  // Edit / Reply / Reactions
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [respostaA, setRespostaA] = useState<{ id: string; autorNome: string; conteudo: string } | null>(null);
  const [myReacoes, setMyReacoes] = useState<Set<string>>(new Set());

  const podeEnviar = (podeEnviarProp && !chatBloqueado) || podeFixar;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Computed
  const fixadas = msgs.filter((m) => m.fixada);
  const midiaMsgs = msgs.filter((m) => m.tipo === "imagem" && m.mediaUrl);
  const linksMsgs: { url: string; autorNome: string; criadoEm: string }[] = msgs.flatMap((m) =>
    detectarLinks(m.conteudo).map((url) => ({ url, autorNome: m.autorNome, criadoEm: m.criadoEm }))
  );
  const favoritosMsgs = msgs.filter((m) => favoritos.includes(m.id));

  function enviar(tipo: MuralMensagem["tipo"] = "texto", mediaUrl?: string) {
    if (!user) return;
    if (tipo === "texto" && !texto.trim()) return;
    const conteudo = tipo === "texto" ? texto.trim() : tipo === "imagem" ? "📷 Imagem" : "🎙️ Áudio";
    supabase
      .from("mural_mensagens")
      .insert({
        ministerio, autor_id: user.id, autor_nome: user.nome,
        autor_role: user.role, conteudo, tipo, media_url: mediaUrl ?? null,
        fixada: false, resposta_a: respostaA ?? null,
      })
      .select().single()
      .then(({ data }) => {
        if (data) {
          setMsgs((prev) => [...prev, {
            id: data.id, ministerio: data.ministerio, autorId: data.autor_id,
            autorNome: data.autor_nome, autorRole: data.autor_role,
            conteudo: data.conteudo, criadoEm: data.criado_em,
            fixada: data.fixada, tipo: data.tipo, mediaUrl: data.media_url,
            reacoes: [], respostaA: data.resposta_a,
          }]);
        }
      });
    setTexto("");
    setImagemPreview(null);
    setAudioUrl(null);
    setRespostaA(null);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagemPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setGravando(true);
      setTempoGravacao(0);
      timerRef.current = setInterval(() => setTempoGravacao((t) => t + 1), 1000);
    } catch { alert("Permissão de microfone negada."); }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setGravando(false);
  }

  function toggleFavorito(id: string) {
    setFavoritos((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setMenuId(null);
  }

  function toggleFixar(id: string) {
    setMsgs((prev) => prev.map((m) => m.id === id ? { ...m, fixada: !m.fixada } : m));
    setMenuId(null);
  }

  function toggleReacao(msgId: string, emoji: string) {
    const key = `${msgId}_${emoji}`;
    const already = myReacoes.has(key);
    setMyReacoes((prev) => { const next = new Set(prev); already ? next.delete(key) : next.add(key); return next; });
    setMsgs((prev) => prev.map((m) => {
      if (m.id !== msgId) return m;
      const reacoes = m.reacoes ?? [];
      if (already) return { ...m, reacoes: reacoes.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1 } : r).filter((r) => r.count > 0) };
      const ex = reacoes.find((r) => r.emoji === emoji);
      return { ...m, reacoes: ex ? reacoes.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1 } : r) : [...reacoes, { emoji, count: 1 }] };
    }));
    setMenuId(null);
  }

  function salvarEdicao(msgId: string) {
    if (!editTexto.trim()) return;
    setMsgs((prev) => prev.map((m) => m.id === msgId ? { ...m, conteudo: editTexto.trim(), editadoEm: new Date().toISOString() } : m));
    setEditandoId(null);
    setEditTexto("");
  }

  const temMidia = !!imagemPreview || !!audioUrl;

  return (
    <div className="flex gap-4 h-[calc(100vh-300px)] min-h-[400px]">
      {/* ── Área principal do chat ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mensagem fixada */}
        {fixadas.length > 0 && (
          <div className="mb-3 bg-gold-50 border border-gold-200 rounded-xl px-4 py-2 flex items-start gap-2">
            <Pin className="w-3.5 h-3.5 text-gold-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gold-700 mb-0.5">Fixada</p>
              <p className="text-xs text-gold-800 line-clamp-1">{fixadas[0].conteudo}</p>
              <p className="text-[10px] text-gold-500 mt-0.5">— {fixadas[0].autorNome}</p>
            </div>
          </div>
        )}

        {chatBloqueado && !podeEnviar && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-amber-700 text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>Chat bloqueado. Apenas líderes podem enviar mensagens.</span>
          </div>
        )}

        {/* Atalhos Mídia / Links / Favoritos */}
        <div className="flex gap-1.5 mb-2">
          {([
            { id: "midia" as InfoPanel,     label: `Mídia (${midiaMsgs.length})`,    icon: Grid3x3 },
            { id: "links" as InfoPanel,     label: `Links (${linksMsgs.length})`,    icon: Link2   },
            { id: "favoritos" as InfoPanel, label: `Favoritos (${favoritosMsgs.length})`, icon: Star },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setInfoPanel(infoPanel === id ? null : id)}
              className={clsx(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition",
                infoPanel === id
                  ? "bg-vine-700 text-white border-vine-700"
                  : "bg-white text-gray-500 border-gray-200 hover:border-vine-300 hover:text-vine-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Lista de mensagens */}
        <div
          className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100"
          onClick={() => { setMenuId(null); setEmojiMenuId(null); }}
        >
          {msgs.filter((m) => !m.fixada).map((m) => {
            const isMe = m.autorId === "me" || user?.nome === m.autorNome;
            const isFav = favoritos.includes(m.id);
            return (
              <div
                key={m.id}
                className={clsx("flex group", isMe ? "justify-end" : "justify-start")}
              >
                <div className="relative">
                  {/* Action buttons: MoreVertical + Emoji reaction */}
                  <div className={clsx(
                    "absolute top-2 z-10 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition",
                    isMe ? "-left-7" : "-right-7"
                  )}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuId(menuId === m.id ? null : m.id); setEmojiMenuId(null); }}
                      className="p-0.5 rounded-full bg-white/90 text-gray-400 hover:text-gray-700 shadow border border-gray-100 transition"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>
                    <div className="relative">
                      {emojiMenuId === m.id && <div className="fixed inset-0 z-20" onClick={() => setEmojiMenuId(null)} />}
                      {emojiMenuId === m.id && (
                        <div className={clsx(
                          "absolute bottom-full mb-1 z-30 bg-white border border-gray-200 rounded-full shadow-lg px-1.5 py-1 flex gap-0.5",
                          isMe ? "right-0" : "left-0"
                        )}>
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => { toggleReacao(m.id, emoji); setEmojiMenuId(null); }}
                              className={clsx(
                                "text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition",
                                myReacoes.has(`${m.id}_${emoji}`) && "bg-vine-50 ring-1 ring-vine-300"
                              )}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEmojiMenuId(emojiMenuId === m.id ? null : m.id); setMenuId(null); }}
                        className="p-0.5 rounded-full bg-white/90 text-[12px] shadow border border-gray-100 hover:border-vine-300 transition"
                        title="Reagir"
                      >
                        😊
                      </button>
                    </div>
                  </div>

                  {/* Context menu dropdown */}
                  {menuId === m.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                      <div className={clsx(
                        "absolute top-6 z-20 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden w-44",
                        isMe ? "right-0" : "left-0"
                      )}>
                        <button
                          onClick={() => { setRespostaA({ id: m.id, autorNome: m.autorNome, conteudo: m.conteudo }); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition text-left"
                        >
                          <Reply className="w-3.5 h-3.5 text-gray-400" /> Responder
                        </button>
                        {isMe && (!m.tipo || m.tipo === "texto") && (
                          <button
                            onClick={() => { setEditandoId(m.id); setEditTexto(m.conteudo); setMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition text-left border-t border-gray-50"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-400" /> Editar
                          </button>
                        )}
                        <button
                          onClick={() => toggleFavorito(m.id)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition text-left border-t border-gray-50"
                        >
                          <Star className={clsx("w-3.5 h-3.5", isFav ? "text-amber-400 fill-amber-400" : "text-gray-400")} />
                          {isFav ? "Remover favorito" : "Favoritar"}
                        </button>
                        {podeFixar && (
                          <button
                            onClick={() => toggleFixar(m.id)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition text-left border-t border-gray-50"
                          >
                            <Pin className="w-3.5 h-3.5 text-gray-400" />
                            {m.fixada ? "Desafixar" : "Fixar mensagem"}
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  <div className={clsx(
                    "max-w-[75%] min-w-[80px] rounded-2xl text-sm shadow-sm relative",
                    (!m.tipo || m.tipo === "texto")
                      ? clsx("px-4 py-2.5", isMe ? "bg-vine-700 text-white rounded-tr-sm" : "bg-white text-gray-800 rounded-tl-sm border border-gray-100")
                      : "overflow-hidden border border-gray-200 bg-white"
                  )}>
                    {/* Quoted reply */}
                    {m.respostaA && (
                      <div className={clsx(
                        "mb-1.5 rounded-lg px-2.5 py-1.5 border-l-2",
                        isMe ? "bg-vine-600/50 border-white/40" : "bg-gray-100 border-vine-400"
                      )}>
                        <p className={clsx("text-[10px] font-semibold", isMe ? "text-white/70" : "text-vine-600")}>{m.respostaA.autorNome}</p>
                        <p className={clsx("text-xs truncate", isMe ? "text-white/60" : "text-gray-500")}>{m.respostaA.conteudo}</p>
                      </div>
                    )}

                    {!isMe && (!m.tipo || m.tipo === "texto") && (
                      <p className={clsx("text-[10px] font-semibold mb-1",
                        m.autorRole === "lider" || m.autorRole === "pastor" ? "text-gold-500" : "text-vine-500"
                      )}>
                        {m.autorNome}
                      </p>
                    )}

                    {/* Conteúdo */}
                    {(!m.tipo || m.tipo === "texto") && (
                      editandoId === m.id ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={editTexto}
                            onChange={(e) => setEditTexto(e.target.value)}
                            rows={2}
                            className={clsx(
                              "w-full rounded-lg px-2 py-1 text-sm resize-none outline-none",
                              isMe ? "bg-vine-600 text-white placeholder-white/50 focus:bg-vine-500" : "bg-gray-100 text-gray-800 focus:bg-white border border-gray-200"
                            )}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); salvarEdicao(m.id); } if (e.key === "Escape") { setEditandoId(null); setEditTexto(""); } }}
                            autoFocus
                          />
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => { setEditandoId(null); setEditTexto(""); }} className={clsx("text-[10px] px-2 py-0.5 rounded-full", isMe ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-gray-600")}>Cancelar</button>
                            <button onClick={() => salvarEdicao(m.id)} className={clsx("text-[10px] px-2 py-0.5 rounded-full font-semibold", isMe ? "bg-white/20 text-white hover:bg-white/30" : "bg-vine-100 text-vine-700 hover:bg-vine-200")}>Salvar</button>
                          </div>
                        </div>
                      ) : (
                        <p className="leading-relaxed">{renderTextoComLinks(m.conteudo, isMe)}</p>
                      )
                    )}
                    {m.tipo === "imagem" && m.mediaUrl && (
                      <img src={m.mediaUrl} alt="imagem" className="max-w-[240px] max-h-[280px] object-cover" />
                    )}
                    {m.tipo === "audio" && m.mediaUrl && (
                      <div className="px-3 py-2">
                        <audio controls src={m.mediaUrl} className="h-9 w-52" />
                      </div>
                    )}

                    {/* Rodapé da mensagem */}
                    {(!m.tipo || m.tipo === "texto") && (
                      <div className={clsx("flex items-center gap-1.5 justify-end mt-1")}>
                        {isFav && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        {m.fixada && <Pin className="w-3 h-3 text-gold-500" />}
                        <p className={clsx("text-[10px]", isMe ? "text-white/50" : "text-gray-400")}>
                          {new Date(m.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    )}

                    {m.reacoes && m.reacoes.length > 0 && (
                      <div className="flex gap-1.5 px-2 pb-2 flex-wrap">
                        {m.reacoes.map((r) => (
                          <button key={r.emoji} onClick={() => toggleReacao(m.id, r.emoji)} className={clsx("text-xs rounded-full px-1.5 py-0.5 transition", myReacoes.has(`${m.id}_${r.emoji}`) ? "bg-vine-100 text-vine-700 font-semibold" : "bg-gray-100 hover:bg-vine-100")}>
                            {r.emoji} {r.count}
                          </button>
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

        {/* Preview de imagem */}
        {imagemPreview && !audioUrl && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <img src={imagemPreview} alt="preview" className="h-14 w-14 object-cover rounded-lg border border-gray-200" />
            <div className="flex-1 text-sm text-gray-600">Imagem pronta para enviar</div>
            <button onClick={() => setImagemPreview(null)} className="text-gray-400 hover:text-red-400"><X className="w-4 h-4" /></button>
            <button
              onClick={() => enviar("imagem", imagemPreview!)}
              className="bg-vine-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-vine-600 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Enviar
            </button>
          </div>
        )}

        {/* Preview de áudio */}
        {audioUrl && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <audio controls src={audioUrl} className="h-9 flex-1" />
            <button onClick={() => { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }} className="text-gray-400 hover:text-red-400"><X className="w-4 h-4" /></button>
            <button
              onClick={() => enviar("audio", audioUrl!)}
              className="bg-vine-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-vine-600 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Enviar
            </button>
          </div>
        )}

        {/* Gravando */}
        {gravando && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-700 font-medium flex-1">
              Gravando… {Math.floor(tempoGravacao / 60).toString().padStart(2, "0")}:{(tempoGravacao % 60).toString().padStart(2, "0")}
            </span>
            <button
              onClick={pararGravacao}
              className="flex items-center gap-1.5 bg-red-500 text-white text-sm font-semibold px-3 py-1.5 rounded-xl hover:bg-red-600"
            >
              <Square className="w-3.5 h-3.5 fill-white" /> Parar
            </button>
          </div>
        )}

        {/* Reply preview bar */}
        {respostaA && (
          <div className="mt-2 flex items-center gap-2 bg-vine-50 border border-vine-100 rounded-xl px-3 py-2">
            <div className="w-0.5 h-8 rounded-full bg-vine-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-vine-700">{respostaA.autorNome}</p>
              <p className="text-xs text-gray-500 truncate">{respostaA.conteudo}</p>
            </div>
            <button onClick={() => setRespostaA(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Compose bar */}
        {!temMidia && !gravando && (
          <div className="mt-3 flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), podeEnviar && enviar())}
              disabled={!podeEnviar}
              placeholder={podeEnviar ? "Mensagem…" : "Chat bloqueado para membros"}
              className={clsx(
                "flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition",
                podeEnviar
                  ? "border-gray-200 focus:border-vine-400 focus:ring-1 focus:ring-vine-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            />
            {podeEnviar && (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-vine-700 hover:border-vine-300 transition"
                  title="Enviar imagem"
                ><ImageIcon className="w-5 h-5" /></button>
                <button
                  onClick={iniciarGravacao}
                  className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-vine-700 hover:border-vine-300 transition"
                  title="Gravar áudio"
                ><Mic className="w-5 h-5" /></button>
              </>
            )}
            <button
              onClick={() => enviar()}
              disabled={!podeEnviar || !texto.trim()}
              className={clsx("p-2.5 rounded-xl transition",
                podeEnviar && texto.trim()
                  ? "bg-vine-700 text-white hover:bg-vine-600"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              )}
            ><Send className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {/* ── Painel lateral: Mídia / Links / Favoritos ── */}
      {infoPanel && (
        <div className="w-72 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">
              {infoPanel === "midia" && "Galeria de Mídia"}
              {infoPanel === "links" && "Links compartilhados"}
              {infoPanel === "favoritos" && "Mensagens favoritas"}
            </p>
            <button onClick={() => setInfoPanel(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* MÍDIA */}
            {infoPanel === "midia" && (
              midiaMsgs.length === 0
                ? <p className="text-xs text-gray-400 text-center mt-8">Nenhuma imagem enviada ainda.</p>
                : <div className="grid grid-cols-3 gap-1.5">
                    {midiaMsgs.map((m) => (
                      <a key={m.id} href={m.mediaUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={m.mediaUrl}
                          alt="mídia"
                          className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition"
                        />
                      </a>
                    ))}
                  </div>
            )}

            {/* LINKS */}
            {infoPanel === "links" && (
              linksMsgs.length === 0
                ? <p className="text-xs text-gray-400 text-center mt-8">Nenhum link compartilhado ainda.</p>
                : <div className="space-y-2">
                    {linksMsgs.map((l, i) => (
                      <a
                        key={i}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-100 hover:border-vine-200 hover:bg-vine-50 transition group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-vine-100 flex items-center justify-center shrink-0">
                          <ExternalLink className="w-3.5 h-3.5 text-vine-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-vine-700 group-hover:underline break-all line-clamp-2">{l.url}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">por {l.autorNome}</p>
                        </div>
                      </a>
                    ))}
                  </div>
            )}

            {/* FAVORITOS */}
            {infoPanel === "favoritos" && (
              favoritosMsgs.length === 0
                ? <p className="text-xs text-gray-400 text-center mt-8">Nenhuma mensagem favoritada ainda.</p>
                : <div className="space-y-2">
                    {favoritosMsgs.map((m) => (
                      <div key={m.id} className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <p className="text-xs font-semibold text-amber-700 mb-1">{m.autorNome}</p>
                        {(!m.tipo || m.tipo === "texto") && (
                          <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{m.conteudo}</p>
                        )}
                        {m.tipo === "imagem" && m.mediaUrl && (
                          <img src={m.mediaUrl} alt="" className="w-full rounded-lg object-cover max-h-32" />
                        )}
                        {m.tipo === "audio" && m.mediaUrl && (
                          <audio controls src={m.mediaUrl} className="w-full h-8" />
                        )}
                        <p className="text-[10px] text-amber-400 mt-1.5">
                          {new Date(m.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <button
                          onClick={() => toggleFavorito(m.id)}
                          className="flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-800 mt-1 transition"
                        >
                          <Star className="w-3 h-3 fill-amber-400" /> Remover favorito
                        </button>
                      </div>
                    ))}
                  </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: MEMBROS ─────────────────────────────────────────────────────────────

const funcoes: FuncaoMinisterio[] = ["Líder", "Sub-líder", "Membro", "Visitante"];

// Permissões que fazem sentido no contexto de um canal de ministério
const PERMISSOES_CANAL = [
  { key: "enviar_chat"                 as const, label: "Enviar no chat",         desc: "Pode enviar mensagens no chat deste canal" },
  { key: "fixar_mensagem"              as const, label: "Fixar mensagens",         desc: "Pode fixar mensagens importantes" },
  { key: "criar_evento"               as const, label: "Criar eventos",            desc: "Pode criar novos eventos para o ministério" },
  { key: "editar_evento"              as const, label: "Editar/remover eventos",   desc: "Pode editar e excluir eventos" },
  { key: "gerenciar_membros_ministerio" as const, label: "Gerenciar membros",     desc: "Pode adicionar, editar e remover membros" },
  { key: "bloquear_chat"              as const, label: "Bloquear chat",            desc: "Pode bloquear/desbloquear o chat do canal" },
];

function MembrosTab({
  ministerio, isLider, podeAtribuirPermissoes,
}: {
  ministerio: Ministerio;
  isLider: boolean;
  podeAtribuirPermissoes: boolean;
}) {
  const [membros, setMembros] = useState<MembroMinisterio[]>(
    mockMembrosMinisterio.filter((m) => m.ministerio === ministerio)
  );
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaFuncao, setNovaFuncao] = useState<FuncaoMinisterio>("Membro");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", funcao: "Membro" as FuncaoMinisterio });
  // Per-member canal permissions
  const [permissoesMembro, setPermissoesMembro] = useState<Record<string, string[]>>({});
  const [permExpandido, setPermExpandido] = useState<string | null>(null);

  function togglePermCanal(membroId: string, perm: string) {
    setPermissoesMembro((prev) => {
      const atual = prev[membroId] ?? [];
      const nova = atual.includes(perm)
        ? atual.filter((p) => p !== perm)
        : [...atual, perm];
      return { ...prev, [membroId]: nova };
    });
  }

  function permAtivaParaMembro(membroId: string, perm: string): boolean {
    return (permissoesMembro[membroId] ?? []).includes(perm);
  }

  function salvarEdicao(id: string) {
    setMembros((prev) => prev.map((m) => m.id === id ? { ...m, funcao: novaFuncao } : m));
    setEditandoId(null);
  }

  function remover(id: string) {
    setMembros((prev) => prev.filter((m) => m.id !== id));
  }

  function adicionar() {
    if (!form.nome || !form.email) return;
    const novo: MembroMinisterio = {
      id: `new-${Date.now()}`,
      nome: form.nome,
      email: form.email,
      telefone: form.telefone || undefined,
      funcao: form.funcao,
      ministerio,
      ativo: true,
      dataEntrada: new Date().toISOString().split("T")[0],
    };
    setMembros((prev) => [...prev, novo]);
    setForm({ nome: "", email: "", telefone: "", funcao: "Membro" });
    setShowForm(false);
  }

  const funcaoCor: Record<FuncaoMinisterio, string> = {
    "Líder":     "bg-gold-100 text-gold-800",
    "Sub-líder": "bg-vine-100 text-vine-800",
    "Membro":    "bg-gray-100 text-gray-700",
    "Visitante": "bg-amber-50 text-amber-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{membros.length} pessoa{membros.length !== 1 ? "s" : ""} neste ministério</p>
        {isLider && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-vine-700 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-vine-600 transition"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        )}
      </div>

      {/* Formulário de adição */}
      {showForm && (
        <div className="bg-vine-50 border border-vine-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-vine-800">Novo membro</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome completo *"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400"
            />
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="E-mail *"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400"
            />
            <input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="Telefone"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400"
            />
            <select
              value={form.funcao}
              onChange={(e) => setForm({ ...form, funcao: e.target.value as FuncaoMinisterio })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white"
            >
              {funcoes.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-1.5 rounded-xl hover:bg-gray-100 transition">Cancelar</button>
            <button onClick={adicionar} className="text-sm bg-vine-700 text-white px-4 py-1.5 rounded-xl hover:bg-vine-600 transition">
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Contato</th>
              <th className="text-left px-4 py-3">Função</th>
              {(isLider || podeAtribuirPermissoes) && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {membros.map((m) => (
              <>
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-vine-100 text-vine-800 rounded-full flex items-center justify-center font-bold text-xs">
                        {m.nome.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800">{m.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <span>{m.email}</span>
                    {m.telefone && <span className="block text-xs text-gray-400">{m.telefone}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editandoId === m.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={novaFuncao}
                          onChange={(e) => setNovaFuncao(e.target.value as FuncaoMinisterio)}
                          className="border border-vine-300 rounded-lg text-xs px-2 py-1 outline-none bg-white"
                          autoFocus
                        >
                          {funcoes.map((f) => <option key={f}>{f}</option>)}
                        </select>
                        <button onClick={() => salvarEdicao(m.id)} className="text-green-600 hover:text-green-700">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditandoId(null)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full", funcaoCor[m.funcao])}>
                        {m.funcao}
                      </span>
                    )}
                  </td>
                  {(isLider || podeAtribuirPermissoes) && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {podeAtribuirPermissoes && (
                          <button
                            onClick={() => setPermExpandido(permExpandido === m.id ? null : m.id)}
                            className={clsx(
                              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition",
                              permExpandido === m.id
                                ? "bg-vine-700 text-white border-vine-700"
                                : "text-vine-600 border-vine-200 hover:bg-vine-50"
                            )}
                            title="Gerenciar permissões deste membro no canal"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {permExpandido === m.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                        {isLider && (
                          <>
                            <button
                              onClick={() => { setEditandoId(m.id); setNovaFuncao(m.funcao); }}
                              className="text-gray-400 hover:text-vine-600 transition"
                              title="Editar função"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => remover(m.id)}
                              className="text-gray-400 hover:text-red-500 transition"
                              title="Remover do ministério"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {/* Painel de permissões do canal para este membro */}
                {permExpandido === m.id && (
                  <tr key={`${m.id}-perms`} className="bg-vine-50 border-b border-vine-100">
                    <td colSpan={isLider || podeAtribuirPermissoes ? 4 : 3} className="px-6 py-4">
                      <div>
                        <p className="text-xs font-semibold text-vine-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Permissões de {m.nome.split(" ")[0]} neste canal
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {PERMISSOES_CANAL.map((perm) => {
                            const ativa = permAtivaParaMembro(m.id, perm.key);
                            return (
                              <button
                                key={perm.key}
                                onClick={() => togglePermCanal(m.id, perm.key)}
                                className={clsx(
                                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition text-xs",
                                  ativa
                                    ? "bg-vine-100 border-vine-300 text-vine-800"
                                    : "bg-white border-gray-200 text-gray-500 hover:border-vine-200 hover:bg-vine-50"
                                )}
                              >
                                <div className={clsx(
                                  "w-4 h-4 rounded flex items-center justify-center shrink-0 border transition",
                                  ativa ? "bg-vine-700 border-vine-700 text-white" : "border-gray-300 bg-white"
                                )}>
                                  {ativa && <Check className="w-2.5 h-2.5" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold leading-tight">{perm.label}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{perm.desc}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-vine-500 mt-3">
                          Essas permissões valem apenas dentro deste canal e sobrescrevem as permissões globais do usuário.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {membros.length === 0 && (
              <tr>
                <td colSpan={(isLider || podeAtribuirPermissoes) ? 4 : 3} className="py-12 text-center text-gray-400 text-sm">
                  Nenhum membro neste ministério.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB: EVENTOS ─────────────────────────────────────────────────────────────

function EventosTab({ ministerio, isLider, podeEditar }: { ministerio: Ministerio; isLider: boolean; podeEditar: boolean }) {
  const [eventos, setEventos] = useState<Evento[]>(
    mockEventos.filter((e) => e.ministerio === ministerio || !e.ministerio)
      .filter((e) => e.ministerio === ministerio)
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Evento, "id" | "criadoPor">>({
    titulo: "", descricao: "", data: "", horario: "", local: "", publico: false, ministerio,
  });
  const [calendarMenu, setCalendarMenu] = useState<string | null>(null);
  const [locais, setLocais] = useState<Local[]>(mockLocais);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ramo_locais");
      if (raw) setLocais(JSON.parse(raw));
    } catch {}
  }, []);

  function criarEvento() {
    if (!form.titulo || !form.data || !form.horario || !form.local) return;
    const novo: Evento = { ...form, id: `ev-${Date.now()}`, criadoPor: "me", ministerio };
    setEventos((prev) => [...prev, novo]);
    setForm({ titulo: "", descricao: "", data: "", horario: "", local: "", publico: false, ministerio });
    setShowForm(false);
  }

  function removerEvento(id: string) {
    setEventos((prev) => prev.filter((e) => e.id !== id));
  }

  const hoje = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{eventos.length} evento{eventos.length !== 1 ? "s" : ""}</p>
        {isLider && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-gold-500 text-vine-950 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gold-400 transition"
          >
            <Plus className="w-4 h-4" /> Novo evento
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-gold-50 border border-gold-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-vine-800">Novo evento</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Título do evento *"
              className="col-span-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400"
            />
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 bg-white"
            />
            <input
              type="time"
              value={form.horario}
              onChange={(e) => setForm({ ...form, horario: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 bg-white"
            />
            <select
              value={form.local}
              onChange={(e) => setForm({ ...form, local: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 bg-white"
            >
              <option value="">Local *</option>
              {locais.map((l) => (
                <option key={l.id} value={l.nome}>{l.nome}</option>
              ))}
            </select>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descrição"
              rows={2}
              className="col-span-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 resize-none"
            />
            <label className="col-span-full flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.publico}
                onChange={(e) => setForm({ ...form, publico: e.target.checked })}
                className="accent-vine-700 w-4 h-4 rounded"
              />
              Visível na página pública
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-1.5 rounded-xl hover:bg-gray-100 transition">Cancelar</button>
            <button onClick={criarEvento} className="text-sm bg-gold-500 text-vine-950 font-semibold px-4 py-1.5 rounded-xl hover:bg-gold-400 transition">
              Criar evento
            </button>
          </div>
        </div>
      )}

      {/* Lista de eventos */}
      <div className="space-y-3">
        {eventos.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm bg-gray-50 rounded-2xl">
            Nenhum evento para este ministério.
          </div>
        )}
        {eventos.map((e) => {
          const passado = e.data < hoje;
          return (
            <div
              key={e.id}
              className={clsx(
                "bg-white rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition",
                passado ? "border-gray-100 opacity-60" : "border-gray-200 hover:border-gold-300 hover:shadow-sm"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Data visual */}
                <div className="shrink-0 w-12 text-center">
                  <p className="text-xs text-gray-400 uppercase">{diaSemana(e.data).slice(0, 3)}</p>
                  <p className="text-2xl font-sans font-bold text-vine-800 leading-none">{e.data.split("-")[2]}</p>
                  <p className="text-xs text-gray-400">{formatarData(e.data).split(" ").slice(1).join(" ")}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{e.titulo}</h3>
                  {e.descricao && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{e.descricao}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-400">
                    <span>🕐 {e.horario}</span>
                    <span>📍 {e.local}</span>
                    {e.publico && <span className="text-green-600 font-medium">• Público</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Botão calendário */}
                <div className="relative">
                  <button
                    onClick={() => setCalendarMenu(calendarMenu === e.id ? null : e.id)}
                    className="flex items-center gap-1.5 text-xs font-medium bg-vine-50 text-vine-700 border border-vine-200 px-3 py-1.5 rounded-xl hover:bg-vine-100 transition"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Calendário
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {calendarMenu === e.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setCalendarMenu(null)} />
                      <div className="absolute right-0 top-9 z-20 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden w-52">
                        <button
                          onClick={() => { downloadICS(e); setCalendarMenu(null); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                        >
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="font-medium">Baixar .ics</p>
                            <p className="text-xs text-gray-400">Apple / Outlook / qualquer app</p>
                          </div>
                        </button>
                        <a
                          href={linkGoogleCalendar(e)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setCalendarMenu(null)}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-50"
                        >
                          <ExternalLink className="w-4 h-4 text-blue-500" />
                          <div>
                            <p className="font-medium">Google Calendar</p>
                            <p className="text-xs text-gray-400">Abre no Google Calendar</p>
                          </div>
                        </a>
                      </div>
                    </>
                  )}
                </div>

                {podeEditar && (
                  <button
                    onClick={() => removerEvento(e.id)}
                    className="text-gray-300 hover:text-red-400 transition p-1.5 rounded-lg hover:bg-red-50"
                    title="Remover evento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── TAB: ESCALAS DO LOUVOR ──────────────────────────────────────────────────

const TONS = ["C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B",
              "Cm","C#m","Dm","D#m","Ebm","Em","Fm","F#m","Gm","G#m","Am","A#m","Bbm","Bm"];

const FUNCOES_LOUVOR: FuncaoEscala[] = [
  "Ministro","Guitarra","Baixo","Bateria","Teclado","Backing Vocal",
];

const TEMPLATES_CULTO = [
  { id: "quinta",   label: "Culto de Quinta",   horario: "20:00", diaSemana: 4 /* qui */, cor: "bg-grape-100 text-grape-800 border-grape-200" },
  { id: "domingo",  label: "Culto de Domingo",  horario: "18:30", diaSemana: 0 /* dom */, cor: "bg-gold-100 text-gold-800 border-gold-200" },
  { id: "especial", label: "Culto Especial",    horario: "19:00", diaSemana: null,          cor: "bg-blue-100 text-blue-800 border-blue-200" },
];

/** Retorna as próximas `qtd` datas de um dia da semana (0=Dom, 4=Qui) a partir de hoje */
function proximasDatas(diaSemana: number, qtd = 5): string[] {
  const datas: string[] = [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(hoje);
  // avança até o próximo dia alvo (ou hoje se for o dia)
  while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
  for (let i = 0; i < qtd; i++) {
    datas.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 7);
  }
  return datas;
}

type EscalaSubTab = "detalhes" | "participantes" | "musicas" | "roteiro";

interface EscalaForm {
  culto: string;
  data: string;
  horario: string;
  observacoes: string;
  visivel: boolean;
  confirmacaoParticipantes: boolean;
  itens: ItemEscala[];
  musicas: EscalaMusica[];
}

const EMPTY_FORM: EscalaForm = {
  culto: "", data: "", horario: "", observacoes: "",
  visivel: true, confirmacaoParticipantes: false,
  itens: [], musicas: [],
};

function formatDateSimples(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function EscalasLouvorTab({ ministerio, isLider }: { ministerio: Ministerio; isLider: boolean }) {
  const membros = mockMembrosMinisterio.filter((m) => m.ministerio === ministerio);
  const [escalas, setEscalas] = useState<Escala[]>(
    () => mockEscalas.filter((e) => e.ministerio === ministerio)
  );
  const [modo, setModo] = useState<"lista" | "form">("lista");
  const [editId, setEditId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<EscalaSubTab>("detalhes");
  const [form, setForm] = useState<EscalaForm>(EMPTY_FORM);

  // Participantes — estado interno do sub-form
  const [novoMembroId, setNovoMembroId] = useState("");
  const [novaFuncao, setNovaFuncao] = useState<FuncaoEscala>("Ministro");
  const [novaObs, setNovaObs] = useState("");

  // Músicas — estado interno do sub-form
  const [buscaMusica, setBuscaMusica] = useState("");
  const [tomOverride, setTomOverride] = useState<Record<string, string>>({});

  function abrirNova() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setSubTab("detalhes");
    setModo("form");
  }

  function abrirEdicao(esc: Escala) {
    setForm({
      culto: esc.culto,
      data: esc.data,
      horario: esc.horario,
      observacoes: esc.observacoes ?? "",
      visivel: esc.visivel ?? true,
      confirmacaoParticipantes: esc.confirmacaoParticipantes ?? false,
      itens: [...esc.itens],
      musicas: [...(esc.musicas ?? [])],
    });
    setEditId(esc.id);
    setSubTab("detalhes");
    setModo("form");
  }

  function salvar() {
    if (!form.culto || !form.data || !form.horario) return;
    if (editId) {
      setEscalas((prev) => prev.map((e) =>
        e.id === editId ? { ...e, ...form } : e
      ));
    } else {
      const nova: Escala = {
        id: `esc-${Date.now()}`,
        ministerio,
        criadoPor: "Matheus Lopes",
        ...form,
      };
      setEscalas((prev) => [nova, ...prev]);
    }
    setModo("lista");
  }

  function excluir(id: string) {
    setEscalas((prev) => prev.filter((e) => e.id !== id));
  }

  function addParticipante() {
    if (!novoMembroId) return;
    const membro = membros.find((m) => m.id === novoMembroId);
    if (!membro) return;
    if (form.itens.some((i) => i.voluntarioId === novoMembroId && i.funcao === novaFuncao)) return;
    setForm((f) => ({
      ...f,
      itens: [...f.itens, {
        funcao: novaFuncao,
        voluntarioId: membro.id,
        voluntarioNome: membro.nome,
        observacao: novaObs.trim() || undefined,
      }],
    }));
    setNovoMembroId(""); setNovaObs("");
  }

  function removeParticipante(idx: number) {
    setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
  }

  const musicasFiltradas = mockMusicas.filter((m) =>
    m.titulo.toLowerCase().includes(buscaMusica.toLowerCase()) ||
    m.artista.toLowerCase().includes(buscaMusica.toLowerCase())
  );

  function addMusica(m: Musica) {
    if (form.musicas.some((em) => em.musicaId === m.id)) return;
    setForm((f) => ({
      ...f,
      musicas: [...f.musicas, {
        musicaId: m.id,
        titulo: m.titulo,
        artista: m.artista,
        tom: tomOverride[m.id] ?? m.tom ?? "",
      }],
    }));
  }

  function removeMusica(musicaId: string) {
    setForm((f) => ({ ...f, musicas: f.musicas.filter((m) => m.musicaId !== musicaId) }));
  }

  function moverMusica(idx: number, dir: -1 | 1) {
    const arr = [...form.musicas];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setForm((f) => ({ ...f, musicas: arr }));
  }

  function atualizarTomNaEscala(musicaId: string, tom: string) {
    setForm((f) => ({
      ...f,
      musicas: f.musicas.map((m) => m.musicaId === musicaId ? { ...m, tom } : m),
    }));
  }

  // ── LISTA ────────────────────────────────────────────────────────────────
  if (modo === "lista") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{escalas.length} escala{escalas.length !== 1 ? "s" : ""}</p>
          {isLider && (
            <button onClick={abrirNova}
              className="flex items-center gap-1.5 bg-gold-500 text-vine-950 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gold-400 transition">
              <Plus className="w-4 h-4" /> Nova escala
            </button>
          )}
        </div>

        {escalas.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">Nenhuma escala criada.</div>
        )}

        <div className="space-y-3">
          {escalas.sort((a, b) => a.data.localeCompare(b.data)).map((esc) => (
            <div key={esc.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{esc.culto}</p>
                    {esc.visivel
                      ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Publicada</span>
                      : <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">Rascunho</span>}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDateSimples(esc.data)} às {esc.horario}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Users className="w-3.5 h-3.5" /> {esc.itens.length} participantes
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Music2 className="w-3.5 h-3.5" /> {(esc.musicas ?? []).length} músicas
                    </span>
                  </div>
                  {/* Participantes */}
                  {esc.itens.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {esc.itens.map((it, i) => (
                        <span key={i} className="text-[11px] bg-grape-50 text-grape-800 px-2 py-0.5 rounded-full border border-grape-100">
                          {it.funcao}: <strong>{it.voluntarioNome.split(" ")[0]}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Setlist preview */}
                  {(esc.musicas ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(esc.musicas ?? []).map((m, i) => (
                        <span key={i} className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                          {m.titulo} {m.tom && <span className="font-bold">({m.tom})</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {isLider && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => abrirEdicao(esc)}
                      className="p-2 text-gray-400 hover:text-vine-700 hover:bg-vine-50 rounded-xl transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => excluir(esc.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── FORMULÁRIO ───────────────────────────────────────────────────────────
  const subTabs: { id: EscalaSubTab; label: string; count?: number }[] = [
    { id: "detalhes",      label: "Detalhes" },
    { id: "participantes", label: "Participantes", count: form.itens.length },
    { id: "musicas",       label: "Músicas",       count: form.musicas.length },
    { id: "roteiro",       label: "Roteiro" },
  ];

  return (
    <div className="space-y-4">
      {/* Header do form */}
      <div className="flex items-center gap-3">
        <button onClick={() => setModo("lista")}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">
          {editId ? "Editar escala" : "Nova escala"}
        </h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
        {subTabs.map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition",
              subTab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={clsx("text-[10px] font-bold rounded-full px-1.5",
                subTab === t.id ? "bg-vine-700 text-white" : "bg-gray-300 text-gray-600"
              )}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Detalhes ──────────────────────────────────────────────── */}
      {subTab === "detalhes" && (
        <div className="space-y-4">

          {/* Templates rápidos */}
          <div>
            <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-widest">Tipo de culto</p>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES_CULTO.map((t) => (
                <button key={t.id}
                  onClick={() => {
                    const primeiraData = t.diaSemana !== null ? proximasDatas(t.diaSemana, 1)[0] : "";
                    setForm((f) => ({
                      ...f,
                      culto: t.label,
                      horario: t.horario,
                      data: f.data || primeiraData,
                    }));
                  }}
                  className={clsx(
                    "text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:opacity-80",
                    form.culto === t.label ? t.cor + " ring-2 ring-offset-1 ring-vine-400" : t.cor
                  )}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Datas rápidas (quintas + domingos) */}
          {(form.culto === "Culto de Quinta" || form.culto === "Culto de Domingo") && (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-widest">Escolher data</p>
              <div className="flex flex-wrap gap-2">
                {proximasDatas(
                  form.culto === "Culto de Quinta" ? 4 : 0, 6
                ).map((iso) => (
                  <button key={iso}
                    onClick={() => setForm((f) => ({ ...f, data: iso }))}
                    className={clsx(
                      "text-xs font-semibold px-3 py-1.5 rounded-xl border transition",
                      form.data === iso
                        ? "bg-vine-700 text-white border-vine-700"
                        : "bg-white text-gray-700 border-gray-200 hover:border-vine-400"
                    )}
                  >{formatDateSimples(iso)}</button>
                ))}
              </div>
            </div>
          )}

          {/* Campos manuais */}
          <div className="space-y-3">
            <input value={form.culto} onChange={(e) => setForm({ ...form, culto: e.target.value })}
              placeholder="Título *  ex: Culto Domingo 18h30"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Data</label>
                <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Hora</label>
                <input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white" />
              </div>
            </div>
          </div>

          <div>
            <textarea value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value.slice(0, 500) })}
              placeholder="Observações"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400 resize-none" />
            <p className="text-right text-[10px] text-gray-400">{form.observacoes.length}/500</p>
          </div>
          {/* Visibilidade */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              {form.visivel ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
              <div>
                <p className="text-sm font-semibold text-gray-800">Visibilidade</p>
                <p className="text-xs text-gray-500">{form.visivel ? "Publicada, visível para todos os membros." : "Rascunho, só você vê."}</p>
              </div>
            </div>
            <button onClick={() => setForm({ ...form, visivel: !form.visivel })}
              className={clsx("w-11 h-6 rounded-full transition relative",
                form.visivel ? "bg-vine-700" : "bg-gray-300")}>
              <span className={clsx("absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                form.visivel ? "translate-x-5" : "translate-x-0")} />
            </button>
          </div>
          {/* Confirmação */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Solicitar confirmação dos participantes</p>
              </div>
            </div>
            <button onClick={() => setForm({ ...form, confirmacaoParticipantes: !form.confirmacaoParticipantes })}
              className={clsx("w-11 h-6 rounded-full transition relative",
                form.confirmacaoParticipantes ? "bg-vine-700" : "bg-gray-300")}>
              <span className={clsx("absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                form.confirmacaoParticipantes ? "translate-x-5" : "translate-x-0")} />
            </button>
          </div>
        </div>
      )}

      {/* ── Participantes ─────────────────────────────────────────── */}
      {subTab === "participantes" && (
        <div className="space-y-4">
          {/* Adicionar */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Adicionar participante</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={novoMembroId} onChange={(e) => setNovoMembroId(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white col-span-1">
                <option value="">Selecionar membro</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <select value={novaFuncao} onChange={(e) => setNovaFuncao(e.target.value as FuncaoEscala)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white">
                {FUNCOES_LOUVOR.map((f) => <option key={f}>{f}</option>)}
              </select>
              <input value={novaObs} onChange={(e) => setNovaObs(e.target.value)}
                placeholder="Observação (opcional)"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400" />
            </div>
            <button onClick={addParticipante}
              className="flex items-center gap-1.5 bg-vine-700 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-vine-800 transition">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          {/* Lista */}
          <div className="space-y-2">
            {form.itens.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Nenhum participante adicionado.</p>}
            {form.itens.map((it, i) => (
              <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{it.voluntarioNome}</p>
                  <p className="text-xs text-grape-700 font-medium">{it.funcao}</p>
                  {it.observacao && <p className="text-xs text-gray-400 mt-0.5">{it.observacao}</p>}
                </div>
                <button onClick={() => removeParticipante(i)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Músicas ───────────────────────────────────────────────── */}
      {subTab === "musicas" && (
        <div className="space-y-4">
          {/* Busca no repertório */}
          <div className="space-y-2">
            <input value={buscaMusica} onChange={(e) => setBuscaMusica(e.target.value)}
              placeholder="Buscar no repertório..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400" />
            <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-1 bg-gray-50">
              {musicasFiltradas.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhuma música encontrada.</p>}
              {musicasFiltradas.map((m) => {
                const jaAdicionada = form.musicas.some((em) => em.musicaId === m.id);
                return (
                  <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{m.titulo}</p>
                      <p className="text-xs text-gray-400">{m.artista} {m.estilo && `· ${m.estilo}`}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <select value={tomOverride[m.id] ?? m.tom ?? ""}
                        onChange={(e) => setTomOverride((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white w-16">
                        <option value="">Tom</option>
                        {TONS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <button onClick={() => addMusica(m)} disabled={jaAdicionada}
                        className={clsx("text-xs font-bold px-3 py-1.5 rounded-lg transition",
                          jaAdicionada ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-vine-700 text-white hover:bg-vine-800"
                        )}>
                        {jaAdicionada ? "✓" : "+ Add"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Músicas adicionadas */}
          {form.musicas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Na escala</p>
              {form.musicas.map((em, i) => (
                <div key={em.musicaId} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                  <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{em.titulo}</p>
                    <p className="text-xs text-gray-400">{em.artista}</p>
                  </div>
                  <select value={em.tom ?? ""}
                    onChange={(e) => atualizarTomNaEscala(em.musicaId, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white w-16">
                    <option value="">Tom</option>
                    {TONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button onClick={() => removeMusica(em.musicaId)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Roteiro ───────────────────────────────────────────────── */}
      {subTab === "roteiro" && (
        <div className="space-y-3">
          {form.musicas.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">Adicione músicas na aba "Músicas" primeiro.</p>
          )}
          {form.musicas.map((em, i) => (
            <div key={em.musicaId} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
              <span className="text-sm font-bold text-gray-300 w-5 text-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{em.titulo}</p>
                <p className="text-xs text-gray-400">{em.artista} {em.tom && <span className="font-semibold text-grape-700">· {em.tom}</span>}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moverMusica(i, -1)} disabled={i === 0}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 hover:bg-gray-100 rounded-lg transition">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => moverMusica(i, 1)} disabled={i === form.musicas.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 hover:bg-gray-100 rounded-lg transition">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botão salvar fixo */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <button onClick={() => setModo("lista")}
          className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-100 transition">Cancelar</button>
        <button onClick={salvar}
          disabled={!form.culto || !form.data || !form.horario}
          className="flex items-center gap-1.5 bg-vine-700 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-vine-800 disabled:opacity-40 disabled:cursor-not-allowed transition">
          <Save className="w-4 h-4" /> Salvar
        </button>
      </div>
    </div>
  );
}