export type Role = "admin" | "pastor" | "lider" | "voluntario" | "membro";

// ─────────────────────────────────────────────
// Sistema de permissões
// ─────────────────────────────────────────────
/**
 * Cada permissão é uma string que representa uma ação específica.
 * O admin pode conceder ou revogar qualquer permissão individualmente
 * para qualquer usuário, sobrescrevendo os defaults do role.
 */
export type Permissao =
  | "gerenciar_usuarios"          // acessar painel admin, criar/editar/remover usuários
  | "atribuir_permissoes"         // mudar role e permissões de outros usuários
  | "criar_evento"                // criar eventos no sistema
  | "editar_evento"               // editar e remover eventos
  | "criar_escala"                // criar e editar escalas de serviço
  | "gerenciar_membros_ministerio"// adicionar/remover/editar membros de um ministério
  | "bloquear_chat"               // bloquear/desbloquear chat do canal
  | "enviar_chat"                 // enviar mensagens no chat do canal
  | "fixar_mensagem"              // fixar mensagens no chat
  | "criar_aviso"                 // criar avisos/notificações para o grupo
  | "ver_relatorios";              // ver relatórios e estatísticas

export type Ministerio =
  | "Ensino"
  | "Louvor"
  | "Ação Social"
  | "Infantil"
  | "Mídias"
  | "Cantina"
  | "Jovens";

export interface User {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  foto?: string;
  role: Role;
  ministerios: Ministerio[];
  /**
   * Ministérios que este usuário LIDERA.
   * Definido pelo admin/pastor. Garante privilégios de líder
   * (criar escala, gerenciar membros, etc.) apenas no ministério em questão.
   */
  liderMinisterios?: Ministerio[];
  dataIngresso: string; // ISO date
  ativo: boolean;
  primeiroAcesso?: boolean;
  /**
   * Permissões individuais. Se preenchido, SUBSTITUI os defaults do role.
   * Se undefined, herda os defaults definidos em lib/permissions.ts.
   * Isso permite ao admin conceder ou revogar permissões granularmente.
   */
  permissoes?: Permissao[];
}

export interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  data: string; // ISO date
  horario: string;
  local: string;
  publico: boolean; // visível na home
  ministerio?: Ministerio;
  imagemUrl?: string;
  criadoPor?: string;  // User.id
  recorrente?: boolean;
}

export interface Aviso {
  id: string;
  titulo: string;
  conteudo: string;
  criadoEm: string;
  /** "todos" = todos os membros cadastrados; array de roles = apenas esses roles */
  destinatarios: Role[] | "todos";
  ministerios?: Ministerio[];
  /** Se true, aparece no mural da página inicial (sem login) */
  visivelHome?: boolean;
}

// ─────────────────────────────────────────────
// Escalas
// ─────────────────────────────────────────────
export type FuncaoEscala =
  // Louvor
  | "Ministro"
  | "Guitarra"
  | "Baixo"
  | "Bateria"
  | "Teclado"
  | "Backing Vocal"
  // Mídia
  | "Transmissão"
  | "Projeção/Letras"
  | "Fotografia"
  // Geral
  | "Abertura/Oferta"
  | "Escala de Limpeza"
  // Infantil
  | "Professora"
  | "Monitor";

export interface ItemEscala {
  funcao: FuncaoEscala;
  voluntarioId: string;
  voluntarioNome: string;
  observacao?: string;
}

// Música do repertório
export interface Musica {
  id: string;
  titulo: string;
  artista: string;
  tom?: string;       // "C", "D#", "Bbm" etc.
  estilo?: string;    // "Contemporâneo", "Tradicional", "Gospel Pop" etc.
  linkYoutube?: string;
}

// Música dentro de uma escala (pode ter tom diferente do padrão)
export interface EscalaMusica {
  musicaId: string;
  titulo: string;
  artista: string;
  tom?: string;       // tom usado nessa escala especificamente
}

export interface Escala {
  id: string;
  ministerio: Ministerio;
  data: string;        // ISO date
  horario: string;
  culto: string;       // ex: "Culto Domingo 18h30"
  itens: ItemEscala[];
  musicas?: EscalaMusica[];
  roteiro?: string[];  // ids de EscalaMusica em ordem de execução
  observacoes?: string;
  visivel?: boolean;   // publicada
  confirmacaoParticipantes?: boolean;
  criadoPor: string;
}

// ─────────────────────────────────────────────
// Conversas internas do ministério
// ─────────────────────────────────────────────
export type TipoMensagem = "texto" | "imagem" | "audio" | "documento";

