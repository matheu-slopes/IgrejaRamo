"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import {
  TODAS_PERMISSOES, PERMISSAO_LABEL, GRUPOS_PERMISSAO,
  DEFAULTS_POR_ROLE, permissoesEfetivas,
} from "@/lib/permissions";
import {
  Shield, Users, Plus, Search, Pencil, Power, X,
  ChevronRight, Check, RotateCcw, UserPlus, AlertCircle,
  Layers, Lock, Unlock, Trash2, Save, Link2, MapPin, Pin,
  Eye, EyeOff, Bell, BookOpen,
} from "lucide-react";
import clsx from "clsx";
import { User, Role, Ministerio, Permissao, CanalMinisterio, Local } from "@/types";
import { supabase } from "@/lib/supabase";

const ROLES: Role[] = ["admin", "pastor", "lider", "voluntario", "membro"];
const MINISTERIOS: Ministerio[] = ["Louvor","Mídias","Ensino","Infantil","Ação Social","Jovens","Cantina"];

const ROLE_COR: Record<Role, string> = {
  admin:      "bg-red-100 text-red-700 border-red-200",
  pastor:     "bg-purple-100 text-purple-700 border-purple-200",
  lider:      "bg-gold-100 text-gold-800 border-gold-200",
  voluntario: "bg-vine-100 text-vine-700 border-vine-200",
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
  vine: "bg-vine-600", grape: "bg-grape-700", bark: "bg-bark-600", gold: "bg-gold-500",
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

  if (!temPermissao("gerenciar_usuarios")) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-center gap-3">
        <Shield className="w-10 h-10 text-gray-200" />
        <p className="text-gray-500 font-medium">Acesso restrito</p>
        <p className="text-sm text-gray-400">Você não tem permissão para acessar o painel de administração.</p>
      </div>
    );
  }

  const filtrados = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="max-w-5xl space-y-6">

      {adminTab === "ministerios" && (
        <MinisteriosTab usuarios={usuarios} temPermissao={temPermissao} />
      )}

      {adminTab === "locais" && (
        <LocaisTab />
      )}

      {adminTab === "conteudo" && (
        <ConteudoTab initSecao={initSecao} />
      )}

      {adminTab === "usuarios" && <>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield className="w-5 h-5 text-vine-700" />
            <h1 className="text-2xl font-sans font-semibold text-vine-950">Painel Admin</h1>
          </div>
          <p className="text-sm text-gray-500">
            Gerencie usuários, roles e permissões individuais sem editar código.
          </p>
        </div>
        <button
          onClick={() => { setPainel("novo"); setEditando(null); }}
          className="flex items-center gap-1.5 bg-vine-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-vine-700 transition shadow-sm"
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
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-vine-400 focus:ring-1 focus:ring-vine-100"
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
                        editando?.id === u.id && "bg-vine-50 hover:bg-vine-50",
                        !u.ativo && "opacity-50"
                      )}
                      onClick={() => setEditando(u)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-vine-100 text-vine-800 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
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
                  return result !== null;
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
              <div className="flex items-center justify-between px-5 py-3 bg-vine-700">
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
                            className="accent-vine-700 w-4 h-4"
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
          <div className="w-9 h-9 bg-vine-100 text-vine-800 rounded-full flex items-center justify-center font-bold text-sm">
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
                      ? "bg-vine-100 text-vine-800 border-vine-200 font-medium"
                      : "border-gray-200 text-gray-400 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

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
                            ? "bg-vine-50 border-vine-200 text-vine-800"
                            : "bg-gray-50 border-gray-150 text-gray-400",
                          podeatribuir && "hover:opacity-80 cursor-pointer",
                          !podeatribuir && "cursor-default opacity-70",
                          diferente && "ring-1 ring-amber-300"
                        )}
                      >
                        <div className={clsx(
                          "w-4 h-4 rounded flex items-center justify-center shrink-0 border transition",
                          ativa ? "bg-vine-700 border-vine-700 text-white" : "border-gray-300 bg-white"
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
  onCriar: (dados: Omit<User, "id">, senha: string) => Promise<boolean>;
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
    const ok = await onCriar({
      nome:        form.nome.trim(),
      email:       form.email.trim(),
      telefone:    form.telefone.trim() || undefined,
      role:        form.role,
      ministerios: form.ministerios,
      ativo:       true,
      dataIngresso: new Date().toISOString().split("T")[0],
    }, senha);
    setLoading(false);
    if (ok) {
      setCriado({ email: form.email.trim(), senha });
    } else {
      setErro("Erro ao criar usuário. Verifique se o e-mail já está em uso.");
    }
  }

  function copiar() {
    navigator.clipboard.writeText(`E-mail: ${criado!.email}\nSenha: ${criado!.senha}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400 focus:ring-1 focus:ring-vine-100";

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
                : "bg-vine-50 text-vine-800 border-vine-200 hover:bg-vine-100"
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
          <UserPlus className="w-4 h-4 text-vine-700" />
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
                      ? "bg-vine-100 text-vine-800 border-vine-200 font-medium"
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
            className="flex-1 text-sm bg-vine-800 text-white font-semibold py-2.5 rounded-xl hover:bg-vine-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Criando..." : "Criar usuário"}
          </button>
        </div>
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
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400 resize-none placeholder:text-gray-300"
          />
          <div className="flex items-center justify-between">
            {avisoSalvo && (
              <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Salvo com sucesso
              </span>
            )}
            <button
              onClick={salvarAviso}
              className="ml-auto flex items-center gap-1.5 bg-vine-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-vine-800 transition"
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
            <MapPin className="w-4 h-4 text-vine-600" />
            <p className="font-semibold text-gray-800 text-sm">Locais Cadastrados</p>
            <span className="text-xs bg-vine-100 text-vine-700 font-bold px-2 py-0.5 rounded-full">{locais.length}</span>
          </div>
          <button
            onClick={() => setAdicionando(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-vine-700 bg-vine-50 hover:bg-vine-100 px-3 py-1.5 rounded-xl border border-vine-200 transition"
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
                    className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-vine-400"
                    placeholder="Nome do local"
                    autoFocus
                  />
                  <input
                    value={editandoLocal.descricao ?? ""}
                    onChange={(e) => setEditandoLocal({ ...editandoLocal, descricao: e.target.value })}
                    className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-vine-400"
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
                    <div className="w-8 h-8 rounded-xl bg-vine-50 border border-vine-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-vine-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{local.nome}</p>
                      {local.descricao && <p className="text-xs text-gray-400 truncate">{local.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditandoLocal(local)}
                      className="text-gray-300 hover:text-vine-600 transition"
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
            <div className="px-5 py-3.5 bg-vine-50/50 flex items-center gap-2 flex-wrap border-t border-vine-100">
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-vine-400 bg-white"
                placeholder="Nome do local *"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && adicionarLocal()}
              />
              <input
                value={novaDesc}
                onChange={(e) => setNovaDesc(e.target.value)}
                className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-vine-400 bg-white"
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

interface Aviso { id: string; titulo: string; conteudo: string; criado_em: string; destinatarios: string; }
interface Devocional { id: string; titulo: string; subtitulo: string | null; conteudo: string; versiculo: string | null; referencia: string | null; imagem_url: string | null; data: string; ativo: boolean; }

function ConteudoTab({ initSecao }: { initSecao?: string }) {
  const [secao, setSecao] = useState<"avisos" | "devocional">(
    initSecao === "devocional" ? "devocional" : "avisos"
  );

  // ── Avisos ──
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [novoAviso, setNovoAviso] = useState({ titulo: "", conteudo: "", destinatarios: "todos" });
  const [adicionandoAviso, setAdicionandoAviso] = useState(false);
  const [salvandoAviso, setSalvandoAviso] = useState(false);
  const [erroAviso, setErroAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("avisos").select("id,titulo,conteudo,criado_em,destinatarios").order("criado_em", { ascending: false }).limit(30).then(({ data, error }) => {
      if (error) console.error("avisos fetch:", error);
      if (data) setAvisos(data as Aviso[]);
    });
  }, []);

  async function criarAviso() {
    if (!novoAviso.titulo.trim() || !novoAviso.conteudo.trim()) return;
    setErroAviso(null);
    setSalvandoAviso(true);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tempo esgotado — verifique a conexão ou as políticas RLS no Supabase")), 8000)
    );

    try {
      // Garante sessão ativa antes de tentar o insert
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setErroAviso("Sessão expirada — faça login novamente");
        return;
      }

      const query = supabase.from("avisos").insert({
        titulo: novoAviso.titulo.trim(),
        conteudo: novoAviso.conteudo.trim(),
        destinatarios: novoAviso.destinatarios,
      });

      const { error } = await Promise.race([query, timeout]) as Awaited<typeof query>;

      if (error) {
        console.error("Erro ao criar aviso:", error);
        setErroAviso(`${error.message} (code: ${error.code})`);
      } else {
        // Recarrega a lista do banco após inserir
        const { data: lista } = await supabase
          .from("avisos")
          .select("id,titulo,conteudo,criado_em,destinatarios")
          .order("criado_em", { ascending: false })
          .limit(30);
        if (lista) setAvisos(lista as Aviso[]);
        setNovoAviso({ titulo: "", conteudo: "", destinatarios: "todos" });
        setAdicionandoAviso(false);
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

  // ── Devocional ──
  const [devs, setDevs] = useState<Devocional[]>([]);
  const [novoDev, setNovoDev] = useState({ titulo: "", subtitulo: "", conteudo: "", versiculo: "", referencia: "", imagem_url: "", data: new Date().toISOString().slice(0, 10), ativo: true });
  const [adicionandoDev, setAdicionandoDev] = useState(false);
  const [salvandoDev, setSalvandoDev] = useState(false);
  const [editandoDev, setEditandoDev] = useState<Devocional | null>(null);

  useEffect(() => {
    supabase.from("devocionais").select().order("data", { ascending: false }).limit(20).then(({ data }) => {
      if (data) setDevs(data as Devocional[]);
    });
  }, []);

  async function criarDevocional() {
    if (!novoDev.titulo.trim() || !novoDev.conteudo.trim()) return;
    setSalvandoDev(true);
    const { data } = await supabase.from("devocionais").insert({
      titulo: novoDev.titulo.trim(),
      subtitulo: novoDev.subtitulo.trim() || null,
      conteudo: novoDev.conteudo.trim(),
      "versículo": novoDev.versiculo.trim() || null,
      referencia: novoDev.referencia.trim() || null,
      imagem_url: novoDev.imagem_url.trim() || null,
      data: novoDev.data,
      ativo: novoDev.ativo,
    }).select().single();
    if (data) setDevs((prev) => [data as Devocional, ...prev]);
    setNovoDev({ titulo: "", subtitulo: "", conteudo: "", versiculo: "", referencia: "", imagem_url: "", data: new Date().toISOString().slice(0, 10), ativo: true });
    setAdicionandoDev(false);
    setSalvandoDev(false);
  }

  async function salvarEdicaoDev() {
    if (!editandoDev) return;
    setSalvandoDev(true);
    await supabase.from("devocionais").update({
      titulo: editandoDev.titulo,
      subtitulo: editandoDev.subtitulo || null,
      conteudo: editandoDev.conteudo,
      "versículo": editandoDev.versiculo || null,
      referencia: editandoDev.referencia || null,
      imagem_url: editandoDev.imagem_url || null,
      data: editandoDev.data,
      ativo: editandoDev.ativo,
    }).eq("id", editandoDev.id);
    setDevs((prev) => prev.map((d) => d.id === editandoDev.id ? editandoDev : d));
    setEditandoDev(null);
    setSalvandoDev(false);
  }

  function removerDev(id: string) {
    supabase.from("devocionais").delete().eq("id", id).then(() => {});
    setDevs((prev) => prev.filter((d) => d.id !== id));
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vine-400 bg-gray-50";
  const textareaCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vine-400 bg-gray-50 resize-none";

  return (
    <div className="space-y-4">

      {/* ── AVISOS ── */}
      {secao === "avisos" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Avisos públicos</p>
              <p className="text-xs text-gray-400 mt-0.5">Aparecem no mural da página inicial</p>
            </div>
            <button onClick={() => setAdicionandoAviso(true)} className="flex items-center gap-1.5 bg-vine-700 hover:bg-vine-800 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
              <Plus className="w-3.5 h-3.5" /> Novo aviso
            </button>
          </div>

          {adicionandoAviso && (
            <div className="px-5 py-4 border-b border-vine-50 bg-vine-50/30 space-y-3">
              <input className={inputCls} placeholder="Título do aviso" value={novoAviso.titulo} onChange={(e) => setNovoAviso((p) => ({ ...p, titulo: e.target.value }))} />
              <textarea className={textareaCls} rows={3} placeholder="Conteúdo do aviso..." value={novoAviso.conteudo} onChange={(e) => setNovoAviso((p) => ({ ...p, conteudo: e.target.value }))} />
              <select className={inputCls} value={novoAviso.destinatarios} onChange={(e) => setNovoAviso((p) => ({ ...p, destinatarios: e.target.value }))}>
                <option value="todos">Todos (público)</option>
                <option value="membros">Apenas membros</option>
                <option value="lideranca">Apenas liderança</option>
              </select>
              {erroAviso && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erroAviso}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setAdicionandoAviso(false); setErroAviso(null); }} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition">Cancelar</button>
                <button onClick={criarAviso} disabled={salvandoAviso} className="flex items-center gap-1.5 bg-vine-700 hover:bg-vine-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-60">
                  <Save className="w-3.5 h-3.5" /> {salvandoAviso ? "Publicando..." : "Publicar"}
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {avisos.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50/50">
                <Bell className="w-4 h-4 text-vine-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{a.titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.conteudo}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(a.criado_em).toLocaleDateString("pt-BR")} · {typeof a.destinatarios === "string" ? a.destinatarios : "todos"}</p>
                </div>
                <button onClick={() => removerAviso(a.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {avisos.length === 0 && (
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
            <button onClick={() => setAdicionandoDev(true)} className="flex items-center gap-1.5 bg-vine-700 hover:bg-vine-800 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
              <Plus className="w-3.5 h-3.5" /> Novo devocional
            </button>
          </div>

          {(adicionandoDev || editandoDev) && (
            <div className="px-5 py-4 border-b border-vine-50 bg-vine-50/30 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Título*" value={editandoDev ? editandoDev.titulo : novoDev.titulo} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, titulo: e.target.value }) : setNovoDev((p) => ({ ...p, titulo: e.target.value }))} />
                <input className={inputCls} placeholder="Subtítulo" value={editandoDev ? (editandoDev.subtitulo ?? "") : novoDev.subtitulo} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, subtitulo: e.target.value }) : setNovoDev((p) => ({ ...p, subtitulo: e.target.value }))} />
              </div>
              <textarea className={textareaCls} rows={6} placeholder="Conteúdo do devocional*" value={editandoDev ? editandoDev.conteudo : novoDev.conteudo} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, conteudo: e.target.value }) : setNovoDev((p) => ({ ...p, conteudo: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Versículo (ex: João 3:16)" value={editandoDev ? (editandoDev.versiculo ?? "") : novoDev.versiculo} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, versiculo: e.target.value }) : setNovoDev((p) => ({ ...p, versiculo: e.target.value }))} />
                <input className={inputCls} placeholder="Referência bíblica" value={editandoDev ? (editandoDev.referencia ?? "") : novoDev.referencia} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, referencia: e.target.value }) : setNovoDev((p) => ({ ...p, referencia: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="URL de imagem (opcional)" value={editandoDev ? (editandoDev.imagem_url ?? "") : novoDev.imagem_url} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, imagem_url: e.target.value }) : setNovoDev((p) => ({ ...p, imagem_url: e.target.value }))} />
                <input type="date" className={inputCls} value={editandoDev ? editandoDev.data : novoDev.data} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, data: e.target.value }) : setNovoDev((p) => ({ ...p, data: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={editandoDev ? editandoDev.ativo : novoDev.ativo} onChange={(e) => editandoDev ? setEditandoDev({ ...editandoDev, ativo: e.target.checked }) : setNovoDev((p) => ({ ...p, ativo: e.target.checked }))} className="rounded" />
                Ativo (visível na home)
              </label>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setAdicionandoDev(false); setEditandoDev(null); }} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition">Cancelar</button>
                <button onClick={editandoDev ? salvarEdicaoDev : criarDevocional} disabled={salvandoDev} className="flex items-center gap-1.5 bg-vine-700 hover:bg-vine-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-60">
                  <Save className="w-3.5 h-3.5" /> {editandoDev ? "Salvar" : "Publicar"}
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {devs.map((d) => (
              <div key={d.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50/50">
                <BookOpen className="w-4 h-4 text-vine-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-gray-800">{d.titulo}</p>
                    {d.ativo ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ativo</span> : <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">Inativo</span>}
                  </div>
                  {d.subtitulo && <p className="text-xs text-gray-500 mt-0.5">{d.subtitulo}</p>}
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{d.conteudo}</p>
                  {d.versiculo && <p className="text-xs text-vine-600 mt-1 italic">&ldquo;{d.versiculo}&rdquo; {d.referencia && `— ${d.referencia}`}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditandoDev(d)} className="p-1.5 hover:bg-vine-50 rounded-lg text-gray-300 hover:text-vine-600 transition">
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
    </div>
  );
}
