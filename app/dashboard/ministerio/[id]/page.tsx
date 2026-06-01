"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare, Users, CalendarDays, Send, Lock, Unlock,
  Plus, Trash2, Pencil, X, Check, Calendar, ExternalLink,
  Pin, ChevronDown, ShieldCheck, ChevronUp,
  Star, Mic, Square, Image as ImageIcon, Grid3x3, Link2,
  MoreVertical,
  Music2, ChevronUp as ArrowUp, ChevronDown as ArrowDown, Save, Eye, EyeOff, UserCheck,
  Reply,
} from "lucide-react";
import clsx from "clsx";
import { Local, Ministerio, MuralMensagem, MembroMinisterio, Evento, FuncaoMinisterio, Escala, EscalaMusica, Musica, FuncaoEscala, ItemEscala } from "@/types";
import { supabase } from "@/lib/supabase";
import { downloadICS, linkGoogleCalendar, formatarData, diaSemana } from "@/lib/calendarUtils";
import { EscalasTab } from "@/components/dashboard/EscalasTab";
import { EventosTab } from "@/components/dashboard/EventosTab";
import { useAppRefresh } from "@/hooks/useAppRefresh";

type Tab = "chat" | "membros" | "eventos" | "escalas";

const corMap: Record<string, string> = {
  Louvor:        "bg-rose-700",
  "Mídias":      "bg-blue-700",
  Ensino:        "bg-amber-700",
  Infantil:      "bg-emerald-700",
  "Ação Social": "bg-orange-700",
  Jovens:        "bg-violet-700",
  Limpeza:       "bg-teal-700",
  // legado
  grape: "bg-rose-700",
  vine:  "bg-gray-900",
  bark:  "bg-amber-700",
  gold:  "bg-amber-600",
};