export interface MuralMensagem {
  id: string;
  ministerio: Ministerio;
  autorId: string;
  autorNome: string;
  autorRole: Role;
  conteudo: string;
  criadoEm: string;   // ISO datetime
  fixada: boolean;
  tipo?: TipoMensagem;   // default "texto"
  mediaUrl?: string;     // base64 data URL para imagem/áudio
  reacoes?: { emoji: string; count: number }[];
  editadoEm?: string;
  respostaA?: { id: string; autorNome: string; conteudo: string };
}

// ─────────────────────────────────────────────
// Locais físicos
// ─────────────────────────────────────────────
export interface Local {
  id: string;
  nome: string;
  descricao?: string;
}

// ─────────────────────────────────────────────
// Aviso fixado no dashboard
// ─────────────────────────────────────────────
export interface AvisoFixado {
  conteudo: string;
  ativo: boolean;
  atualizadoEm: string; // ISO datetime
}

// ─────────────────────────────────────────────
// Galeria pública
// ─────────────────────────────────────────────
export interface FotoGaleria {
  id: string;
  titulo: string;
  url: string;        // placeholder URL
  data: string;
}

// ─────────────────────────────────────────────
// Notificações
// ─────────────────────────────────────────────
export type TipoNotificacao = "aviso" | "escala" | "evento" | "ministerio" | "sistema";

export interface Notificacao {
  id: string;
  titulo: string;
  corpo: string;
  tipo: TipoNotificacao;
  lida: boolean;
  criadaEm: string;    // ISO datetime
  link?: string;       // rota interna (ex: /dashboard/ministerio/Louvor)
  ministerio?: Ministerio;
}

// ─────────────────────────────────────────────
// Canal de ministério
// ─────────────────────────────────────────────
export interface CanalMinisterio {
  ministerio: Ministerio;
  descricao: string;
  chatBloqueado: boolean;  // quando true, apenas líder/pastor/admin envia
  cor: string;             // tailwind color token (ex: "vine", "grape")
}

// ─────────────────────────────────────────────
// Chat — mensagens diretas, culto e ministério
// ─────────────────────────────────────────────

export interface MensagemConversa {
  id: string;
  autorId: string;
  autorNome: string;
  conteudo: string;
  tipo?: TipoMensagem;    // default "texto"
  mediaUrl?: string;
  criadoEm: string;       // ISO datetime
  editadoEm?: string;     // ISO datetime — preenchido após edição
  lida?: boolean;
  reacoes?: { emoji: string; count: number }[];
  respostaA?: { id: string; autorNome: string; conteudo: string };
}

/** Conversa direta (1:1) entre dois usuários */
export interface ConversaDireta {
  id: string;
  participantes: [string, string];          // User.id
  participantesNomes: [string, string];
  mensagens: MensagemConversa[];
}

/** Tipo de grupo de conversa */
export type TipoGrupo = "geral" | "lideranca" | "ministerio" | "culto" | "evento";

/**
 * Grupo de conversa unificado — substitui ChatCulto para grupos de culto/evento
 * e representa também grupos gerais, de liderança e de ministério.
 */
export interface Grupo {
  id: string;
  nome: string;
  tipo: TipoGrupo;
  emoji: string;
  cor: string;            // classe tailwind bg (ex: "bg-vine-700")
  descricao?: string;
  ministerio?: Ministerio; // preenchido quando tipo === "ministerio"
  eventoId?: string;       // ref a Evento.id para tipo "culto" | "evento"
  data?: string;           // ISO date — para cultos e eventos especiais
  horario?: string;
  /** Se true, somente pastores/admin/líderes podem enviar mensagens */
  somenteAdmin?: boolean;
  /** IDs dos usuários que fazem parte deste grupo */
  membros: string[];
  /** ID do criador/admin do grupo */
  adminId?: string;
  /**
   * Se true, grupo institucional (ministério, geral, culto).
   * Usuários não podem sair nem excluir — só o admin remove membros.
   */
  institucional?: boolean;
  mensagens: MensagemConversa[];
}

/** Chat coletivo vinculado a um culto / evento (mantido por compatibilidade) */
export interface ChatCulto {
  id: string;
  eventoId?: string;   // ref a Evento.id (opcional)
  titulo: string;      // ex: "Culto Domingo 20/04"
  data: string;        // ISO date
  horario: string;
  mensagens: MensagemConversa[];
}

// ─────────────────────────────────────────────
// Membro dentro de um ministério
// ─────────────────────────────────────────────
export type FuncaoMinisterio = "Líder" | "Sub-líder" | "Membro" | "Visitante";

export interface MembroMinisterio {
  id: string;          // ref para User.id
  nome: string;
  email: string;
  telefone?: string;
  funcao: FuncaoMinisterio;
  ministerio: Ministerio;
  ativo: boolean;
  dataEntrada: string; // ISO date
  /**
   * Permissões específicas para este canal de ministério.
   * Sobrescrevem as permissões globais do usuário dentro do contexto deste canal.
   */
  permissoesCanal?: Permissao[];
}
