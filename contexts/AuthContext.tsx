"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, Permissao } from "@/types";
import { supabase } from "@/lib/supabase";
import { temPermissao as checkPermissao } from "@/lib/permissions";

// Converte linha da tabela `perfis` para o tipo User do app
function rowToUser(row: Record<string, unknown>): User {
  return {
    id:           row.id as string,
    nome:         row.nome as string,
    email:        row.email as string,
    telefone:     (row.telefone as string) ?? undefined,
    foto:         (row.foto as string) ?? undefined,
    role:         row.role as User["role"],
    ministerios:  (row.ministerios as User["ministerios"]) ?? [],
    dataIngresso: row.data_ingresso as string,
    ativo:        row.ativo as boolean,
    permissoes:   (row.permissoes as Permissao[])?.length
                    ? (row.permissoes as Permissao[])
                    : undefined,
  };
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  /** Verifica se o usuário logado tem uma determinada permissão */
  temPermissao: (p: Permissao) => boolean;
  /** Lista de todos os usuários — gerenciável pelo admin */
  usuarios: User[];
  /** Atualiza um usuário (role, permissoes, ativo, etc.) no Supabase */
  atualizarUsuario: (id: string, dados: Partial<User>) => Promise<void>;
  /** Cria um novo usuário no Supabase Auth + perfis. A senha é definida pelo admin. */
  criarUsuario: (dados: Omit<User, "id">, senha: string) => Promise<User | null>;
  /** Remove um usuário */
  removerUsuario: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function carregarPerfil(uid: string) {
    const { data } = await supabase.from("perfis").select("*").eq("id", uid).single();
    if (data) setUser(rowToUser(data));
  }

  async function carregarTodosUsuarios() {
    const { data } = await supabase.from("perfis").select("*").order("nome");
    if (data) setUsuarios(data.map(rowToUser));
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        carregarPerfil(session.user.id);
        carregarTodosUsuarios();
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await carregarPerfil(session.user.id);
        await carregarTodosUsuarios();
      } else {
        setUser(null);
        setUsuarios([]);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string): Promise<boolean> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  }

  function logout() {
    supabase.auth.signOut();
  }

  function temPermissao(p: Permissao): boolean {
    return checkPermissao(user, p);
  }

  async function atualizarUsuario(id: string, dados: Partial<User>) {
    const payload: Record<string, unknown> = {};
    if (dados.nome        !== undefined) payload.nome          = dados.nome;
    if (dados.email       !== undefined) payload.email         = dados.email;
    if (dados.telefone    !== undefined) payload.telefone      = dados.telefone;
    if (dados.foto        !== undefined) payload.foto          = dados.foto;
    if (dados.role        !== undefined) payload.role          = dados.role;
    if (dados.ministerios !== undefined) payload.ministerios   = dados.ministerios;
    if (dados.dataIngresso !== undefined) payload.data_ingresso = dados.dataIngresso;
    if (dados.ativo       !== undefined) payload.ativo         = dados.ativo;
    if (dados.permissoes  !== undefined) payload.permissoes    = dados.permissoes ?? [];

    await supabase.from("perfis").update(payload).eq("id", id);
    setUsuarios((prev) => prev.map((u) => u.id === id ? { ...u, ...dados } : u));
    if (user?.id === id) setUser((prev) => prev ? { ...prev, ...dados } : prev);
  }

  async function criarUsuario(dados: Omit<User, "id">, senha: string): Promise<User | null> {
    const { data, error } = await supabase.auth.signUp({
      email: dados.email,
      password: senha,
      options: { data: { nome: dados.nome } },
    });
    if (error || !data.user) return null;

    // Upsert no perfil com todos os dados (sobrescreve o criado pelo trigger)
    await supabase.from("perfis").upsert({
      id:            data.user.id,
      nome:          dados.nome,
      email:         dados.email,
      telefone:      dados.telefone ?? null,
      role:          dados.role,
      ministerios:   dados.ministerios,
      data_ingresso: dados.dataIngresso,
      ativo:         dados.ativo,
      permissoes:    dados.permissoes ?? [],
    });

    const novo: User = { ...dados, id: data.user.id };
    setUsuarios((prev) => [...prev, novo]);
    return novo;
  }

  async function removerUsuario(id: string) {
    await supabase.from("perfis").delete().eq("id", id);
    setUsuarios((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isLoading, temPermissao, usuarios, atualizarUsuario, criarUsuario, removerUsuario }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
