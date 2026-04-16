"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, Permissao } from "@/types";
import { mockUsers } from "@/lib/mockData";
import { temPermissao as checkPermissao } from "@/lib/permissions";

const STORAGE_KEY      = "ramo_user";
const USERS_STORAGE_KEY = "ramo_users";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isLoading: boolean;
  /** Verifica se o usuário logado tem uma determinada permissão */
  temPermissao: (p: Permissao) => boolean;
  /** Lista de todos os usuários — gerenciável pelo admin */
  usuarios: User[];
  /** Atualiza um usuário (role, permissoes, ativo, etc.) — salva localmente */
  atualizarUsuario: (id: string, dados: Partial<User>) => void;
  /** Cria um novo usuário */
  criarUsuario: (dados: Omit<User, "id">) => User;
  /** Remove um usuário */
  removerUsuario: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuarios, setUsuarios] = useState<User[]>(mockUsers);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Carrega usuários gerenciados (se admin editou algo nessa sessão)
    const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (storedUsers) {
      setUsuarios(JSON.parse(storedUsers));
    }

    // Carrega usuário logado
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: User = JSON.parse(stored);
      // Recarrega da lista atualizada para pegar permissões atuais
      const lista: User[] = storedUsers ? JSON.parse(storedUsers) : mockUsers;
      const atualizado = lista.find((u) => u.id === parsed.id) ?? parsed;
      setUser(atualizado);
    }
    setIsLoading(false);
  }, []);

  function persistirUsuarios(lista: User[]) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(lista));
    setUsuarios(lista);
  }

  function login(email: string, _password: string): boolean {
    const found = usuarios.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.ativo
    );
    if (found) {
      setUser(found);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  function temPermissao(p: Permissao): boolean {
    return checkPermissao(user, p);
  }

  function atualizarUsuario(id: string, dados: Partial<User>) {
    const lista = usuarios.map((u) => u.id === id ? { ...u, ...dados } : u);
    persistirUsuarios(lista);
    // Se o usuário que está sendo editado é o logado, atualiza sessão
    if (user?.id === id) {
      const atualizado = lista.find((u) => u.id === id)!;
      setUser(atualizado);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizado));
    }
  }

  function criarUsuario(dados: Omit<User, "id">): User {
    const novo: User = { ...dados, id: `user-${Date.now()}` };
    const lista = [...usuarios, novo];
    persistirUsuarios(lista);
    return novo;
  }

  function removerUsuario(id: string) {
    const lista = usuarios.filter((u) => u.id !== id);
    persistirUsuarios(lista);
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
