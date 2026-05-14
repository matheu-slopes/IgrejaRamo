"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import {
  TODAS_PERMISSOES, PERMISSAO_LABEL, GRUPOS_PERMISSAO,
  DEFAULTS_POR_ROLE, permissoesEfetivas,
} from "@/lib/permissions";
import {
  Shield, ShieldCheck, Users, Plus, Search, Pencil, Power, X,
  ChevronRight, ChevronUp, ChevronDown, Check, RotateCcw, UserPlus, AlertCircle,
  Layers, Lock, Unlock, Trash2, Save, Link2, MapPin, Pin,
  Eye, EyeOff, Bell, BookOpen, Image as ImageIcon, Video, Type, Quote, PlayCircle, Calendar as CalendarIcon,
} from "lucide-react";
import clsx from "clsx";
import { User, Role, Ministerio, Permissao, CanalMinisterio, Local } from "@/types";
import { supabase } from "@/lib/supabase";
import { notificarBroadcast } from "@/lib/notificarBroadcast";
import { DiagnosticoPush } from "@/components/DiagnosticoPush";

const ROLES: Role[] = ["admin", "pastor", "lider", "voluntario", "membro"];
const MINISTERIOS: Ministerio[] = ["Louvor","Mídias","Ensino","Infantil","Ação Social","Jovens","Cantina","Limpeza"];

const ROLE_COR: Record<Role, string> = {
  admin:      "bg-red-100 text-red-700 border-red-200",
  pastor:     "bg-purple-100 text-purple-700 border-purple-200",
  lider:      "bg-gold-100 text-gold-800 border-gold-200",
  voluntario: "bg-gray-100 text-gray-900 border-gray-200",
  membro:     "bg-gray-100 text-gray-600 border-gray-200",
};

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin", pastor: "Pastor", lider: "Líder",
  voluntario: "Voluntário", membro: "Membro",
};

type Painel = "lista" | "novo";
type AdminTab = "usuarios" | "ministerios" | "locais" | "conteudo";

const CORES_CANAL = ["vine", "grape", "bark", "gold", "blue", "green", "rose"] as const;
type CorCanal = typeof CORES_CANAL[number];
const COR_LABEL: Record<string, string> = {
  vine: "Vinha", grape: "Uva", bark: "Casca", gold: "Ouro",
  blue: "Azul", green: "Verde", rose: "Rosa",
};
const COR_BG: Record<string, string> = {
  vine: "bg-gray-800", grape: "bg-grape-700", bark: "bg-bark-600", gold: "bg-gold-500",
  blue: "bg-blue-600", green: "bg-green-600", rose: "bg-rose-500",
};

