/**
 * lib/permissions.ts
 * ─────────────────────────────────────────────────────────────────
 * Central de permissões do sistema.
 *
 * Como funciona:
 *  1. Cada role tem um conjunto padrão de permissões (DEFAULTS_POR_ROLE).
 *  2. O admin pode sobrescrever qualquer permissão individualmente,
 *     gravando um array `permissoes` no objeto User.
 *  3. Se User.permissoes estiver definido, ele substitui o default do role.
 *  4. A função `temPermissao(user, permissao)` encapsula essa lógica
 *     e é usada em toda a UI para decidir o que mostrar/habilitar.
 * ─────────────────────────────────────────────────────────────────
 */

import { Permissao, Role, User } from "@/types";

// ─── Permissões padrão por role ───────────────────────────────────

export const DEFAULTS_POR_ROLE: Record<Role, Permissao[]> = {
  admin: [
    "gerenciar_usuarios",
    "atribuir_permissoes",
    "criar_evento",
    "editar_evento",
    "criar_escala",
    "gerenciar_membros_ministerio",
    "bloquear_chat",
    "enviar_chat",
    "fixar_mensagem",
    "criar_aviso",
    "ver_relatorios",
  ],
  pastor: [
    "criar_evento",
    "editar_evento",
    "criar_escala",
    "gerenciar_membros_ministerio",
    "bloquear_chat",
    "enviar_chat",
    "fixar_mensagem",
    "criar_aviso",
    "ver_relatorios",
  ],
  lider: [
    "criar_evento",
    "editar_evento",
    "criar_escala",
    "gerenciar_membros_ministerio",
    "bloquear_chat",
    "enviar_chat",
    "fixar_mensagem",
    "criar_aviso",
  ],
  voluntario: [
    "enviar_chat",
  ],
  membro: [
    // Membros só acessam o portal de membro — sem acesso ao dashboard interno
  ],
};

// ─── Labels legíveis para a UI do painel admin ────────────────────

export const PERMISSAO_LABEL: Record<Permissao, { label: string; descricao: string; grupo: string }> = {
  gerenciar_usuarios:           { label: "Gerenciar usuários",      descricao: "Acessar painel admin e criar/editar/desativar usuários",    grupo: "Administração" },
  atribuir_permissoes:          { label: "Atribuir permissões",     descricao: "Alterar o role e as permissões de outros usuários",          grupo: "Administração" },
  ver_relatorios:               { label: "Ver relatórios",          descricao: "Acessar estatísticas e relatórios internos",                 grupo: "Administração" },
  criar_aviso:                  { label: "Criar avisos",            descricao: "Publicar notificações e avisos para o grupo",                grupo: "Comunicação"   },
  bloquear_chat:                { label: "Bloquear chat",           descricao: "Travar/destravar o chat de um canal de ministério",          grupo: "Comunicação"   },
  enviar_chat:                  { label: "Enviar mensagens",        descricao: "Enviar mensagens nos canais de ministério",                  grupo: "Comunicação"   },
  fixar_mensagem:               { label: "Fixar mensagens",         descricao: "Fixar mensagens importantes no topo do chat",               grupo: "Comunicação"   },
  criar_evento:                 { label: "Criar eventos",           descricao: "Criar novos eventos na agenda do ministério",                grupo: "Agenda"        },
  editar_evento:                { label: "Editar/remover eventos",  descricao: "Editar e excluir eventos existentes",                       grupo: "Agenda"        },
  criar_escala:                 { label: "Criar escalas",           descricao: "Criar e editar escalas de serviço",                         grupo: "Agenda"        },
  gerenciar_membros_ministerio: { label: "Gerenciar membros",       descricao: "Adicionar, remover e editar membros de um ministério",       grupo: "Ministério"    },
};

export const TODAS_PERMISSOES = Object.keys(PERMISSAO_LABEL) as Permissao[];

export const GRUPOS_PERMISSAO = ["Administração", "Comunicação", "Agenda", "Ministério"] as const;

// ─── Permissões que um líder de ministério possui no SEU ministério ───

const PERMISSOES_LIDER_MINISTERIO: Permissao[] = [
  "criar_evento",
  "editar_evento",
  "criar_escala",
  "gerenciar_membros_ministerio",
  "bloquear_chat",
  "enviar_chat",
  "fixar_mensagem",
  "criar_aviso",
];

// ─── Função principal ─────────────────────────────────────────────

/**
 * Verifica se um usuário tem determinada permissão globalmente.
 * Se o usuário tiver `permissoes` definidas (customização pelo admin),
 * usa esse array. Caso contrário, usa o default do role.
 */
export function temPermissao(user: User | null, permissao: Permissao): boolean {
  if (!user) return false;
  const lista = user.permissoes ?? DEFAULTS_POR_ROLE[user.role];
  return lista.includes(permissao);
}

/**
 * Verifica se um usuário tem determinada permissão NO CONTEXTO de um ministério.
 * Admin e pastor têm permissão global.
 * Líderes nomeados (liderMinisterios) têm permissão apenas no seu ministério.
 */
export function temPermissaoNoMinisterio(
  user: User | null,
  permissao: Permissao,
  ministerio: string
): boolean {
  if (!user) return false;
  // Admin e pastor — permissão global
  if (temPermissao(user, permissao)) return true;
  // Usuário é líder nomeado deste ministério?
  const eLider = user.liderMinisterios?.includes(ministerio as import("@/types").Ministerio);
  if (eLider && PERMISSOES_LIDER_MINISTERIO.includes(permissao)) return true;
  return false;
}

/**
 * Retorna as permissões efetivas de um usuário
 * (customizadas ou default do role).
 */
export function permissoesEfetivas(user: User): Permissao[] {
  return user.permissoes ?? DEFAULTS_POR_ROLE[user.role];
}