export default function CanalMinisterioPage() {
  const params = useParams();
  const slug = decodeURIComponent(params.id as string) as Ministerio;
  const { user, temPermissao, temPermissaoNoMinisterio } = useAuth();

  // ── estado global ─────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("chat");
  const [canalBase, setCanalBase] = useState<{ ministerio: string; descricao: string; chatBloqueado: boolean; cor: string } | null>(null);
  const [chatBloqueado, setChatBloqueado] = useState(false);

  function carregarCanalBase() {
    // Timeout de segurança: se demorar mais de 3s, usa fallback e não trava
    const fallbackTimer = setTimeout(() => {
      setCanalBase((prev) => prev ?? { ministerio: slug, descricao: "", chatBloqueado: false, cor: "vine" });
    }, 3000);

    supabase.from("canais_ministerio").select().eq("ministerio", slug).limit(1).then(({ data, error }) => {
      clearTimeout(fallbackTimer);
      if (!error && data && data.length > 0) {
        setCanalBase({ ministerio: data[0].ministerio, descricao: data[0].descricao ?? "", chatBloqueado: data[0].chat_bloqueado, cor: data[0].cor });
        setChatBloqueado(data[0].chat_bloqueado);
      } else {
        if (error) console.error("canais_ministerio error:", error.message);
        setCanalBase({ ministerio: slug, descricao: "", chatBloqueado: false, cor: "vine" });
      }
    });

    return () => clearTimeout(fallbackTimer);
  }

  useEffect(() => {
    return carregarCanalBase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useAppRefresh(() => { carregarCanalBase(); }, [slug], { runOnMount: false, minIntervalMs: 3000 });

  // ── permissão ─────────────────────────────────────────────────────
  const isAdmin               = user?.role === "admin" || user?.role === "pastor";
  const podeBloquearChat     = temPermissaoNoMinisterio("bloquear_chat", slug);
  const podeGerenciarMembros = temPermissaoNoMinisterio("gerenciar_membros_ministerio", slug);
  const podeCriarEvento      = temPermissaoNoMinisterio("criar_evento", slug);
  const podeEditarEvento     = temPermissaoNoMinisterio("editar_evento", slug);
  const podeAtribuirPermissoes = temPermissao("atribuir_permissoes");

  if (!canalBase) {
    return (
      <div className="flex items-center justify-center h-60 text-gray-400">
        Carregando canal...
      </div>
    );
  }

  const corBg = corMap[slug] ?? corMap[canalBase.cor] ?? "bg-gray-900";
  const nomeCanal = slug;

  return (
    <div className="space-y-0">
      {/* Header do canal */}
      <div className={clsx("rounded-2xl px-4 py-4 md:px-6 md:py-5 mb-6 text-white overflow-hidden", corBg)}>
        {/* Título e descrição */}
        <p className="text-xs uppercase tracking-widest opacity-60 mb-0.5">Canal</p>
        <h1 className="text-2xl font-sans font-semibold">{nomeCanal}</h1>
        {canalBase.descricao && (
          <p className="text-sm opacity-70 mt-1">{canalBase.descricao}</p>
        )}

        {/* Botão de bloqueio de chat — abaixo do título, só na tab chat */}
        {tab === "chat" && (
          <button
            onClick={() => podeBloquearChat && setChatBloqueado(!chatBloqueado)}
            disabled={!podeBloquearChat}
            className={clsx(
              "mt-3 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition",
              !podeBloquearChat && "opacity-40 cursor-not-allowed",
              chatBloqueado
                ? "border-white/40 text-white bg-white/20 hover:bg-white/30"
                : "border-white/30 text-white/80 hover:bg-white/10"
            )}
          >
            {chatBloqueado ? (<><Lock className="w-3.5 h-3.5" /> Chat bloqueado</>) : (<><Unlock className="w-3.5 h-3.5" /> Chat livre</>)}
          </button>
        )}

        {/* Tabs com scrollbar visível */}
        <div className="mt-4 border-t border-white/20 pt-3">
          <div
            className="tabs-scroll flex items-center gap-1 overflow-x-auto pb-2"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.4) transparent",
              WebkitOverflowScrolling: "touch",
            } as React.CSSProperties}
          >
            {([
              { id: "chat",    label: "Chat",    icon: MessageSquare },
              { id: "escalas", label: "Escalas", icon: CalendarDays  },
              { id: "eventos", label: "Eventos", icon: Calendar      },
              { id: "membros", label: "Membros", icon: Users         },
            ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition shrink-0",
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
      </div>

      {/* Conteúdo da tab */}
      {tab === "chat"    && <ChatTab ministerio={slug} chatBloqueado={chatBloqueado} podeEnviar={temPermissaoNoMinisterio("enviar_chat", slug)} podeFixar={temPermissaoNoMinisterio("fixar_mensagem", slug)} user={user} />}
      {tab === "membros" && <MembrosTab ministerio={slug} isLider={podeGerenciarMembros} podeAtribuirPermissoes={podeAtribuirPermissoes} />}
      {tab === "eventos" && <EventosTab ministerio={slug} isLider={podeCriarEvento} podeEditar={podeEditarEvento} />}
      {tab === "escalas" && <EscalasTab ministerio={slug} isLider={isAdmin || temPermissaoNoMinisterio("criar_escala", slug)} />}
    </div>
  );
}

// ─── TAB: CHAT ────────────────────────────────────────────────────────────────

// Helpers de rede (mesmo padrão do chat de conversas)
async function getMuralToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "";
  const expiresAt = session.expires_at ?? 0;
  if (Date.now() / 1000 > expiresAt - 60) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? "";
  }
  return session.access_token;
}

async function muralFetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(input, init);
      if (res.status >= 500 && i < attempts) { await new Promise(r => setTimeout(r, i * 200)); continue; }
      return res;
    } catch (e) {
      lastError = e;
      if (i < attempts) { await new Promise(r => setTimeout(r, i * 200)); continue; }
    }
  }
  throw lastError ?? new Error("Falha de rede");
}

function muralCacheKey(ministerio: string) { return `mural_cache_v1_${ministerio}`; }

type InfoPanel = "midia" | "links" | "favoritos" | null;