export default function AdminPage() {
  const { user: eu, usuarios, atualizarUsuario, criarUsuario, removerUsuario, temPermissao } = useAuth();
  const searchParams = useSearchParams();

  const [adminTab, setAdminTab] = useState<AdminTab>(() => {
    const t = searchParams.get("tab") as AdminTab | null;
    return t && ["usuarios", "ministerios", "locais", "conteudo"].includes(t) ? t : "usuarios";
  });
  const [initSecao, setInitSecao] = useState(() => searchParams.get("secao") ?? undefined);

  // Sincroniza com mudanças de URL (navegação pela sidebar)
  useEffect(() => {
    const t = searchParams.get("tab") as AdminTab | null;
    if (t && ["usuarios", "ministerios", "locais", "conteudo"].includes(t)) {
      setAdminTab(t);
    }
    setInitSecao(searchParams.get("secao") ?? undefined);
  }, [searchParams]);
  const [busca, setBusca] = useState("");
  const [painel, setPainel] = useState<Painel>("lista");
  const [editando, setEditando] = useState<User | null>(null);

  const podeGerenciar = temPermissao("gerenciar_usuarios");
  const podeCriarAviso = temPermissao("criar_aviso");

  if (!podeGerenciar && !podeCriarAviso) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-center gap-3">
        <Shield className="w-10 h-10 text-gray-200" />
        <p className="text-gray-500 font-medium">Acesso restrito</p>
        <p className="text-sm text-gray-400">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  const filtrados = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="max-w-5xl space-y-6">

      {adminTab === "ministerios" && podeGerenciar && (
        <MinisteriosTab usuarios={usuarios} temPermissao={temPermissao} />
      )}

      {adminTab === "ministerios" && podeGerenciar && (
        <>
          <DiagnosticoPush />
          <TestePushPanel />
        </>
      )}

      {adminTab === "locais" && podeGerenciar && (
        <LocaisTab />
      )}

      {(adminTab === "conteudo" || (!podeGerenciar && podeCriarAviso)) && (
        <ConteudoTab initSecao={adminTab !== "conteudo" ? "avisos" : initSecao} />
      )}

      {adminTab === "usuarios" && podeGerenciar && <>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield className="w-5 h-5 text-gray-900" />
            <h1 className="text-2xl font-sans font-semibold text-black">Painel Admin</h1>
          </div>
          <p className="text-sm text-gray-500">
            Gerencie usuários, roles e permissões individuais sem editar código.
          </p>
        </div>
        <button
          onClick={() => { setPainel("novo"); setEditando(null); }}
          className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-black transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" /> Novo usuário
        </button>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Lista de usuários ── */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: "Total",     valor: usuarios.length,                       cor: "text-gray-800"  },
              { label: "Ativos",    valor: usuarios.filter((u) => u.ativo).length, cor: "text-green-700" },
              { label: "Inativos",  valor: usuarios.filter((u) => !u.ativo).length,cor: "text-red-600"   },
            ]).map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
                <p className={clsx("text-2xl font-bold font-sans", s.cor)}>{s.valor}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
                  <th className="text-left px-4 py-3">Usuário</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Ministérios</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => {
                  const temCustom = !!u.permissoes;
                  return (
                    <tr
                      key={u.id}
                      className={clsx(
                        "border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer",
                        editando?.id === u.id && "bg-gray-50 hover:bg-gray-50",
                        !u.ativo && "opacity-50"
                      )}
                      onClick={() => setEditando(u)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-gray-100 text-gray-900 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                            {u.nome.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{u.nome}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={clsx("text-[11px] font-semibold px-2 py-0.5 rounded-full border", ROLE_COR[u.role])}>
                            {ROLE_LABEL[u.role]}
                          </span>
                          {temCustom && (
                            <span title="Permissões customizadas" className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-gray-500">{u.ministerios.join(", ") || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("text-xs font-medium", u.ativo ? "text-green-600" : "text-red-400")}>
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">Nenhum usuário encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Painel lateral ── */}
        {(editando || painel === "novo") && (
          <div className="w-96 shrink-0">
            {painel === "novo" && !editando ? (
              <NovoUsuarioForm
                onCriar={async (dados, senha) => {
                  const result = await criarUsuario(dados, senha);
                  if ("error" in result) return { error: result.error };
                  return { ok: true };
                }}
                onCancelar={() => setPainel("lista")}
              />
            ) : editando ? (
              <EditarUsuarioPanel
                usuario={editando}
                euSouEle={eu?.id === editando.id}
                podeatribuir={temPermissao("atribuir_permissoes")}
                onChange={(dados) => {
                  atualizarUsuario(editando.id, dados);
                  setEditando({ ...editando, ...dados });
                }}
                onRemover={() => { removerUsuario(editando.id); setEditando(null); }}
                onFechar={() => setEditando(null)}
              />
            ) : null}
          </div>
        )}
      </div>
      </> }
    </div>
  );
}

// ─── Aba de Ministérios ───────────────────────────────────────────

function MinisteriosTab({
  usuarios,
}: {
  usuarios: User[];
  temPermissao: (p: Permissao) => boolean;
}) {
  const MINISTERIOS_LISTA: Ministerio[] = ["Louvor","Mídias","Ensino","Infantil","Ação Social","Jovens","Cantina"];
  const [editandoMin, setEditandoMin] = useState<Ministerio | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function toggleMembro(usuario: User, ministerio: Ministerio) {
    const jaEsta = usuario.ministerios?.includes(ministerio);
    const novos = jaEsta
      ? (usuario.ministerios ?? []).filter((m) => m !== ministerio)
      : [...(usuario.ministerios ?? []), ministerio];
    setSalvando(true);
    await supabase.from("perfis").update({ ministerios: novos }).eq("id", usuario.id);
    setSalvando(false);
    // Atualiza localmente sem recarregar a lista inteira
    usuario.ministerios = novos;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{MINISTERIOS_LISTA.length} ministérios</p>
        <p className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">Os ministérios são definidos no sistema</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MINISTERIOS_LISTA.map((min) => {
          const membros = usuarios.filter((u) => u.ministerios?.includes(min));
          const isEditing = editandoMin === min;
          return (
            <div key={min} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-black">
                <span className="font-semibold text-white">{min}</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`/dashboard/ministerio/${encodeURIComponent(min)}`}
                    className="text-white/80 hover:text-white text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" /> Canal
                  </a>
                  <button
                    onClick={() => setEditandoMin(isEditing ? null : min)}
                    className="text-white/80 hover:text-white text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                  >
                    <Users className="w-3 h-3" /> {isEditing ? "Fechar" : "Membros"}
                  </button>
                </div>
              </div>
              <div className="px-5 py-4">
                {!isEditing ? (
                  <>
                    <p className="text-xs text-gray-400 mb-2">{membros.length} membro{membros.length !== 1 ? "s" : ""}</p>
                    {membros.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {membros.map((u) => (
                          <span key={u.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {u.nome.split(" ")[0]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-300 italic">Nenhum membro atribuído</p>
                    )}
                  </>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    <p className="text-xs text-gray-500 mb-2">Selecione os membros deste ministério:</p>
                    {usuarios.map((u) => {
                      const jaEsta = u.ministerios?.includes(min);
                      return (
                        <label key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!jaEsta}
                            disabled={salvando}
                            onChange={() => toggleMembro(u, min)}
                            className="accent-black w-4 h-4"
                          />
                          <span className="text-sm text-gray-700">{u.nome}</span>
                          <span className="text-xs text-gray-400 capitalize ml-auto">{u.role}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Painel de edição de usuário ──────────────────────────────────

function EditarUsuarioPanel({
  usuario, euSouEle, podeatribuir, onChange, onRemover, onFechar,
}: {
  usuario: User;
  euSouEle: boolean;
  podeatribuir: boolean;
  onChange: (dados: Partial<User>) => void;
  onRemover: () => void;
  onFechar: () => void;
}) {
  const permAtivas = permissoesEfetivas(usuario);
  const temCustom  = !!usuario.permissoes;

  const [novaSenha, setNovaSenha]           = useState("");
  const [showNovaSenha, setShowNovaSenha]   = useState(false);
  const [salvandoSenha, setSalvandoSenha]   = useState(false);
  const [erroSenha, setErroSenha]           = useState("");
  const [okSenha, setOkSenha]               = useState(false);

  async function trocarSenha() {
    if (novaSenha.length < 6) { setErroSenha("Mínimo 6 caracteres."); return; }
    setErroSenha(""); setSalvandoSenha(true); setOkSenha(false);
    const res = await fetch("/api/alterar-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuario.id, novaSenha }),
    });
    const json = await res.json().catch(() => ({}));
    setSalvandoSenha(false);
    if (res.ok) { setOkSenha(true); setNovaSenha(""); setTimeout(() => setOkSenha(false), 3000); }
    else setErroSenha(json.error ?? "Erro ao alterar senha.");
  }

  function togglePermissao(p: Permissao) {
    const base = permissoesEfetivas(usuario);
    const nova  = base.includes(p) ? base.filter((x) => x !== p) : [...base, p];
    onChange({ permissoes: nova });
  }

  function resetarPermissoes() {
    onChange({ permissoes: undefined });
  }

  function toggleAtivo() {
    onChange({ ativo: !usuario.ativo });
  }

  function mudarRole(role: Role) {
    // Ao mudar o role, reseta as permissões custom para herdar o novo default
    onChange({ role, permissoes: undefined });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gray-100 text-gray-900 rounded-full flex items-center justify-center font-bold text-sm">
            {usuario.nome.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate text-sm">{usuario.nome}</p>
            <p className="text-xs text-gray-400 truncate">{usuario.email}</p>
          </div>
        </div>
        <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 transition p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
        {euSouEle && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Você está editando sua própria conta.
          </div>
        )}

        {/* Role */}
        {podeatribuir && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Role</p>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => mudarRole(r)}
                  className={clsx(
                    "text-xs font-semibold px-3 py-1.5 rounded-full border transition",
                    usuario.role === r
                      ? ROLE_COR[r]
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  )}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Mudar o role redefine as permissões para o padrão do novo role.
            </p>
          </div>
        )}

        {/* Ministérios */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ministérios</p>
          <div className="flex flex-wrap gap-1.5">
            {MINISTERIOS.map((m) => {
              const ativo = usuario.ministerios.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => onChange({
                    ministerios: ativo
                      ? usuario.ministerios.filter((x) => x !== m)
                      : [...usuario.ministerios, m],
                  })}
                  disabled={!podeatribuir}
                  className={clsx(
                    "text-xs px-2.5 py-1 rounded-full border transition",
                    ativo
                      ? "bg-gray-100 text-gray-900 border-gray-200 font-medium"
                      : "border-gray-200 text-gray-400 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Líder de Ministérios */}
        {podeatribuir && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Líder de Ministério</p>
            <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
              Dá privilégios de organização (escala, membros, eventos, avisos) dentro do ministério, independente do role global.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MINISTERIOS.map((m) => {
                const eLider = (usuario.liderMinisterios ?? []).includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => onChange({
                      liderMinisterios: eLider
                        ? (usuario.liderMinisterios ?? []).filter((x) => x !== m)
                        : [...(usuario.liderMinisterios ?? []), m],
                    })}
                    className={clsx(
                      "text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1",
                      eLider
                        ? "bg-gold-100 text-gold-800 border-gold-300 font-semibold"
                        : "border-gray-200 text-gray-400 hover:border-gold-300 hover:text-gold-700"
                    )}
                  >
                    {eLider && <ShieldCheck className="w-3 h-3" />}
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Permissões individuais */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissões</p>
            {temCustom && (
              <button
                onClick={resetarPermissoes}
                className="flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-800 transition font-medium"
                title="Resetar para o padrão do role"
              >
                <RotateCcw className="w-3 h-3" /> Resetar para padrão
              </button>
            )}
          </div>
          {temCustom && (
            <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-3">
              ⚠ Permissões customizadas — difere do padrão do role.
            </p>
          )}

          {GRUPOS_PERMISSAO.map((grupo) => {
            const permsDoGrupo = TODAS_PERMISSOES.filter(
              (p) => PERMISSAO_LABEL[p].grupo === grupo
            );
            return (
              <div key={grupo} className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">{grupo}</p>
                <div className="space-y-1.5">
                  {permsDoGrupo.map((p) => {
                    const ativa = permAtivas.includes(p);
                    const defaultRole = DEFAULTS_POR_ROLE[usuario.role].includes(p);
                    const diferente  = temCustom && ativa !== defaultRole;
                    return (
                      <button
                        key={p}
                        onClick={() => podeatribuir && togglePermissao(p)}
                        disabled={!podeatribuir}
                        className={clsx(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition text-[12px]",
                          ativa
                            ? "bg-gray-50 border-gray-200 text-gray-900"
                            : "bg-gray-50 border-gray-150 text-gray-400",
                          podeatribuir && "hover:opacity-80 cursor-pointer",
                          !podeatribuir && "cursor-default opacity-70",
                          diferente && "ring-1 ring-amber-300"
                        )}
                      >
                        <div className={clsx(
                          "w-4 h-4 rounded flex items-center justify-center shrink-0 border transition",
                          ativa ? "bg-black border-gray-900 text-white" : "border-gray-300 bg-white"
                        )}>
                          {ativa && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{PERMISSAO_LABEL[p].label}</span>
                          <p className="text-[10px] text-gray-400 leading-tight mt-0.5 line-clamp-1">
                            {PERMISSAO_LABEL[p].descricao}
                          </p>
                        </div>
                        {diferente && <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full shrink-0">custom</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Trocar senha */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Trocar senha</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showNovaSenha ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => { setNovaSenha(e.target.value); setErroSenha(""); setOkSenha(false); }}
                placeholder="Nova senha (mín. 6 caracteres)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowNovaSenha((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={trocarSenha}
              disabled={salvandoSenha || !novaSenha}
              className={clsx(
                "px-3 py-2 rounded-xl text-sm font-semibold border transition whitespace-nowrap",
                okSenha
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100 disabled:opacity-50"
              )}
            >
              {salvandoSenha ? "..." : okSenha ? "Salvo!" : "Salvar"}
            </button>
          </div>
          {erroSenha && <p className="text-xs text-red-500 mt-1">{erroSenha}</p>}
        </div>

        {/* Ações */}
        <div className="border-t border-gray-100 pt-4 flex gap-2">
          <button
            onClick={toggleAtivo}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl border transition",
              usuario.ativo
                ? "border-red-200 text-red-500 hover:bg-red-50"
                : "border-green-200 text-green-600 hover:bg-green-50"
            )}
          >
            <Power className="w-3.5 h-3.5" />
            {usuario.ativo ? "Desativar" : "Ativar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Formulário de novo usuário ───────────────────────────────────

function gerarSenha() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "Ramo@" + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function NovoUsuarioForm({
  onCriar, onCancelar,
}: {
  onCriar: (dados: Omit<User, "id">, senha: string) => Promise<{ ok: true } | { error: string }>;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", role: "membro" as Role,
    ministerios: [] as Ministerio[], ativo: true,
  });
  const [senha, setSenha]           = useState(gerarSenha);
  const [showSenha, setShowSenha]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [erro, setErro]             = useState("");
  const [criado, setCriado]         = useState<{ email: string; senha: string } | null>(null);
  const [copiado, setCopiado]       = useState(false);

  async function submeter() {
    if (!form.nome.trim() || !form.email.trim() || !senha) return;
    setErro(""); setLoading(true);
    const result = await onCriar({
      nome:        form.nome.trim(),
      email:       form.email.trim(),
      telefone:    form.telefone.trim() || undefined,
      role:        form.role,
      ministerios: form.ministerios,
      ativo:       true,
      dataIngresso: new Date().toISOString().split("T")[0],
    }, senha);
    setLoading(false);
    if ("ok" in result) {
      setCriado({ email: form.email.trim(), senha });
    } else {
      setErro(result.error);
    }
  }

  function copiar() {
    navigator.clipboard.writeText(`E-mail: ${criado!.email}\nSenha: ${criado!.senha}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300";

  // ── Tela de sucesso: exibe credenciais ──
  if (criado) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <p className="font-semibold text-gray-800 text-sm">Usuário criado!</p>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">
            Compartilhe as credenciais abaixo com o membro para que ele possa fazer login.
          </p>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2 font-mono text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-gray-400 text-xs">E-mail</span>
              <span className="text-gray-800 text-xs font-semibold break-all text-right">{criado.email}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-400 text-xs">Senha</span>
              <span className="text-gray-800 text-xs font-semibold">{criado.senha}</span>
            </div>
          </div>
          <button
            onClick={copiar}
            className={clsx(
              "w-full py-2.5 rounded-xl text-sm font-semibold transition border",
              copiado
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100"
            )}
          >
            {copiado ? "Copiado!" : "Copiar credenciais"}
          </button>
          <button
            onClick={onCancelar}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-gray-900" />
          <p className="font-semibold text-gray-800 text-sm">Novo usuário</p>
        </div>
        <button onClick={onCancelar} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-3">
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Nome completo *"
            className={inputCls}
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="E-mail *"
            type="email"
            className={inputCls}
          />
          <input
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            placeholder="Telefone"
            className={inputCls}
          />
          {/* Campo de senha com geração automática */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Senha inicial</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  type={showSenha ? "text" : "password"}
                  placeholder="Senha *"
                  minLength={6}
                  className={inputCls + " pr-9"}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setSenha(gerarSenha()); setShowSenha(true); }}
                className="text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition shrink-0"
                title="Gerar senha aleatória"
              >
                Gerar
              </button>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Role inicial</p>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setForm({ ...form, role: r })}
                className={clsx(
                  "text-xs font-semibold px-3 py-1.5 rounded-full border transition",
                  form.role === r ? ROLE_COR[r] : "border-gray-200 text-gray-400"
                )}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ministérios</p>
          <div className="flex flex-wrap gap-1.5">
            {MINISTERIOS.map((m) => {
              const ativo = form.ministerios.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => setForm({
                    ...form,
                    ministerios: ativo ? form.ministerios.filter((x) => x !== m) : [...form.ministerios, m],
                  })}
                  className={clsx(
                    "text-xs px-2.5 py-1 rounded-full border transition",
                    ativo
                      ? "bg-gray-100 text-gray-900 border-gray-200 font-medium"
                      : "border-gray-200 text-gray-400"
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          As permissões serão automaticamente definidas pelo role escolhido. Você pode customizá-las depois.
        </p>

        {erro && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{erro}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancelar}
            className="flex-1 text-sm text-gray-500 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={submeter}
            disabled={!form.nome || !form.email || !senha || loading}
            className="flex-1 text-sm bg-gray-900 text-white font-semibold py-2.5 rounded-xl hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Criando..." : "Criar usuário"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── TestePushPanel ───────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const TIPOS_PUSH = [
  { tipo: "aviso",  label: "📢 Aviso",        desc: "Broadcast para todos os usuários" },
  { tipo: "evento", label: "📅 Evento",       desc: "Broadcast para todos os usuários" },
  { tipo: "chat",   label: "💬 Chat",         desc: "Somente para você (logado)" },
  { tipo: "escala", label: "🎸 Escala",       desc: "Somente para você (logado)" },
] as const;

function TestePushPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [resultadoRegistro, setResultadoRegistro] = useState<{ ok: boolean; msg: string } | null>(null);

  async function registrarEsteDispositivo() {
    setRegistrando(true);
    setResultadoRegistro(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setResultadoRegistro({ ok: false, msg: "Este navegador não suporta Push. Use o PWA instalado no celular." });
        return;
      }
      if (!("Notification" in window)) {
        setResultadoRegistro({ ok: false, msg: "Notificações não disponíveis neste navegador." });
        return;
      }

      let permission = Notification.permission;
      if (permission === "denied") {
        setResultadoRegistro({ ok: false, msg: "Permissão bloqueada. Vá em Configurações do navegador → Notificações e desbloqueie este site." });
        return;
      }
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        setResultadoRegistro({ ok: false, msg: "Permissão negada pelo usuário." });
        return;
      }

      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Service Worker demorou demais. Tente fechar e reabrir o PWA.")), 30000)
        ),
      ]);
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          setResultadoRegistro({ ok: false, msg: "NEXT_PUBLIC_VAPID_PUBLIC_KEY não disponível. Verifique as variáveis do Vercel e faça um novo deploy." });
          return;
        }
        // Passa Uint8Array diretamente (não .buffer) — exigido pela spec do Web Push
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as Uint8Array<ArrayBuffer>,
        });
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResultadoRegistro({ ok: false, msg: "Sessão expirada. Faça login novamente." });
        return;
      }

      // Valida e renova o token se estiver próximo do vencimento
      const expiresAt = session.expires_at ?? 0;
      let token = session.access_token;
      if (Date.now() / 1000 > expiresAt - 60) {
        const { data } = await supabase.auth.refreshSession();
        token = data.session?.access_token ?? "";
        if (!token) {
          setResultadoRegistro({ ok: false, msg: "Falha ao renovar sessão." });
          return;
        }
      }

      const key = sub.getKey("p256dh");
      const auth = sub.getKey("auth");
      if (!key || !auth) {
        setResultadoRegistro({ ok: false, msg: "Erro ao obter chaves da subscription." });
        return;
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
          auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setResultadoRegistro({ ok: false, msg: `Erro ${res.status}: ${d.error ?? "desconhecido"}` });
        return;
      }

      setResultadoRegistro({ ok: true, msg: "Dispositivo registrado com sucesso! Agora você pode testar." });
      // Atualiza o diagnóstico automaticamente
      verStatus();
    } catch (e) {
      setResultadoRegistro({ ok: false, msg: String(e).replace("Error: ", "") });
    } finally {
      setRegistrando(false);
    }
  }

  async function verStatus() {
    setLoadingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus({ erro: "Não autenticado" });
        return;
      }

      // Valida e renova o token se estiver próximo do vencimento
      const expiresAt = session.expires_at ?? 0;
      let token = session.access_token;
      if (Date.now() / 1000 > expiresAt - 60) {
        const { data } = await supabase.auth.refreshSession();
        token = data.session?.access_token ?? "";
        if (!token) {
          setStatus({ erro: "Falha ao renovar sessão" });
          return;
        }
      }

      const res = await fetch("/api/push/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(await res.json());
    } catch {
      setStatus({ erro: "Falha ao buscar status" });
    } finally {
      setLoadingStatus(false);
    }
  }

  async function testar(tipo: string) {
    setLoading(tipo);
    setResultado(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setResultado({ ok: false, msg: "Não autenticado" });
        return;
      }

      // Valida e renova o token se estiver próximo do vencimento
      const expiresAt = session.expires_at ?? 0;
      let token = session.access_token;
      if (Date.now() / 1000 > expiresAt - 60) {
        const { data } = await supabase.auth.refreshSession();
        token = data.session?.access_token ?? "";
        if (!token) {
          setResultado({ ok: false, msg: "Falha ao renovar sessão" });
          return;
        }
      }

      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tipo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResultado({ ok: false, msg: data.error ?? "Erro desconhecido" });
      } else {
        const destino = data.enviado === "broadcast" ? `${data.subscriptions} dispositivo(s)` : "seu dispositivo";
        setResultado({ ok: true, msg: `Notificação "${tipo}" enviada para ${destino}!` });
      }
    } catch {
      setResultado({ ok: false, msg: "Falha na requisição" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-vine-700" />
        <h2 className="font-semibold text-gray-900 text-sm">Testar Notificações Push</h2>
      </div>

      {/* Passo 1: registrar */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
        <p className="text-xs font-semibold text-gray-700 mb-1">Passo 1 — Registrar este dispositivo</p>
        <p className="text-[11px] text-gray-400 mb-2 leading-snug">
          Clique abaixo para registrar o dispositivo atual (celular/PC). Repita em cada aparelho que quiser receber notificações.
        </p>
        <button
          onClick={registrarEsteDispositivo}
          disabled={registrando}
          className="flex items-center gap-1.5 bg-vine-700 hover:bg-vine-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Bell className="w-3.5 h-3.5" />
          {registrando ? "Registrando…" : "Registrar este dispositivo"}
        </button>
        {resultadoRegistro && (
          <div className={clsx(
            "mt-2 text-[11px] px-2.5 py-1.5 rounded-lg flex items-start gap-1.5",
            resultadoRegistro.ok
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          )}>
            {resultadoRegistro.ok ? <Check className="w-3 h-3 mt-0.5 shrink-0" /> : <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />}
            {resultadoRegistro.msg}
          </div>
        )}
      </div>

      {/* Passo 2: testar */}
      <p className="text-xs font-semibold text-gray-700 mb-2">Passo 2 — Disparar notificação de teste</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TIPOS_PUSH.map(({ tipo, label, desc }) => (
          <button
            key={tipo}
            onClick={() => testar(tipo)}
            disabled={loading !== null}
            className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-vine-50 hover:border-vine-300 transition text-left disabled:opacity-50"
          >
            <span className="text-sm font-medium text-gray-800">{label}</span>
            <span className="text-[11px] text-gray-400 leading-tight">{desc}</span>
            {loading === tipo && (
              <span className="text-[11px] text-vine-600 font-medium">Enviando…</span>
            )}
          </button>
        ))}
      </div>

      {resultado && (
        <div className={clsx(
          "mt-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2",
          resultado.ok
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        )}>
          {resultado.ok ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
          {resultado.msg}
        </div>
      )}

      {/* Diagnóstico */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <button
          onClick={verStatus}
          disabled={loadingStatus}
          className="text-xs text-vine-700 underline underline-offset-2 hover:text-vine-900 disabled:opacity-50"
        >
          {loadingStatus ? "Verificando…" : "🔍 Ver diagnóstico do sistema"}
        </button>

        {status && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3 text-[11px] text-gray-700 font-mono space-y-0.5">
            {Object.entries(status).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-400 shrink-0">{k}:</span>
                <span className={clsx(
                  v === true ? "text-green-600" : v === false ? "text-red-500" : v === 0 ? "text-amber-600" : "text-gray-700"
                )}>
                  {JSON.stringify(v)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LocaisTab ────────────────────────────────────────────────────────────────

function LocaisTab() {
  const [locais, setLocais] = useState<Local[]>([]);
  const [editandoLocal, setEditandoLocal] = useState<Local | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novaDesc, setNovaDesc] = useState("");
  const [adicionando, setAdicionando] = useState(false);

  useEffect(() => {
    supabase
      .from("locais")
      .select()
      .then(({ data }) => {
        if (data) setLocais(data);
      });
  }, []);

  // Aviso fixado — persiste em Supabase
  const [avisoConteudo, setAvisoConteudo] = useState<string>("");
  const [avisoAtivo, setAvisoAtivo] = useState<boolean>(false);
  const [avisoSalvo, setAvisoSalvo] = useState(false);
  const [avisoId, setAvisoId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("aviso_fixado")
      .select()
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAvisoConteudo(data[0].conteudo ?? "");
          setAvisoAtivo(data[0].ativo ?? false);
          setAvisoId(data[0].id);
        }
      });
  }, []);

  function salvarAviso() {
    if (avisoId) {
      supabase.from("aviso_fixado").update({ conteudo: avisoConteudo, ativo: avisoAtivo, atualizado_em: new Date().toISOString() }).eq("id", avisoId).then(() => {});
    } else {
      supabase.from("aviso_fixado").insert({ conteudo: avisoConteudo, ativo: avisoAtivo }).select().single().then(({ data }) => {
        if (data) setAvisoId(data.id);
      });
    }
    setAvisoSalvo(true);
    setTimeout(() => setAvisoSalvo(false), 2000);
  }

  function toggleAvisoAtivo() {
    const novoAtivo = !avisoAtivo;
    setAvisoAtivo(novoAtivo);
    if (avisoId) {
      supabase.from("aviso_fixado").update({ ativo: novoAtivo }).eq("id", avisoId).then(() => {});
    }
  }

  function adicionarLocal() {
    if (!novoNome.trim()) return;
    supabase
      .from("locais")
      .insert({ nome: novoNome.trim(), descricao: novaDesc.trim() || null })
      .select()
      .single()
      .then(({ data }) => {
        if (data) setLocais((prev) => [...prev, data]);
      });
    setNovoNome(""); setNovaDesc(""); setAdicionando(false);
  }

  function salvarEdicao() {
    if (!editandoLocal || !editandoLocal.nome.trim()) return;
    supabase.from("locais").update({ nome: editandoLocal.nome, descricao: editandoLocal.descricao }).eq("id", editandoLocal.id).then(() => {});
    setLocais((prev) => prev.map((l) => l.id === editandoLocal.id ? editandoLocal : l));
    setEditandoLocal(null);
  }

  function removerLocal(id: string) {
    supabase.from("locais").delete().eq("id", id).then(() => {});
    setLocais((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Aviso fixado ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-amber-500" />
            <p className="font-semibold text-gray-800 text-sm">Aviso Fixado no Dashboard</p>
          </div>
          <button
            onClick={toggleAvisoAtivo}
            className={clsx(
              "flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition",
              avisoAtivo
                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
            )}
          >
            {avisoAtivo ? <><Check className="w-3 h-3" /> Ativo</> : <><X className="w-3 h-3" /> Inativo</>}
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed">
            Quando ativo, aparece como banner fixado no topo do dashboard para todos os usuários.
            Deixe em branco ou inativo se não quiser exibir.
          </p>
          <textarea
            value={avisoConteudo}
            onChange={(e) => setAvisoConteudo(e.target.value)}
            placeholder="Ex: 📌 Ensaio às 17h. Confirmar presença com Pedro."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none placeholder:text-gray-300"
          />
          <div className="flex items-center justify-between">
            {avisoSalvo && (
              <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Salvo com sucesso
              </span>
            )}
            <button
              onClick={salvarAviso}
              className="ml-auto flex items-center gap-1.5 bg-black text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-900 transition"
            >
              <Save className="w-3.5 h-3.5" /> Salvar aviso
            </button>
          </div>
        </div>
      </div>

      {/* ── Locais ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-800" />
            <p className="font-semibold text-gray-800 text-sm">Locais Cadastrados</p>
            <span className="text-xs bg-gray-100 text-gray-900 font-bold px-2 py-0.5 rounded-full">{locais.length}</span>
          </div>
          <button
            onClick={() => setAdicionando(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Novo local
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {locais.map((local) => (
            <div key={local.id} className="px-5 py-3.5">
              {editandoLocal?.id === local.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={editandoLocal.nome}
                    onChange={(e) => setEditandoLocal({ ...editandoLocal, nome: e.target.value })}
                    className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-gray-400"
                    placeholder="Nome do local"
                    autoFocus
                  />
                  <input
                    value={editandoLocal.descricao ?? ""}
                    onChange={(e) => setEditandoLocal({ ...editandoLocal, descricao: e.target.value })}
                    className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-gray-400"
                    placeholder="Descrição (opcional)"
                  />
                  <button onClick={salvarEdicao} className="text-green-700 hover:text-green-900 transition">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditandoLocal(null)} className="text-gray-400 hover:text-gray-600 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{local.nome}</p>
                      {local.descricao && <p className="text-xs text-gray-400 truncate">{local.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditandoLocal(local)}
                      className="text-gray-300 hover:text-gray-800 transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removerLocal(local.id)}
                      className="text-gray-300 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Formulário de novo local */}
          {adicionando && (
            <div className="px-5 py-3.5 bg-gray-50/50 flex items-center gap-2 flex-wrap border-t border-gray-100">
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-gray-400 bg-white"
                placeholder="Nome do local *"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && adicionarLocal()}
              />
              <input
                value={novaDesc}
                onChange={(e) => setNovaDesc(e.target.value)}
                className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-gray-400 bg-white"
                placeholder="Descrição (opcional)"
                onKeyDown={(e) => e.key === "Enter" && adicionarLocal()}
              />
              <button onClick={adicionarLocal} className="text-green-700 hover:text-green-900 transition">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setAdicionando(false); setNovoNome(""); setNovaDesc(""); }} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {locais.length === 0 && !adicionando && (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              Nenhum local cadastrado. Clique em &quot;Novo local&quot; para adicionar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ConteudoTab ──────────────────────────────────────────────────────────────

interface Aviso { id: string; titulo: string; conteudo: string; criado_em: string; destinatarios: string | string[]; visivel_home: boolean; ministerios?: string[] | null; }
type DevocionalBloco =
  | { id: string; tipo: "texto"; texto: string }
  | { id: string; tipo: "imagem"; url: string; legenda?: string }
  | { id: string; tipo: "video"; url: string; legenda?: string }
  | { id: string; tipo: "citacao"; texto: string; referencia?: string }
  | { id: string; tipo: "separador" };
interface DevocionalForm { titulo: string; subtitulo: string; conteudo: string; versiculo: string; referencia: string; imagem_url: string; data: string; ativo: boolean; blocos: DevocionalBloco[]; }
interface Devocional { id: string; titulo: string; subtitulo: string | null; conteudo: string; versiculo: string | null; referencia: string | null; imagem_url: string | null; data: string; ativo: boolean; blocos?: DevocionalBloco[]; "versículo"?: string | null; }

function criarBlocoDevocional(tipo: DevocionalBloco["tipo"]): DevocionalBloco {
  const id = `bloco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (tipo === "imagem") return { id, tipo, url: "", legenda: "" };
  if (tipo === "video") return { id, tipo, url: "", legenda: "" };
  if (tipo === "citacao") return { id, tipo, texto: "", referencia: "" };
  if (tipo === "separador") return { id, tipo };
  return { id, tipo: "texto", texto: "" };
}

function parseBlocosDevocional(conteudo: string): DevocionalBloco[] {
  try {
    const parsed = JSON.parse(conteudo) as { versao?: number; blocos?: DevocionalBloco[] };
    if (parsed.versao === 1 && Array.isArray(parsed.blocos)) return parsed.blocos;
  } catch {
    // Conteúdo antigo em texto puro.
  }
  if (conteudo.trim()) {
    const b = criarBlocoDevocional("texto");
    return [b.tipo === "texto" ? { ...b, texto: conteudo } : b];
  }
  return [criarBlocoDevocional("texto")];
}

function limparBlocosDevocional(blocos: DevocionalBloco[]) {
  return blocos.filter((bloco) => {
    if (bloco.tipo === "texto" || bloco.tipo === "citacao") return bloco.texto.trim();
    if (bloco.tipo === "imagem" || bloco.tipo === "video") return bloco.url.trim();
    return true;
  });
}

function serializarBlocosDevocional(blocos: DevocionalBloco[]) {
  return JSON.stringify({ versao: 1, blocos: limparBlocosDevocional(blocos) });
}

function normalizarDevocional(raw: Devocional): Devocional {
  const versiculo = raw.versiculo ?? raw["versículo"] ?? null;
  return { ...raw, versiculo, blocos: parseBlocosDevocional(raw.conteudo) };
}

function resumoDevocional(dev: Devocional) {
  const blocos = dev.blocos ?? parseBlocosDevocional(dev.conteudo);
  const texto = blocos.find((bloco) => bloco.tipo === "texto" && bloco.texto.trim());
  if (texto?.tipo === "texto") return texto.texto;
  const midia = blocos.find((bloco) => bloco.tipo === "imagem" || bloco.tipo === "video");
  if (midia?.tipo === "imagem") return "Devocional com imagem";
  if (midia?.tipo === "video") return "Devocional com vídeo";
  return "Conteúdo personalizado";
}

function youtubeEmbedUrlDevocional(url: string) {
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

function isDirectVideoUrlDevocional(url: string) {
  try {
    return /\.(mp4|webm|mov|avi)(\?|$)/i.test(new URL(url).pathname);
  } catch {
    return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
  }
}

function formatarDataDevocional(data: string) {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function DevocionalBlocosPreview({ blocos }: { blocos: DevocionalBloco[] }) {
  return (
    <div className="space-y-5">
      {limparBlocosDevocional(blocos).map((bloco) => {
        if (bloco.tipo === "texto") {
          return <div key={bloco.id} className="text-gray-700 text-base leading-relaxed whitespace-pre-line">{bloco.texto}</div>;
        }

        if (bloco.tipo === "imagem") {
          return (
            <figure key={bloco.id} className="space-y-2">
              <div className="relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 aspect-[16/9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bloco.url} alt={bloco.legenda || "Imagem do devocional"} className="h-full w-full object-cover" />
              </div>
              {bloco.legenda && <figcaption className="text-xs text-gray-400 text-center">{bloco.legenda}</figcaption>}
            </figure>
          );
        }

        if (bloco.tipo === "video") {
          const embedUrl = youtubeEmbedUrlDevocional(bloco.url);
          return (
            <figure key={bloco.id} className="space-y-2">
              <div className="relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-950 aspect-video">
                {isDirectVideoUrlDevocional(bloco.url) ? (
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
            <blockquote key={bloco.id} className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4">
              <Quote className="w-5 h-5 text-gray-400 mb-2" />
              <p className="text-black italic leading-relaxed">{bloco.texto}</p>
              {bloco.referencia && <cite className="text-gray-800 text-sm not-italic font-semibold mt-2 block">{bloco.referencia}</cite>}
            </blockquote>
          );
        }

        return <hr key={bloco.id} className="border-gray-100" />;
      })}
    </div>
  );
}

function DevocionalPreviewModal({ dev, onClose }: { dev: Devocional | DevocionalForm; onClose: () => void }) {
  const blocos = dev.blocos ?? parseBlocosDevocional(dev.conteudo);
  const titulo = dev.titulo.trim() || "Título do devocional";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-cream shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-black px-4 py-4 text-white">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gold-400" />
            <span className="font-semibold text-base">Devocional Diário</span>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mx-auto max-w-2xl px-4 py-10">
          <article className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            {dev.imagem_url ? (
              <div className="relative h-52 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dev.imagem_url} alt={titulo} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                <BookOpen className="w-12 h-12 text-white/30" />
              </div>
            )}

            <div className="space-y-5 p-7">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span className="capitalize">{formatarDataDevocional(dev.data)}</span>
              </div>

              <div>
                <h1 className="text-2xl font-bold leading-tight text-gray-900">{titulo}</h1>
                {dev.subtitulo && <p className="mt-1 text-sm text-gray-500">{dev.subtitulo}</p>}
              </div>

              <DevocionalBlocosPreview blocos={blocos} />

              {dev.versiculo && (
                <blockquote className="border-l-4 border-gray-400 py-1 pl-4">
                  <p className="text-base italic leading-relaxed text-gray-900">&ldquo;{dev.versiculo}&rdquo;</p>
                  {dev.referencia && <cite className="mt-1 block text-sm font-semibold not-italic text-gray-600">— {dev.referencia}</cite>}
                </blockquote>
              )}
            </div>
          </article>

          <div className="mt-8 text-center text-xs text-gray-400">Igreja Ramo da Vida · Devocional Diário</div>
        </div>
      </div>
    </div>
  );
}

function ConteudoTab({ initSecao }: { initSecao?: string }) {
  const [secao, setSecao] = useState<"avisos" | "devocional">(
    initSecao === "devocional" ? "devocional" : "avisos"
  );

  // ── Avisos ──
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const novoAvisoInicial = () => ({ titulo: "", conteudo: "", visivelHome: false, destinatariosTodos: true, rolesSel: [] as Role[], ministerios: [] as Ministerio[] });
  const [novoAviso, setNovoAviso] = useState(novoAvisoInicial);
  const [adicionandoAviso, setAdicionandoAviso] = useState(false);
  const [salvandoAviso, setSalvandoAviso] = useState(false);
  const [erroAviso, setErroAviso] = useState<string | null>(null);
  const [editandoAvisoId, setEditandoAvisoId] = useState<string | null>(null);
  const [editAviso, setEditAviso] = useState(novoAvisoInicial);
  const [salvandoEdicaoAviso, setSalvandoEdicaoAviso] = useState(false);
  const [erroEdicaoAviso, setErroEdicaoAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("avisos").select("id,titulo,conteudo,criado_em,destinatarios,visivel_home,ministerios").order("criado_em", { ascending: false }).limit(30).then(({ data, error }) => {
      if (error) console.error("avisos fetch:", error);
      if (data) setAvisos(data as Aviso[]);
    });
  }, []);

  async function criarAviso() {
    if (!novoAviso.titulo.trim() || !novoAviso.conteudo.trim()) return;
    if (!novoAviso.visivelHome && !novoAviso.destinatariosTodos && novoAviso.rolesSel.length === 0) {
      setErroAviso("Selecione ao menos um destinatário no dashboard ou marque para exibir na página inicial.");
      return;
    }
    setErroAviso(null);
    setSalvandoAviso(true);
    const destinatarios = novoAviso.destinatariosTodos ? "todos" : novoAviso.rolesSel;

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tempo esgotado — verifique a conexão ou as políticas RLS no Supabase")), 8000)
    );

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setErroAviso("Sessão expirada — faça login novamente");
        return;
      }

      const query = supabase.from("avisos").insert({
        titulo: novoAviso.titulo.trim(),
        conteudo: novoAviso.conteudo.trim(),
        destinatarios: destinatarios,
        visivel_home: novoAviso.visivelHome,
        ministerios: novoAviso.ministerios,
      });

      const { error } = await Promise.race([query, timeout]) as Awaited<typeof query>;

      if (error) {
        console.error("Erro ao criar aviso:", error);
        setErroAviso(`${error.message} (code: ${error.code})`);
      } else {
        const { data: lista } = await supabase
          .from("avisos")
          .select("id,titulo,conteudo,criado_em,destinatarios,visivel_home,ministerios")
          .order("criado_em", { ascending: false })
          .limit(30);
        if (lista) setAvisos(lista as Aviso[]);
        setNovoAviso(novoAvisoInicial());
        setAdicionandoAviso(false);
        // Push para todos os membros — aguarda para garantir envio
        await notificarBroadcast({ tipo: "aviso", titulo: novoAviso.titulo.trim() });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Exceção ao criar aviso:", e);
      setErroAviso(msg);
    } finally {
      setSalvandoAviso(false);
    }
  }

  function removerAviso(id: string) {
    supabase.from("avisos").delete().eq("id", id).then(() => {});
    setAvisos((prev) => prev.filter((a) => a.id !== id));
  }

  function abrirEdicaoAviso(a: Aviso) {
    const destTodos = a.destinatarios === "todos";
    setEditAviso({
      titulo: a.titulo,
      conteudo: a.conteudo,
      visivelHome: a.visivel_home,
      destinatariosTodos: destTodos,
      rolesSel: destTodos ? [] : ((a.destinatarios as Role[]) ?? []),
      ministerios: (a.ministerios ?? []) as Ministerio[],
    });
    setErroEdicaoAviso(null);
    setEditandoAvisoId(a.id);
  }

  async function salvarEdicaoAviso() {
    if (!editandoAvisoId) return;
    if (!editAviso.titulo.trim() || !editAviso.conteudo.trim()) return;
    if (!editAviso.visivelHome && !editAviso.destinatariosTodos && editAviso.rolesSel.length === 0) {
      setErroEdicaoAviso("Selecione ao menos um destinatário no dashboard ou marque para exibir na página inicial.");
      return;
    }
    setErroEdicaoAviso(null);
    setSalvandoEdicaoAviso(true);
    const destinatarios = editAviso.destinatariosTodos ? "todos" : editAviso.rolesSel;
    const { error } = await supabase.from("avisos").update({
      titulo: editAviso.titulo.trim(),
      conteudo: editAviso.conteudo.trim(),
      destinatarios,
      visivel_home: editAviso.visivelHome,
      ministerios: editAviso.ministerios,
    }).eq("id", editandoAvisoId);
    setSalvandoEdicaoAviso(false);
    if (error) {
      setErroEdicaoAviso(error.message);
    } else {
      setAvisos((prev) => prev.map((a) => a.id === editandoAvisoId ? {
        ...a,
        titulo: editAviso.titulo.trim(),
        conteudo: editAviso.conteudo.trim(),
        destinatarios,
        visivel_home: editAviso.visivelHome,
        ministerios: editAviso.ministerios,
      } : a));
      setEditandoAvisoId(null);
    }
  }

  // ── Devocional ──
  const [devs, setDevs] = useState<Devocional[]>([]);
  const novoDevInicial = (): DevocionalForm => ({ titulo: "", subtitulo: "", conteudo: "", versiculo: "", referencia: "", imagem_url: "", data: new Date().toISOString().slice(0, 10), ativo: true, blocos: [criarBlocoDevocional("texto")] });
  const [novoDev, setNovoDev] = useState(novoDevInicial);
  const [adicionandoDev, setAdicionandoDev] = useState(false);
  const [salvandoDev, setSalvandoDev] = useState(false);
  const [editandoDev, setEditandoDev] = useState<Devocional | null>(null);
  const [previewDevOpen, setPreviewDevOpen] = useState(false);
  const [uploadingBlocoId, setUploadingBlocoId] = useState<string | null>(null);
  const [uploadingCapaDev, setUploadingCapaDev] = useState(false);
  const [erroUploadDev, setErroUploadDev] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("devocionais").select().order("data", { ascending: false }).limit(20).then(({ data }) => {
      if (data) setDevs((data as Devocional[]).map(normalizarDevocional));
    });
  }, []);

  async function criarDevocional() {
    const blocos = limparBlocosDevocional(novoDev.blocos);
    if (!novoDev.titulo.trim() || blocos.length === 0) return;
    setSalvandoDev(true);
    const { data } = await supabase.from("devocionais").insert({
      titulo: novoDev.titulo.trim(),
      subtitulo: novoDev.subtitulo.trim() || null,
      conteudo: serializarBlocosDevocional(blocos),
      "versículo": novoDev.versiculo.trim() || null,
      referencia: novoDev.referencia.trim() || null,
      imagem_url: novoDev.imagem_url.trim() || null,
      data: novoDev.data,
      ativo: novoDev.ativo,
    }).select().single();
    if (data) setDevs((prev) => [normalizarDevocional(data as Devocional), ...prev]);
    setNovoDev(novoDevInicial());
    setAdicionandoDev(false);
    setSalvandoDev(false);
  }

  async function salvarEdicaoDev() {
    if (!editandoDev) return;
    const blocos = limparBlocosDevocional(editandoDev.blocos ?? parseBlocosDevocional(editandoDev.conteudo));
    if (!editandoDev.titulo.trim() || blocos.length === 0) return;
    const atualizado = { ...editandoDev, conteudo: serializarBlocosDevocional(blocos), blocos };
    setSalvandoDev(true);
    await supabase.from("devocionais").update({
      titulo: atualizado.titulo.trim(),
      subtitulo: atualizado.subtitulo || null,
      conteudo: atualizado.conteudo,
      "versículo": atualizado.versiculo || null,
      referencia: atualizado.referencia || null,
      imagem_url: atualizado.imagem_url || null,
      data: atualizado.data,
      ativo: atualizado.ativo,
    }).eq("id", editandoDev.id);
    setDevs((prev) => prev.map((d) => d.id === editandoDev.id ? atualizado : d));
    setEditandoDev(null);
    setSalvandoDev(false);
  }

  function iniciarEdicaoDev(dev: Devocional) {
    setAdicionandoDev(false);
    setEditandoDev({ ...dev, blocos: dev.blocos ?? parseBlocosDevocional(dev.conteudo) });
  }

  function removerDev(id: string) {
    supabase.from("devocionais").delete().eq("id", id).then(() => {});
    setDevs((prev) => prev.filter((d) => d.id !== id));
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-gray-50";
  const textareaCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-gray-50 resize-none";
  const devAtual = editandoDev ?? novoDev;
  const maxVideoBytes = 50 * 1024 * 1024;

  function atualizarDev(patch: Partial<DevocionalForm>) {
    if (editandoDev) setEditandoDev({ ...editandoDev, ...patch });
    else setNovoDev((prev) => ({ ...prev, ...patch }));
  }

  function atualizarBlocosDev(updater: (blocos: DevocionalBloco[]) => DevocionalBloco[]) {
    const blocosAtuais = devAtual.blocos ?? [criarBlocoDevocional("texto")];
    atualizarDev({ blocos: updater(blocosAtuais) });
  }

  function atualizarBlocoDev(index: number, patch: Partial<DevocionalBloco>) {
    atualizarBlocosDev((blocos) => blocos.map((bloco, i) => i === index ? { ...bloco, ...patch } as DevocionalBloco : bloco));
  }

  function adicionarBlocoDev(tipo: DevocionalBloco["tipo"]) {
    atualizarBlocosDev((blocos) => [...blocos, criarBlocoDevocional(tipo)]);
  }

  function moverBlocoDev(index: number, direcao: -1 | 1) {
    atualizarBlocosDev((blocos) => {
      const destino = index + direcao;
      if (destino < 0 || destino >= blocos.length) return blocos;
      const next = [...blocos];
      [next[index], next[destino]] = [next[destino], next[index]];
      return next;
    });
  }

  function removerBlocoDev(index: number) {
    atualizarBlocosDev((blocos) => {
      const next = blocos.filter((_, i) => i !== index);
      return next.length > 0 ? next : [criarBlocoDevocional("texto")];
    });
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function compactarImagemDevocional(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Selecione um arquivo de imagem"));
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compactada = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
          resolve(compactada.size < file.size ? compactada : file);
        }, "image/jpeg", 0.72);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Não foi possível ler a imagem"));
      };
      img.src = objectUrl;
    });
  }

  async function enviarComTimeout(endpoint: string, formData: FormData, token: string, timeoutMs = 45000) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });
      const json = await response.json().catch(() => ({} as { error?: string; url?: string }));
      if (!response.ok) throw new Error(json.error ?? "Falha ao enviar arquivo");
      if (!json.url) throw new Error("Upload concluído sem URL de retorno");
      return json as { url: string };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Tempo esgotado ao enviar. Tente uma imagem menor ou verifique a conexão.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function subirMidiaDevocional(index: number, file: File, tipo: "imagem" | "video") {
    const bloco = devAtual.blocos?.[index];
    if (!bloco || (bloco.tipo !== "imagem" && bloco.tipo !== "video")) return;

    setErroUploadDev(null);
    setUploadingBlocoId(bloco.id);
    try {
      if (tipo === "video" && file.size > maxVideoBytes) {
        throw new Error(`Vídeo muito grande (${formatBytes(file.size)}). Use até ${formatBytes(maxVideoBytes)}.`);
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada — faça login novamente");

      const arquivoFinal = tipo === "imagem" ? await compactarImagemDevocional(file) : file;
      const formData = new FormData();
      formData.append("file", arquivoFinal);
      formData.append("conversa_id", `devocional_${devAtual.data}`);

      const endpoint = tipo === "imagem" ? "/api/chat/upload-imagem" : "/api/chat/upload-arquivo";
      if (tipo === "video") formData.append("file_type", "video");

      const json = await enviarComTimeout(endpoint, formData, token, tipo === "video" ? 90000 : 45000);

      atualizarBlocoDev(index, { url: json.url });
    } catch (error) {
      setErroUploadDev(error instanceof Error ? error.message : "Erro ao enviar arquivo");
    } finally {
      setUploadingBlocoId(null);
    }
  }

  async function subirCapaDevocional(file: File) {
    setErroUploadDev(null);
    setUploadingCapaDev(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada — faça login novamente");

      const arquivoFinal = await compactarImagemDevocional(file);
      const formData = new FormData();
      formData.append("file", arquivoFinal);
      formData.append("conversa_id", `devocional_capa_${devAtual.data}`);

      const json = await enviarComTimeout("/api/chat/upload-imagem", formData, token);

      atualizarDev({ imagem_url: json.url });
    } catch (error) {
      setErroUploadDev(error instanceof Error ? error.message : "Erro ao enviar imagem");
    } finally {
      setUploadingCapaDev(false);
    }
  }

  return (
    <div className="space-y-4">

      {/* ── AVISOS ── */}
      {secao === "avisos" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Avisos</p>
              <p className="text-xs text-gray-400 mt-0.5">Controle quem vê cada aviso — página inicial, dashboard ou roles específicos</p>
            </div>
            <button onClick={() => setAdicionandoAviso(true)} disabled={adicionandoAviso} className="flex items-center gap-1.5 bg-black hover:bg-gray-900 text-white text-xs font-semibold px-3 py-2 rounded-xl transition disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Novo aviso
            </button>
          </div>

          {adicionandoAviso && (
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/30 space-y-3">
              <input className={inputCls} placeholder="Título do aviso" value={novoAviso.titulo} onChange={(e) => setNovoAviso((p) => ({ ...p, titulo: e.target.value }))} />
              <textarea className={textareaCls} rows={3} placeholder="Conteúdo do aviso..." value={novoAviso.conteudo} onChange={(e) => setNovoAviso((p) => ({ ...p, conteudo: e.target.value }))} />

              {/* Visibilidade */}
              <div className="space-y-3 pt-1 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">Visibilidade</p>

                {/* Home */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={novoAviso.visivelHome}
                    onChange={(e) => setNovoAviso((p) => ({ ...p, visivelHome: e.target.checked }))}
                    className="accent-black w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Exibir na página inicial do site</span>
                    <p className="text-xs text-gray-400">Visível para qualquer visitante, sem necessidade de login</p>
                  </div>
                </label>

                {/* Dashboard */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Quem vê no dashboard?</p>
                  <p className="text-[11px] text-gray-400">Pastores e admins sempre veem todos os avisos.</p>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={novoAviso.destinatariosTodos}
                      onChange={(e) => setNovoAviso((p) => ({ ...p, destinatariosTodos: e.target.checked, rolesSel: [] }))}
                      className="accent-black w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Todos os membros cadastrados</span>
                  </label>
                  {!novoAviso.destinatariosTodos && (
                    <div className="grid grid-cols-2 gap-1.5 ml-6">
                      {ROLES.filter((r) => r !== "admin" && r !== "pastor").map((role) => (
                        <label key={role} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={novoAviso.rolesSel.includes(role)}
                            onChange={(e) => setNovoAviso((p) => ({
                              ...p,
                              rolesSel: e.target.checked
                                ? [...p.rolesSel, role]
                                : p.rolesSel.filter((r) => r !== role),
                            }))}
                            className="accent-black w-4 h-4"
                          />
                          <span className="text-sm text-gray-700">{ROLE_LABEL[role]}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ministério específico */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Filtrar por ministério <span className="text-gray-300">(opcional)</span></p>
                  <p className="text-[11px] text-gray-400">Se selecionado, líderes/voluntários de outros ministérios não verão este aviso. Pode selecionar um ou mais.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MINISTERIOS.map((m) => {
                      const sel = novoAviso.ministerios.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setNovoAviso((p) => ({
                            ...p,
                            ministerios: sel ? p.ministerios.filter((x) => x !== m) : [...p.ministerios, m],
                          }))}
                          className={clsx(
                            "text-xs px-2.5 py-1 rounded-full border transition",
                            sel
                              ? "bg-gold-100 text-gold-800 border-gold-300 font-semibold"
                              : "bg-white text-gray-500 border-gray-200 hover:border-gold-200 hover:text-gold-700"
                          )}
                        >{m}</button>
                      );
                    })}
                  </div>
                  {novoAviso.ministerios.length === 0 && (
                    <p className="text-[11px] text-gray-400">Nenhum selecionado = visível para todos os ministérios</p>
                  )}
                </div>
              </div>

              {erroAviso && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erroAviso}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setAdicionandoAviso(false); setErroAviso(null); setNovoAviso(novoAvisoInicial()); }} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition">Cancelar</button>
                <button onClick={criarAviso} disabled={salvandoAviso} className="flex items-center gap-1.5 bg-black hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-60">
                  <Save className="w-3.5 h-3.5" /> {salvandoAviso ? "Publicando..." : "Publicar"}
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {avisos.map((a) => {
              const destLabel = (() => {
                if (a.destinatarios === "todos") return "Todos os membros";
                if (Array.isArray(a.destinatarios) && a.destinatarios.length > 0)
                  return (a.destinatarios as string[]).map((r) => ROLE_LABEL[r as Role] ?? r).join(", ");
                return "Apenas página inicial";
              })();
              const editando = editandoAvisoId === a.id;
              return (
                <div key={a.id} className={clsx("px-5 py-4", editando ? "bg-gray-50/40" : "hover:bg-gray-50/50")}>
                  {editando ? (
                    <div className="space-y-3">
                      <input className={inputCls} placeholder="Título do aviso" value={editAviso.titulo} onChange={(e) => setEditAviso((p) => ({ ...p, titulo: e.target.value }))} />
                      <textarea className={textareaCls} rows={3} placeholder="Conteúdo do aviso..." value={editAviso.conteudo} onChange={(e) => setEditAviso((p) => ({ ...p, conteudo: e.target.value }))} />
                      <div className="space-y-3 pt-1 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">Visibilidade</p>
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input type="checkbox" checked={editAviso.visivelHome} onChange={(e) => setEditAviso((p) => ({ ...p, visivelHome: e.target.checked }))} className="accent-black w-4 h-4 mt-0.5" />
                          <div>
                            <span className="text-sm font-medium text-gray-700">Exibir na página inicial do site</span>
                            <p className="text-xs text-gray-400">Visível para qualquer visitante, sem necessidade de login</p>
                          </div>
                        </label>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500">Quem vê no dashboard?</p>
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input type="checkbox" checked={editAviso.destinatariosTodos} onChange={(e) => setEditAviso((p) => ({ ...p, destinatariosTodos: e.target.checked, rolesSel: [] }))} className="accent-black w-4 h-4" />
                            <span className="text-sm text-gray-700">Todos os membros cadastrados</span>
                          </label>
                          {!editAviso.destinatariosTodos && (
                            <div className="grid grid-cols-2 gap-1.5 ml-6">
                              {ROLES.filter((r) => r !== "admin" && r !== "pastor").map((role) => (
                                <label key={role} className="flex items-center gap-2 cursor-pointer select-none">
                                  <input type="checkbox" checked={editAviso.rolesSel.includes(role)} onChange={(e) => setEditAviso((p) => ({ ...p, rolesSel: e.target.checked ? [...p.rolesSel, role] : p.rolesSel.filter((r) => r !== role) }))} className="accent-black w-4 h-4" />
                                  <span className="text-sm text-gray-700">{ROLE_LABEL[role]}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-gray-500">Filtrar por ministério <span className="text-gray-300">(opcional)</span></p>
                          <div className="flex flex-wrap gap-1.5">
                            {MINISTERIOS.map((m) => {
                              const sel = editAviso.ministerios.includes(m);
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setEditAviso((p) => ({
                                    ...p,
                                    ministerios: sel ? p.ministerios.filter((x) => x !== m) : [...p.ministerios, m],
                                  }))}
                                  className={clsx(
                                    "text-xs px-2.5 py-1 rounded-full border transition",
                                    sel
                                      ? "bg-gold-100 text-gold-800 border-gold-300 font-semibold"
                                      : "bg-white text-gray-500 border-gray-200 hover:border-gold-200 hover:text-gold-700"
                                  )}
                                >{m}</button>
                              );
                            })}
                          </div>
                          {editAviso.ministerios.length === 0 && (
                            <p className="text-[11px] text-gray-400">Nenhum selecionado = visível para todos os ministérios</p>
                          )}
                        </div>
                      </div>
                      {erroEdicaoAviso && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erroEdicaoAviso}</p>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditandoAvisoId(null)} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition">Cancelar</button>
                        <button onClick={salvarEdicaoAviso} disabled={salvandoEdicaoAviso} className="flex items-center gap-1.5 bg-black hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-60">
                          <Save className="w-3.5 h-3.5" /> {salvandoEdicaoAviso ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <Bell className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800">{a.titulo}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.conteudo}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {a.visivel_home && (
                            <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Página inicial</span>
                          )}
                          <span className="text-[10px] font-medium bg-gray-50 text-gray-900 border border-gray-100 px-2 py-0.5 rounded-full">{destLabel}</span>
                          {a.ministerios?.map((m) => (
                            <span key={m} className="text-[10px] font-medium bg-gold-50 text-gold-700 border border-gold-200 px-2 py-0.5 rounded-full">{m}</span>
                          ))}
                          <span className="text-xs text-gray-400">{new Date(a.criado_em).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => abrirEdicaoAviso(a)} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-300 hover:text-gray-600 transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => removerAviso(a.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {avisos.length === 0 && !adicionandoAviso && (
              <div className="px-5 py-10 text-center text-gray-400 text-sm">Nenhum aviso publicado ainda.</div>
            )}
          </div>
        </div>
      )}

      {/* ── DEVOCIONAL ── */}
      {secao === "devocional" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Devocional diário</p>
              <p className="text-xs text-gray-400 mt-0.5">O mais recente ativo aparece na página inicial</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewDevOpen(true)}
                disabled={!adicionandoDev && !editandoDev}
                className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button onClick={() => { setEditandoDev(null); setAdicionandoDev(true); }} className="flex items-center gap-1.5 bg-black hover:bg-gray-900 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
                <Plus className="w-3.5 h-3.5" /> Novo devocional
              </button>
            </div>
          </div>

          {(adicionandoDev || editandoDev) && (
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/30 space-y-3">
              {erroUploadDev && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{erroUploadDev}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Título*" value={editandoDev ? editandoDev.titulo : novoDev.titulo} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, titulo: e.target.value }) : setNovoDev((p) => ({ ...p, titulo: e.target.value }))} />
                <input className={inputCls} placeholder="Subtítulo" value={editandoDev ? (editandoDev.subtitulo ?? "") : novoDev.subtitulo} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, subtitulo: e.target.value }) : setNovoDev((p) => ({ ...p, subtitulo: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-50">
                    <ImageIcon className="w-4 h-4" />
                    {uploadingCapaDev ? "Enviando capa..." : devAtual.imagem_url ? "Trocar imagem principal" : "Subir imagem principal"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingCapaDev}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) subirCapaDevocional(file);
                      }}
                    />
                  </label>
                  {devAtual.imagem_url && (
                    <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={devAtual.imagem_url} alt="Imagem principal" className="h-24 w-full object-cover" />
                    </div>
                  )}
                </div>
                <input type="date" className={inputCls} value={editandoDev ? editandoDev.data : novoDev.data} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, data: e.target.value }) : setNovoDev((p) => ({ ...p, data: e.target.value }))} />
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {([
                    { tipo: "texto", label: "Texto", icon: Type },
                    { tipo: "imagem", label: "Imagem", icon: ImageIcon },
                    { tipo: "video", label: "Vídeo", icon: Video },
                    { tipo: "citacao", label: "Citação", icon: Quote },
                    { tipo: "separador", label: "Divisor", icon: Layers },
                  ] as { tipo: DevocionalBloco["tipo"]; label: string; icon: React.ElementType }[]).map(({ tipo, label, icon: Icon }) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => adicionarBlocoDev(tipo)}
                      className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition"
                    >
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {(devAtual.blocos ?? [criarBlocoDevocional("texto")]).map((bloco, index) => (
                    <div key={bloco.id} className="rounded-2xl border border-gray-200 bg-white p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                          {bloco.tipo === "texto" && <Type className="w-3.5 h-3.5" />}
                          {bloco.tipo === "imagem" && <ImageIcon className="w-3.5 h-3.5" />}
                          {bloco.tipo === "video" && <Video className="w-3.5 h-3.5" />}
                          {bloco.tipo === "citacao" && <Quote className="w-3.5 h-3.5" />}
                          {bloco.tipo === "separador" && <Layers className="w-3.5 h-3.5" />}
                          {bloco.tipo}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => moverBlocoDev(index, -1)} disabled={index === 0} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition">
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => moverBlocoDev(index, 1)} disabled={index === (devAtual.blocos?.length ?? 1) - 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition">
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => removerBlocoDev(index)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {bloco.tipo === "texto" && (
                        <textarea
                          className={textareaCls}
                          rows={5}
                          placeholder="Texto do devocional*"
                          value={bloco.texto}
                          onChange={(e) => atualizarBlocoDev(index, { texto: e.target.value })}
                        />
                      )}

                      {bloco.tipo === "imagem" && (
                        <div className="space-y-2">
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-3 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50">
                            <ImageIcon className="w-4 h-4" />
                            {uploadingBlocoId === bloco.id ? "Enviando imagem..." : bloco.url ? "Trocar imagem" : "Subir imagem"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              disabled={uploadingBlocoId === bloco.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) subirMidiaDevocional(index, file, "imagem");
                              }}
                            />
                          </label>
                          <input className={inputCls} placeholder="Legenda da imagem" value={bloco.legenda ?? ""} onChange={(e) => atualizarBlocoDev(index, { legenda: e.target.value })} />
                          {bloco.url && (
                            <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={bloco.url} alt="Prévia" className="h-44 w-full object-cover" />
                            </div>
                          )}
                        </div>
                      )}

                      {bloco.tipo === "video" && (
                        <div className="space-y-2">
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-3 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50">
                            <Video className="w-4 h-4" />
                            {uploadingBlocoId === bloco.id ? "Enviando vídeo..." : bloco.url ? "Trocar vídeo" : "Subir vídeo"}
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                              className="hidden"
                              disabled={uploadingBlocoId === bloco.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) subirMidiaDevocional(index, file, "video");
                              }}
                            />
                          </label>
                          <input className={inputCls} placeholder="Legenda do vídeo" value={bloco.legenda ?? ""} onChange={(e) => atualizarBlocoDev(index, { legenda: e.target.value })} />
                          {bloco.url && (
                            <video src={bloco.url} controls className="aspect-video w-full rounded-xl border border-gray-100 bg-gray-950 object-cover" />
                          )}
                        </div>
                      )}

                      {bloco.tipo === "citacao" && (
                        <div className="space-y-2">
                          <textarea className={textareaCls} rows={3} placeholder="Citação*" value={bloco.texto} onChange={(e) => atualizarBlocoDev(index, { texto: e.target.value })} />
                          <input className={inputCls} placeholder="Referência" value={bloco.referencia ?? ""} onChange={(e) => atualizarBlocoDev(index, { referencia: e.target.value })} />
                        </div>
                      )}

                      {bloco.tipo === "separador" && (
                        <div className="py-3">
                          <div className="h-px bg-gray-200" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Versículo (ex: João 3:16)" value={editandoDev ? (editandoDev.versiculo ?? "") : novoDev.versiculo} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, versiculo: e.target.value }) : setNovoDev((p) => ({ ...p, versiculo: e.target.value }))} />
                <input className={inputCls} placeholder="Referência bíblica" value={editandoDev ? (editandoDev.referencia ?? "") : novoDev.referencia} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, referencia: e.target.value }) : setNovoDev((p) => ({ ...p, referencia: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={editandoDev ? editandoDev.ativo : novoDev.ativo} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, ativo: e.target.checked }) : setNovoDev((p) => ({ ...p, ativo: e.target.checked }))} className="rounded" />
                Ativo (visível na home)
              </label>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setAdicionandoDev(false); setEditandoDev(null); }} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition">Cancelar</button>
                <button onClick={editandoDev ? salvarEdicaoDev : criarDevocional} disabled={salvandoDev} className="flex items-center gap-1.5 bg-black hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-60">
                  <Save className="w-3.5 h-3.5" /> {editandoDev ? "Salvar" : "Publicar"}
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {devs.map((d) => (
              <div key={d.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50/50">
                <BookOpen className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-gray-800">{d.titulo}</p>
                    {d.ativo ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ativo</span> : <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">Inativo</span>}
                  </div>
                  {d.subtitulo && <p className="text-xs text-gray-500 mt-0.5">{d.subtitulo}</p>}
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{resumoDevocional(d)}</p>
                  {d.versiculo && <p className="text-xs text-gray-800 mt-1 italic">&ldquo;{d.versiculo}&rdquo; {d.referencia && `— ${d.referencia}`}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => iniciarEdicaoDev(d)} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-300 hover:text-gray-800 transition">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => removerDev(d.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {devs.length === 0 && (
              <div className="px-5 py-10 text-center text-gray-400 text-sm">Nenhum devocional criado ainda.</div>
            )}
          </div>
        </div>
      )}

      {secao === "devocional" && previewDevOpen && (adicionandoDev || editandoDev) && (
        <DevocionalPreviewModal dev={devAtual} onClose={() => setPreviewDevOpen(false)} />
      )}
    </div>
  );
}
