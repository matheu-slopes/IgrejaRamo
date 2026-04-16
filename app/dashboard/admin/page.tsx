"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  TODAS_PERMISSOES, PERMISSAO_LABEL, GRUPOS_PERMISSAO,
  DEFAULTS_POR_ROLE, permissoesEfetivas,
} from "@/lib/permissions";
import {
  Shield, Users, Plus, Search, Pencil, Power, X,
  ChevronRight, Check, RotateCcw, UserPlus, AlertCircle,
  Layers, Lock, Unlock, Trash2, Save, Link2,
} from "lucide-react";
import clsx from "clsx";
import { User, Role, Ministerio, Permissao, CanalMinisterio } from "@/types";
import { mockCanais } from "@/lib/mockData";

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
type AdminTab = "usuarios" | "ministerios";

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

  const [adminTab, setAdminTab] = useState<AdminTab>("usuarios");
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
      {/* Header */}
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-100 pb-1 mb-2">
        {([
          { id: "usuarios",    label: "Usuários",    icon: Users  },
          { id: "ministerios", label: "Ministérios", icon: Layers },
        ] as { id: AdminTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAdminTab(id)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition",
              adminTab === id
                ? "bg-vine-700 text-white"
                : "text-gray-500 hover:text-vine-700 hover:bg-vine-50"
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {adminTab === "ministerios" && (
        <MinisteriosTab usuarios={usuarios} temPermissao={temPermissao} />
      )}

      {adminTab === "usuarios" && <>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield className="w-5 h-5 text-vine-700" />
            <h1 className="text-2xl font-serif font-semibold text-vine-950">Painel Admin</h1>
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
                <p className={clsx("text-2xl font-bold font-serif", s.cor)}>{s.valor}</p>
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
                onCriar={(dados) => { criarUsuario(dados); setPainel("lista"); }}
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
  usuarios, temPermissao,
}: {
  usuarios: User[];
  temPermissao: (p: Permissao) => boolean;
}) {
  const podeEditar = temPermissao("atribuir_permissoes");
  const [canais, setCanais] = useState<CanalMinisterio[]>([...mockCanais]);
  const [editandoCanal, setEditandoCanal] = useState<CanalMinisterio | null>(null);
  const [showNovoForm, setShowNovoForm] = useState(false);
  const [novoForm, setNovoForm] = useState({ ministerio: "" as Ministerio | string, descricao: "", cor: "vine", chatBloqueado: false });

  function salvarEdicao() {
    if (!editandoCanal) return;
    setCanais((prev) => prev.map((c) => c.ministerio === editandoCanal.ministerio ? editandoCanal : c));
    setEditandoCanal(null);
  }

  function removerCanal(m: string) {
    if (!confirm(`Remover o canal "${m}"?`)) return;
    setCanais((prev) => prev.filter((c) => c.ministerio !== m));
  }

  function criarCanal() {
    if (!novoForm.ministerio.trim() || !novoForm.descricao.trim()) return;
    const novo: CanalMinisterio = {
      ministerio: novoForm.ministerio.trim() as Ministerio,
      descricao: novoForm.descricao.trim(),
      chatBloqueado: novoForm.chatBloqueado,
      cor: novoForm.cor,
    };
    setCanais((prev) => [...prev, novo]);
    setNovoForm({ ministerio: "", descricao: "", cor: "vine", chatBloqueado: false });
    setShowNovoForm(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{canais.length} canal{canais.length !== 1 ? "is" : ""} de ministério</p>
        {podeEditar && (
          <button
            onClick={() => setShowNovoForm(true)}
            className="flex items-center gap-1.5 bg-vine-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-vine-600 transition"
          >
            <Plus className="w-4 h-4" /> Novo canal
          </button>
        )}
      </div>

      {/* Formulário novo canal */}
      {showNovoForm && (
        <div className="bg-vine-50 border border-vine-200 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-vine-800">Novo canal de ministério</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={novoForm.ministerio as string}
              onChange={(e) => setNovoForm({ ...novoForm, ministerio: e.target.value })}
              placeholder="Nome do ministério *"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400"
            />
            <input
              value={novoForm.descricao}
              onChange={(e) => setNovoForm({ ...novoForm, descricao: e.target.value })}
              placeholder="Descrição *"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1.5">Cor do canal</p>
              <div className="flex gap-2 flex-wrap">
                {CORES_CANAL.map((cor) => (
                  <button
                    key={cor}
                    onClick={() => setNovoForm({ ...novoForm, cor })}
                    className={clsx(
                      "w-7 h-7 rounded-full border-2 transition",
                      COR_BG[cor],
                      novoForm.cor === cor ? "border-vine-900 scale-110" : "border-transparent"
                    )}
                    title={COR_LABEL[cor]}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={novoForm.chatBloqueado}
                onChange={(e) => setNovoForm({ ...novoForm, chatBloqueado: e.target.checked })}
                className="accent-vine-700 w-4 h-4"
              />
              Chat bloqueado por padrão
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNovoForm(false)} className="text-sm text-gray-500 px-4 py-1.5 rounded-xl hover:bg-gray-100">Cancelar</button>
            <button
              onClick={criarCanal}
              disabled={!novoForm.ministerio || !novoForm.descricao}
              className="text-sm bg-vine-700 text-white font-semibold px-4 py-1.5 rounded-xl hover:bg-vine-600 disabled:opacity-40"
            >
              Criar canal
            </button>
          </div>
        </div>
      )}

      {/* Lista de canais */}
      <div className="grid grid-cols-1 gap-3">
        {canais.map((canal) => {
          const isEditing = editandoCanal?.ministerio === canal.ministerio;
          const membrosDoCanal = usuarios.filter((u) => u.ministerios.includes(canal.ministerio as Ministerio));
          return (
            <div
              key={canal.ministerio}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Header do card */}
              <div className={clsx("px-5 py-3 flex items-center justify-between", COR_BG[canal.cor] ?? "bg-vine-600")}>
                <div className="flex items-center gap-3">
                  <span className="font-serif font-semibold text-white text-base">{canal.ministerio}</span>
                  <span className={clsx(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/30 text-white/90",
                    canal.chatBloqueado ? "bg-white/20" : "bg-white/10"
                  )}>
                    {canal.chatBloqueado ? "🔒 Chat bloqueado" : "💬 Chat livre"}
                  </span>
                </div>
                {podeEditar && (
                  <div className="flex gap-2">
                    <a
                      href={`/dashboard/ministerio/${encodeURIComponent(canal.ministerio)}`}
                      className="flex items-center gap-1 text-white/80 hover:text-white text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition"
                    >
                      <Link2 className="w-3 h-3" /> Abrir
                    </a>
                    <button
                      onClick={() => isEditing ? setEditandoCanal(null) : setEditandoCanal({ ...canal })}
                      className="flex items-center gap-1 text-white/80 hover:text-white text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition"
                    >
                      <Pencil className="w-3 h-3" /> {isEditing ? "Cancelar" : "Editar"}
                    </button>
                    <button
                      onClick={() => removerCanal(canal.ministerio)}
                      className="text-white/70 hover:text-red-200 hover:bg-white/10 p-1 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                {isEditing && editandoCanal ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
                        <input
                          value={editandoCanal.descricao}
                          onChange={(e) => setEditandoCanal({ ...editandoCanal, descricao: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1.5 block">Cor do canal</label>
                        <div className="flex gap-2 flex-wrap">
                          {CORES_CANAL.map((cor) => (
                            <button
                              key={cor}
                              onClick={() => setEditandoCanal({ ...editandoCanal, cor })}
                              className={clsx(
                                "w-7 h-7 rounded-full border-2 transition",
                                COR_BG[cor],
                                editandoCanal.cor === cor ? "border-gray-800 scale-110" : "border-transparent"
                              )}
                              title={COR_LABEL[cor]}
                            />
                          ))}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editandoCanal.chatBloqueado}
                          onChange={(e) => setEditandoCanal({ ...editandoCanal, chatBloqueado: e.target.checked })}
                          className="accent-vine-700 w-4 h-4"
                        />
                        Chat bloqueado por padrão
                      </label>
                    </div>
                    <button
                      onClick={salvarEdicao}
                      className="flex items-center gap-1.5 bg-vine-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-vine-600 transition"
                    >
                      <Save className="w-3.5 h-3.5" /> Salvar alterações
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-600">{canal.descricao}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {membrosDoCanal.length} membro{membrosDoCanal.length !== 1 ? "s" : ""}
                        {membrosDoCanal.length > 0 && (
                          <span className="ml-1 text-gray-500">
                            • {membrosDoCanal.slice(0, 3).map((u) => u.nome.split(" ")[0]).join(", ")}
                            {membrosDoCanal.length > 3 && ` +${membrosDoCanal.length - 3}`}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canal.chatBloqueado
                        ? <Lock className="w-4 h-4 text-amber-400" />
                        : <Unlock className="w-4 h-4 text-green-400" />}
                    </div>
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

function NovoUsuarioForm({
  onCriar, onCancelar,
}: {
  onCriar: (dados: Omit<User, "id">) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", role: "membro" as Role,
    ministerios: [] as Ministerio[], ativo: true,
  });

  function submeter() {
    if (!form.nome.trim() || !form.email.trim()) return;
    onCriar({
      nome:        form.nome.trim(),
      email:       form.email.trim(),
      telefone:    form.telefone.trim() || undefined,
      role:        form.role,
      ministerios: form.ministerios,
      ativo:       true,
      dataIngresso: new Date().toISOString().split("T")[0],
    });
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
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400 focus:ring-1 focus:ring-vine-100"
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="E-mail *"
            type="email"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400 focus:ring-1 focus:ring-vine-100"
          />
          <input
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            placeholder="Telefone"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400 focus:ring-1 focus:ring-vine-100"
          />
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

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancelar}
            className="flex-1 text-sm text-gray-500 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={submeter}
            disabled={!form.nome || !form.email}
            className="flex-1 text-sm bg-vine-800 text-white font-semibold py-2.5 rounded-xl hover:bg-vine-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Criar usuário
          </button>
        </div>
      </div>
    </div>
  );
}