function detectarLinks(texto: string): string[] {
  // Captura http(s):// e também www. e domínios comuns sem protocolo
  const regex = /(?:https?:\/\/|www\.)[^\s<>"']+|[a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,}(?:\/[^\s<>"']*)?/g;
  return Array.from(texto.matchAll(regex))
    .map((m) => m[0])
    .filter((u) => u.includes(".") && u.length > 4);
}

function renderTextoComLinks(texto: string, isMe: boolean) {
  const urlRegex = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?\b/g;
  const parts = texto.split(urlRegex);
  const urls = texto.match(urlRegex) ?? [];
  return parts.flatMap((part, i) => [
    part,
    urls[i] ? (
      <a
        key={`link-${i}`}
        href={urls[i].startsWith("http") ? urls[i] : `https://${urls[i]}`}
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
  // Carrega cache instantâneo antes do fetch do servidor
  const [msgs, setMsgs] = useState<MuralMensagem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(muralCacheKey(ministerio));
      if (!raw) return [];
      return JSON.parse(raw) as MuralMensagem[];
    } catch { return []; }
  });

  const broadcastChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  function rowToMsg(m: Record<string, unknown>): MuralMensagem {
    return {
      id: m.id as string, ministerio: m.ministerio as Ministerio,
      autorId: (m.autor_id as string) ?? "",
      autorNome: (m.autor_nome as string) ?? "",
      autorRole: (m.autor_role as MuralMensagem["autorRole"]) ?? "membro",
      conteudo: (m.conteudo as string) ?? "",
      criadoEm: (m.criado_em as string) ?? new Date().toISOString(),
      fixada: !!(m.fixada),
      tipo: (m.tipo as MuralMensagem["tipo"]) ?? "texto",
      mediaUrl: (m.media_url as string) ?? undefined,
      reacoes: Array.isArray(m.reacoes) ? m.reacoes : [],
      editadoEm: (m.editado_em as string) ?? undefined,
      respostaA: (m.resposta_a as MuralMensagem["respostaA"]) ?? undefined,
    };
  }

  function saveCache(list: MuralMensagem[]) {
    try { localStorage.setItem(muralCacheKey(ministerio), JSON.stringify(list.slice(-200))); } catch { /* ignore */ }
  }

  async function fetchAndSync() {
    const { data } = await supabase
      .from("mural_mensagens")
      .select()
      .eq("ministerio", ministerio)
      .order("criado_em", { ascending: true })
      .limit(200);
    if (!data) return;
    const fresh = data.map(rowToMsg);
    setMsgs((prev) => {
      // Merge: mantém mensagens locais (temp) e merge com as do servidor
      const serverIds = new Set(fresh.map(m => m.id));
      const onlyLocal = prev.filter(m => m.id.startsWith("temp-") || !serverIds.has(m.id));
      const merged = [...fresh, ...onlyLocal].sort((a, b) =>
        new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
      );
      saveCache(merged.filter(m => !m.id.startsWith("temp-")));
      return merged;
    });
  }

  useEffect(() => {
    fetchAndSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministerio]);

  // Realtime: broadcast (WebSocket puro, baixa latência) para INSERTs +
  //           postgres_changes para UPDATE e DELETE.
  useEffect(() => {
    // Canal de broadcast — o remetente envia o payload depois de confirmar com o servidor.
    // Isso garante timestamp autoritativo e entrega sem latência de Realtime DB.
    const bcCh = supabase
      .channel(`mural:${ministerio}`)
      .on("broadcast", { event: "msg" }, ({ payload }: { payload: MuralMensagem }) => {
        setMsgs((prev) => {
          if (prev.some(m => m.id === payload.id)) return prev; // deduplicar
          const next = [...prev, payload].sort((a, b) =>
            new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
          );
          saveCache(next.filter(m => !m.id.startsWith("temp-")));
          return next;
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("system" as any, { event: "CLOSED" }, () => {
        // Reconexão: busca mensagens que chegaram enquanto offline
        fetchAndSync();
      })
      .subscribe();
    broadcastChRef.current = bcCh;

    // postgres_changes apenas para UPDATE (edições) e DELETE
    const pgCh = supabase
      .channel(`mural_pg_${ministerio}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "mural_mensagens",
        filter: `ministerio=eq.${ministerio}`,
      }, ({ new: raw }) => {
        const row = raw as Record<string, unknown>;
        setMsgs((prev) => {
          const next = prev.map((msg) => msg.id !== row.id ? msg : {
            ...msg,
            conteudo: (row.conteudo as string) ?? msg.conteudo,
            fixada: !!(row.fixada),
            editadoEm: (row.editado_em as string) ?? undefined,
            reacoes: Array.isArray(row.reacoes) ? row.reacoes : [],
          });
          saveCache(next.filter(m => !m.id.startsWith("temp-")));
          return next;
        });
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public",
        table: "mural_mensagens",
      }, ({ old: raw }) => {
        const row = raw as Record<string, unknown>;
        if (row.id) {
          setMsgs((prev) => {
            const next = prev.filter((m) => m.id !== row.id);
            saveCache(next);
            return next;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(bcCh);
      supabase.removeChannel(pgCh);
      broadcastChRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Image
  const [imagemFile, setImagemFile] = useState<File | null>(null);
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

  async function enviar(tipo: MuralMensagem["tipo"] = "texto") {
    if (!user) return;
    if (tipo === "texto" && !texto.trim()) return;

    // UUID gerado pelo cliente — permite idempotência e deduplicação exata
    const msgId = crypto.randomUUID();
    const agora = new Date().toISOString();
    const conteudo = tipo === "texto" ? texto.trim() : tipo === "imagem" ? "📷 Imagem" : "🎙️ Áudio";
    const respostaCapturada = respostaA;

    // 1. Feedback imediato (otimista) — usa o UUID real desde o início
    const localUrl = tipo === "imagem" ? imagemPreview : tipo === "audio" ? audioUrl : undefined;
    const tempMsg: MuralMensagem = {
      id: msgId, ministerio, autorId: user.id ?? "", autorNome: user.nome,
      autorRole: user.role as MuralMensagem["autorRole"],
      conteudo, criadoEm: agora, fixada: false, tipo,
      mediaUrl: localUrl ?? undefined, reacoes: [],
      respostaA: respostaCapturada ?? undefined,
    };
    setMsgs((prev) => [...prev, tempMsg].sort((a, b) =>
      new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
    ));
    setTexto(""); setImagemPreview(null); setAudioUrl(null); setRespostaA(null); setImagemFile(null); setAudioBlob(null);

    const blobParaUpload = audioBlob;

    // 2. Upload de mídia via API
    let uploadedUrl: string | null = null;
    try {
      const token = await getMuralToken();
      if (!token) throw new Error("Sem sessão");

      if (tipo === "imagem" && imagemFile) {
        const fd = new FormData();
        fd.append("file", imagemFile);
        fd.append("conversa_id", `ministerio_${ministerio}`);
        const res = await muralFetchWithRetry("/api/chat/upload-imagem", {
          method: "POST", headers: { authorization: `Bearer ${token}` }, body: fd,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload falhou");
        uploadedUrl = json.url;
        setMsgs((prev) => prev.map((m) => m.id === msgId ? { ...m, mediaUrl: uploadedUrl ?? undefined } : m));
      } else if (tipo === "audio" && blobParaUpload) {
        const audioFile = new File([blobParaUpload], "audio.webm", { type: "audio/webm" });
        const fd = new FormData();
        fd.append("file", audioFile);
        fd.append("conversa_id", `ministerio_${ministerio}`);
        fd.append("file_type", "audio");
        const res = await muralFetchWithRetry("/api/chat/upload-arquivo", {
          method: "POST", headers: { authorization: `Bearer ${token}` }, body: fd,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload falhou");
        uploadedUrl = json.url;
        setMsgs((prev) => prev.map((m) => m.id === msgId ? { ...m, mediaUrl: uploadedUrl ?? undefined } : m));
      }
    } catch (err) {
      setMsgs((prev) => prev.filter((m) => m.id !== msgId));
      alert("Erro ao enviar mídia. Tente novamente.");
      console.error(err);
      return;
    }

    // 3. Persiste via API (que dispara push + sininho) com retry automático
    try {
      const token = await getMuralToken();
      const r = await muralFetchWithRetry("/api/ministerio/mensagem", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: msgId, ministerio, autor_id: user.id, autor_nome: user.nome,
          autor_role: user.role, conteudo, tipo,
          media_url: uploadedUrl ?? null,
          resposta_a: respostaCapturada ?? null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? r.statusText);
      }
      const j = await r.json().catch(() => ({}));
      const serverTime: string = j.criado_em ?? agora;

      // 4. Atualiza com timestamp do servidor e reordena
      const finalMsg: MuralMensagem = { ...tempMsg, criadoEm: serverTime, mediaUrl: uploadedUrl ?? tempMsg.mediaUrl };
      setMsgs((prev) => {
        const next = prev
          .map((m) => m.id === msgId ? finalMsg : m)
          .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
        saveCache(next.filter(m => !m.id.startsWith("temp-")));
        return next;
      });

      // 5. Broadcast para outros clientes — usam o timestamp do servidor para ordenar corretamente
      broadcastChRef.current?.send({ type: "broadcast", event: "msg", payload: finalMsg });
    } catch (err) {
      console.error("ministerio enviar error:", err);
      setMsgs((prev) => prev.filter((m) => m.id !== msgId));
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Comprime via Canvas antes de guardar (máx 1280px, qualidade 80%)
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1280;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
        setImagemFile(compressed);
        setImagemPreview(URL.createObjectURL(compressed));
      }, "image/jpeg", 0.8);
    };
    img.src = objectUrl;
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob)); // preview local
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
    const msg = msgs.find((m) => m.id === id);
    if (!msg) return;
    const novaFixada = !msg.fixada;
    setMsgs((prev) => prev.map((m) => m.id === id ? { ...m, fixada: novaFixada } : m));
    supabase.from("mural_mensagens").update({ fixada: novaFixada }).eq("id", id);
    setMenuId(null);
  }

  function toggleReacao(msgId: string, emoji: string) {
    const key = `${msgId}_${emoji}`;
    const already = myReacoes.has(key);
    setMyReacoes((prev) => { const next = new Set(prev); already ? next.delete(key) : next.add(key); return next; });
    const msg = msgs.find((m) => m.id === msgId);
    if (!msg) return;
    const reacoes = msg.reacoes ?? [];
    const newReacoes = already
      ? reacoes.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1 } : r).filter((r) => r.count > 0)
      : (() => { const ex = reacoes.find((r) => r.emoji === emoji); return ex ? reacoes.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1 } : r) : [...reacoes, { emoji, count: 1 }]; })();
    setMsgs((prev) => prev.map((m) => m.id === msgId ? { ...m, reacoes: newReacoes } : m));
    supabase.from("mural_mensagens").update({ reacoes: newReacoes }).eq("id", msgId);
    setMenuId(null);
  }

  function salvarEdicao(msgId: string) {
    if (!editTexto.trim()) return;
    const novoConteudo = editTexto.trim();
    const agora = new Date().toISOString();
    setMsgs((prev) => prev.map((m) => m.id === msgId ? { ...m, conteudo: novoConteudo, editadoEm: agora } : m));
    supabase.from("mural_mensagens").update({ conteudo: novoConteudo, editado_em: agora }).eq("id", msgId);
    setEditandoId(null);
    setEditTexto("");
  }

  function excluirMensagem(msgId: string) {
    setMsgs((prev) => prev.filter((m) => m.id !== msgId));
    setMenuId(null);
    supabase.from("mural_mensagens").delete().eq("id", msgId).then(({ error }) => {
      if (error) {
        // Reverte o otimismo se o banco rejeitar
        console.error("Erro ao excluir mensagem:", error.message);
        supabase.from("mural_mensagens").select().eq("id", msgId).single().then(({ data }) => {
          if (data) setMsgs((prev) => [...prev, rowToMsg(data as Record<string, unknown>)]);
        });
      }
    });
  }

  const temMidia = !!imagemPreview || !!audioUrl;

  return (
    <div className="flex gap-4 h-[calc(100vh-300px)] min-h-[400px]">
      {/* ── Área principal do chat ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mensagem fixada */}
        {fixadas.length > 0 && (
          <div className="mb-3 bg-gold-50 border border-gold-200 rounded-xl px-4 py-2 flex items-center gap-2">
            <Pin className="w-3.5 h-3.5 text-gold-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gold-700 mb-0.5">Fixada</p>
              <p className="text-xs text-gold-800 line-clamp-1">{fixadas[0].conteudo === "📷 Imagem" ? "📷 Imagem" : fixadas[0].conteudo}</p>
              <p className="text-[10px] text-gold-500 mt-0.5">— {fixadas[0].autorNome}</p>
            </div>
            {podeFixar && (
              <button
                onClick={() => toggleFixar(fixadas[0].id)}
                className="ml-2 text-[10px] font-medium text-gold-700 hover:text-gold-900 bg-gold-100 hover:bg-gold-200 px-2 py-1 rounded-lg transition shrink-0"
                title="Desfixar"
              >
                Desfixar
              </button>
            )}
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
          {msgs.map((m) => {
            const isMe = !!user && (m.autorId === user.id || m.autorId === "me" || m.autorNome === user.nome);
            const isFav = favoritos.includes(m.id);
            return (
              <div
                key={m.id}
                className={clsx("flex group", isMe ? "justify-end" : "justify-start", m.fixada && "relative")}                
              >
                {/* Indicador lateral de fixada */}
                {m.fixada && (
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-0.5 h-4/5 bg-gold-400 rounded-full" />
                )}
                <div className="relative max-w-[88%]">
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
                        {(isMe || podeFixar) && (
                          <button
                            onClick={() => excluirMensagem(m.id)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-500 hover:bg-red-50 transition text-left border-t border-gray-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir mensagem
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  <div className={clsx(
                    "rounded-2xl text-base shadow-sm relative overflow-hidden",
                    (!m.tipo || m.tipo === "texto")
                      ? clsx("w-full min-w-[120px] px-4 py-3", isMe ? "bg-vine-700 text-white rounded-tr-sm" : "bg-white text-gray-800 rounded-tl-sm border border-gray-100")
                      : m.tipo === "imagem"
                        ? clsx("max-w-[320px] p-0 border-0 bg-transparent shadow-md", isMe ? "rounded-tr-sm" : "rounded-tl-sm")
                        : clsx("max-w-[320px]", isMe ? "bg-transparent rounded-tr-sm" : "bg-transparent rounded-tl-sm")
                  )}>
                    {/* Quoted reply */}
                    {m.respostaA && (
                      <div className={clsx(
                        "mb-1.5 rounded-lg px-2.5 py-1.5 border-l-2",
                        isMe ? "bg-vine-600/50 border-white/40" : "bg-gray-100 border-vine-400"
                      )}>
                        <p className={clsx("text-xs font-semibold", isMe ? "text-white/70" : "text-vine-600")}>{m.respostaA.autorNome}</p>
                        <p className={clsx("text-sm truncate", isMe ? "text-white/60" : "text-gray-500")}>{m.respostaA.conteudo}</p>
                      </div>
                    )}

                    {!isMe && (!m.tipo || m.tipo === "texto") && (
                      <p className={clsx("text-xs font-semibold mb-1",
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
                        <p className="leading-relaxed text-base">{renderTextoComLinks(m.conteudo, isMe)}</p>
                      )
                    )}

                    {/* Imagem — sem borda/fundo, cobre o bubble inteiro */}
                    {m.tipo === "imagem" && m.mediaUrl && (
                      <div className="relative">
                        <img
                          src={m.mediaUrl}
                          alt="imagem"
                          className="w-full block rounded-2xl"
                          style={{ display: "block" }}
                        />
                        {/* Horário sobre a imagem, canto inferior */}
                        <span className="absolute bottom-2 right-2.5 text-[10px] text-white font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                          {new Date(m.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}

                    {/* Áudio — player com fundo neutro visível */}
                    {m.tipo === "audio" && m.mediaUrl && (
                      <div className={clsx("px-3 py-2 rounded-2xl border", isMe ? "bg-vine-50 border-vine-200" : "bg-gray-100 border-gray-200")} style={{ minWidth: 280 }}>
                        {!isMe && <p className="text-xs font-semibold text-vine-600 mb-1">{m.autorNome}</p>}
                        <audio controls preload="metadata" src={m.mediaUrl} className="h-7 w-full rounded-full" style={{ minWidth: 260 }} />
                        <p className={clsx("text-xs text-right mt-0.5", isMe ? "text-vine-400" : "text-gray-400")}>
                          {new Date(m.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    )}

                    {/* Rodapé da mensagem */}
                    {(!m.tipo || m.tipo === "texto") && (
                      <div className={clsx("flex items-center gap-1.5 justify-end mt-1")}>
                        {isFav && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                        {m.fixada && <Pin className="w-3.5 h-3.5 text-gold-500" />}
                        <p className={clsx("text-xs", isMe ? "text-white/50" : "text-gray-400")}>
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
              onClick={() => enviar("imagem")}
              className="bg-vine-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-vine-600 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Enviar
            </button>
          </div>
        )}

        {/* Preview de áudio */}
        {audioUrl && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <audio controls preload="metadata" src={audioUrl} className="h-9 flex-1" />
            <button onClick={() => { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }} className="text-gray-400 hover:text-red-400"><X className="w-4 h-4" /></button>
            <button
              onClick={() => enviar("audio")}
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
                          <audio controls preload="metadata" src={m.mediaUrl} className="w-full h-8" />
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

const funcoes: FuncaoMinisterio[] = ["Líder", "Colíder", "Voluntário(a)"];

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
  const [membros, setMembros] = useState<MembroMinisterio[]>([]);

  function carregarMembros() {
    Promise.all([
      supabase.from("perfis")
        .select("id, nome, email, telefone, role, lider_ministerios, data_ingresso")
        .contains("ministerios", [ministerio])
        .eq("ativo", true),
      supabase.from("membros_ministerio")
        .select("usuario_id, funcao")
        .eq("ministerio", ministerio),
    ]).then(([{ data: perfisData }, { data: mmData }]) => {
      if (!perfisData) return;
      const funcaoMap = new Map((mmData ?? []).map((r: Record<string, string>) => [r.usuario_id, r.funcao]));
      setMembros(perfisData.map((p: Record<string, unknown>) => {
        const liderMins = (p.lider_ministerios as string[]) ?? [];
        const isLiderPerfil = p.role === "pastor" || liderMins.includes(ministerio);
        const funcao = (funcaoMap.get(p.id as string) ?? (isLiderPerfil ? "Líder" : "Voluntário(a)")) as FuncaoMinisterio;
        return {
          id: p.id as string,
          nome: p.nome as string,
          email: p.email as string,
          telefone: (p.telefone as string) ?? undefined,
          funcao,
          ministerio,
          ativo: true,
          dataEntrada: (p.data_ingresso as string) ?? "",
        };
      }));
    });
  }

  useAppRefresh(() => { carregarMembros(); }, [ministerio], { minIntervalMs: 2500 });

  useEffect(() => {
    const channel = supabase
      .channel(`membros-ministerio-refresh:${ministerio}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "perfis" }, () => carregarMembros())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministerio]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaFuncao, setNovaFuncao] = useState<FuncaoMinisterio>("Voluntário(a)");
  const [showForm, setShowForm] = useState(false);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<any[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<string>("");
  const [novaFuncaoForm, setNovaFuncaoForm] = useState<FuncaoMinisterio>("Voluntário(a)");

  // Buscar usuários ativos que não estão no ministério
  useEffect(() => {
    if (!showForm) return;
    supabase.from("perfis")
      .select("id, nome, email, telefone, role")
      .eq("ativo", true)
      .then(({ data }) => {
        if (data) {
          const idsMembros = new Set(membros.map((m) => m.id));
          setUsuariosDisponiveis(data.filter((u: any) => !idsMembros.has(u.id)));
        }
      });
  }, [showForm, membros]);
  const [sortBy, setSortBy] = useState<"nome" | "funcao">("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(col: "nome" | "funcao") {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("asc"); }
  }

  const FUNCAO_ORDER: Record<FuncaoMinisterio, number> = {
    "Líder": 0,
    "Colíder": 1,
    "Sub-líder": 2,
    "Membro": 3,
    "Voluntário(a)": 4,
    "Visitante": 5,
  };
  const eLider = (m: MembroMinisterio) => m.funcao === "Líder" || m.funcao === "Colíder";
  const membrosOrdenados = [
    ...membros.filter(eLider).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    ...membros.filter((m) => !eLider(m)).sort((a, b) => {
      let cmp = 0;
      if (sortBy === "nome") cmp = a.nome.localeCompare(b.nome, "pt-BR");
      else cmp = (FUNCAO_ORDER[a.funcao] ?? 9) - (FUNCAO_ORDER[b.funcao] ?? 9);
      return sortDir === "asc" ? cmp : -cmp;
    }),
  ];

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
    // Salva a função em membros_ministerio
    supabase.from("membros_ministerio").upsert(
      { usuario_id: id, ministerio, funcao: novaFuncao },
      { onConflict: "usuario_id,ministerio" }
    ).then(() => {});
    // Mantém lider_ministerios em perfis sincronizado
    supabase.from("perfis").select("lider_ministerios, role").eq("id", id).single().then(({ data }) => {
      if (!data) return;
      const atual: string[] = data.lider_ministerios ?? [];
      let updated: string[];
      if (novaFuncao === "Líder") {
        updated = atual.includes(ministerio) ? atual : [...atual, ministerio];
      } else {
        updated = atual.filter((m) => m !== ministerio);
      }
      const updates: Record<string, unknown> = { lider_ministerios: updated };
      if (novaFuncao === "Líder" && data.role === "membro") updates.role = "lider";
      if (novaFuncao !== "Líder" && novaFuncao !== "Colíder" && updated.length === 0 && data.role === "lider") updates.role = "membro";
      supabase.from("perfis").update(updates).eq("id", id).then(() => {});
    });
  }

  function remover(id: string) {
    setMembros((prev) => prev.filter((m) => m.id !== id));
  }

  async function adicionar() {
    if (!usuarioSelecionado) return;
    const usuario = usuariosDisponiveis.find((u) => u.id === usuarioSelecionado);
    if (!usuario) return;
    // Atualiza o array de ministérios do usuário
    const { error } = await supabase
      .from("perfis")
      .update({ ministerios: [...(usuario.ministerios ?? []), ministerio] })
      .eq("id", usuario.id);
    if (!error) {
      // Salva a função em membros_ministerio
      await supabase.from("membros_ministerio").upsert(
        { usuario_id: usuario.id, ministerio, funcao: novaFuncaoForm },
        { onConflict: "usuario_id,ministerio" }
      );
      setMembros((prev) => [...prev, {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        funcao: novaFuncaoForm,
        ministerio,
        ativo: true,
        dataEntrada: new Date().toISOString().split("T")[0],
      }]);
      setUsuarioSelecionado("");
      setNovaFuncaoForm("Voluntário(a)");
      setShowForm(false);
    }
  }

  const funcaoCor: Record<FuncaoMinisterio, string> = {
    "Líder":        "bg-gold-100 text-gold-800",
    "Colíder":      "bg-yellow-100 text-yellow-800",
    "Sub-líder":    "bg-vine-100 text-vine-800",
    "Membro":       "bg-gray-100 text-gray-700",
    "Voluntário(a)": "bg-blue-50 text-blue-700",
    "Visitante":    "bg-amber-50 text-amber-700",
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
          <p className="text-sm font-semibold text-vine-800">Adicionar membro existente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={usuarioSelecionado}
              onChange={(e) => setUsuarioSelecionado(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white"
            >
              <option value="">Selecione um usuário...</option>
              {usuariosDisponiveis.map((u) => {
                const nomes = u.nome.trim().split(" ");
                const display = nomes.length > 1 ? nomes[0] + " " + nomes[nomes.length - 1] : u.nome;
                return <option key={u.id} value={u.id}>{display}</option>;
              })}
            </select>
            <select
              value={novaFuncaoForm}
              onChange={(e) => setNovaFuncaoForm(e.target.value as FuncaoMinisterio)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white"
            >
              {funcoes.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-1.5 rounded-xl hover:bg-gray-100 transition">Cancelar</button>
            <button onClick={adicionar} className="text-sm bg-vine-700 text-white px-4 py-1.5 rounded-xl hover:bg-vine-600 transition" disabled={!usuarioSelecionado}>
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
              <th className="text-left px-4 py-3">
                <button
                  onClick={() => toggleSort("nome")}
                  className="flex items-center gap-1 hover:text-gray-800 transition"
                >
                  Nome
                  <span className="flex flex-col leading-none">
                    <ChevronUp   className={clsx("w-2.5 h-2.5", sortBy==="nome" && sortDir==="asc"  ? "text-vine-600" : "text-gray-300")} />
                    <ChevronDown className={clsx("w-2.5 h-2.5", sortBy==="nome" && sortDir==="desc" ? "text-vine-600" : "text-gray-300")} />
                  </span>
                </button>
              </th>
              <th className="text-left px-4 py-3">Contato</th>
              <th className="text-left px-4 py-3">
                <button
                  onClick={() => toggleSort("funcao")}
                  className="flex items-center gap-1 hover:text-gray-800 transition"
                >
                  Função
                  <span className="flex flex-col leading-none">
                    <ChevronUp   className={clsx("w-2.5 h-2.5", sortBy==="funcao" && sortDir==="asc"  ? "text-vine-600" : "text-gray-300")} />
                    <ChevronDown className={clsx("w-2.5 h-2.5", sortBy==="funcao" && sortDir==="desc" ? "text-vine-600" : "text-gray-300")} />
                  </span>
                </button>
              </th>
              {(isLider || podeAtribuirPermissoes) && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {membrosOrdenados.map((m) => (
              <React.Fragment key={m.id}>
                <tr className="border-b border-gray-50 hover:bg-gray-50 transition">
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
                  <tr className="bg-vine-50 border-b border-vine-100">
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
              </React.Fragment>
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

