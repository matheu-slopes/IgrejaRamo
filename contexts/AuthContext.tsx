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
import { temPermissao as checkPermissao, temPermissaoNoMinisterio as checkPermissaoMin } from "@/lib/permissions";
import { useAppRefresh } from "@/hooks/useAppRefresh";

// Converte linha da tabela `perfis` para o tipo User do app
function rowToUser(row: Record<string, unknown>): User {
  return {
    id:                row.id as string,
    nome:              row.nome as string,
    email:             row.email as string,
    telefone:          (row.telefone as string) ?? undefined,
    foto:              (row.foto as string) ?? undefined,
    role:              row.role as User["role"],
    ministerios:       (row.ministerios as User["ministerios"]) ?? [],
    liderMinisterios:  (row.lider_ministerios as User["ministerios"])?.length
                         ? (row.lider_ministerios as User["ministerios"])
                         : undefined,
    dataIngresso:      row.data_ingresso as string,
    ativo:             row.ativo as boolean,
    primeiroAcesso:    (row.primeiro_acesso as boolean) ?? false,
    permissoes:        (row.permissoes as Permissao[])?.length
                         ? (row.permissoes as Permissao[])
                         : undefined,
  };
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<false | { role: string }>;
  logout: () => void;
  isLoading: boolean;
  /** Verifica se o usuário logado tem uma determinada permissão globalmente */
  temPermissao: (p: Permissao) => boolean;
  /** Verifica permissão no contexto de um ministério específico (inclui líderes nomeados) */
  temPermissaoNoMinisterio: (p: Permissao, ministerio: string) => boolean;
  /** Lista de todos os usuários — gerenciável pelo admin */
  usuarios: User[];
  /** Atualiza um usuário (role, permissoes, ativo, etc.) no Supabase */
  atualizarUsuario: (id: string, dados: Partial<User>) => Promise<void>;
  /** Cria um novo usuário no Supabase Auth + perfis. A senha é definida pelo admin. */
  criarUsuario: (dados: Omit<User, "id">, senha: string) => Promise<{ user: User } | { error: string }>;
  /** Remove um usuário */
  removerUsuario: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function carregarPerfil(uid: string): Promise<User | null> {
    const { data, error } = await supabase.from("perfis").select("*").eq("id", uid).single();
    if (data) {
      const u = rowToUser(data);
      setUser(u);
      return u;
    }
    // Se a tabela não existir ainda (schema não rodou), não quebra
    if (error?.code === "42P01") return null;
    // Se o perfil não existe, cria com dados mínimos do auth
    if (error?.code === "PGRST116") {
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser?.user) {
        const { data: novo } = await supabase.from("perfis").upsert({
          id:    authUser.user.id,
          nome:  authUser.user.user_metadata?.nome ?? authUser.user.email,
          email: authUser.user.email,
          role:  "membro",
        }).select().single();
        if (novo) {
          const u = rowToUser(novo);
          setUser(u);
          return u;
        }
      }
      return null;
    }
    // RLS bloqueou ou outro erro — tenta buscar via getUser como fallback
    if (error) {
      try {
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user) {
          const u: User = {
            id: authUser.user.id,
            nome: authUser.user.user_metadata?.nome ?? authUser.user.email ?? "Usuário",
            email: authUser.user.email ?? "",
            role: "membro",
            ministerios: [],
            dataIngresso: new Date().toISOString().slice(0, 10),
            ativo: true,
          };
          setUser(u);
          return u;
        }
      } catch {
        // não foi possível carregar perfil, usuário permanece null
      }
    }
    return null;
  }

  async function carregarTodosUsuarios() {
    const { data } = await supabase.from("perfis").select("*").order("nome");
    if (data) setUsuarios(data.map(rowToUser));
  }

  useEffect(() => {
    let initialLoadDone = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          await Promise.race([
            carregarPerfil(session.user.id),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
          ]);
          carregarTodosUsuarios();
        } catch {
          // timeout ou erro — libera o loading mesmo assim
        }
      }
      initialLoadDone = true;
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Ignora o disparo inicial que ocorre junto com getSession
      if (!initialLoadDone) return;
      if (session?.user) {
        await carregarPerfil(session.user.id).catch(() => {});
        carregarTodosUsuarios();
      } else {
        setUser(null);
        setUsuarios([]);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAppRefresh(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await carregarPerfil(session.user.id).catch(() => {});
    carregarTodosUsuarios();
  }, [], { runOnMount: false, minIntervalMs: 3000 });

  async function login(email: string, password: string): Promise<false | { role: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return false;
      let role = "membro";
      try {
        const u = await Promise.race([
          carregarPerfil(data.user.id),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        if (u) role = u.role;
        carregarTodosUsuarios();
      } catch {
        // login ok, mas perfil não carregou — onAuthStateChange vai tentar de novo
      }
      return { role };
    } catch {
      return false;
    }
  }

  function logout() {
    supabase.auth.signOut();
  }

  function temPermissao(p: Permissao): boolean {
    return checkPermissao(user, p);
  }

  function temPermissaoNoMinisterio(p: Permissao, ministerio: string): boolean {
    return checkPermissaoMin(user, p, ministerio);
  }

  async function atualizarUsuario(id: string, dados: Partial<User>) {
    await fetch("/api/atualizar-perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...dados }),
    });
    setUsuarios((prev) => prev.map((u) => u.id === id ? { ...u, ...dados } : u));
    if (user?.id === id) setUser((prev) => prev ? { ...prev, ...dados } : prev);
  }

  async function criarUsuario(dados: Omit<User, "id">, senha: string): Promise<{ user: User } | { error: string }> {
    const res = await fetch("/api/criar-usuario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:             dados.email,
        senha,
        nome:              dados.nome,
        telefone:          dados.telefone,
        role:              dados.role,
        ministerios:       dados.ministerios,
        liderMinisterios:  dados.liderMinisterios ?? [],
        dataIngresso:      dados.dataIngresso,
        ativo:             dados.ativo,
        permissoes:        dados.permissoes ?? [],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error ?? "Erro desconhecido ao criar usuário." };
    const novo: User = { ...dados, id: json.id };
    setUsuarios((prev) => [...prev, novo]);
    return { user: novo };
  }

  async function removerUsuario(id: string) {
    await supabase.from("perfis").delete().eq("id", id);
    setUsuarios((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isLoading, temPermissao, temPermissaoNoMinisterio, usuarios, atualizarUsuario, criarUsuario, removerUsuario }}
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
