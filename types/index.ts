export type Role = "admin" | "pastor" | "lider" | "voluntario" | "membro";

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
  dataIngresso: string; // ISO date
  ativo: boolean;
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
}

export interface Aviso {
  id: string;
  titulo: string;
  conteudo: string;
  criadoEm: string;
  destinatarios: Role[] | "todos";
  ministerio?: Ministerio;
}
