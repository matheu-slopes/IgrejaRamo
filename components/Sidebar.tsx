"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";
import { useChatUnread } from "@/contexts/ChatUnreadContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  CalendarCheck,
  MessageSquare,
  CalendarDays,
  LogOut,
  Music,
  Video,
  BookOpen,
  Baby,
  HeartHandshake,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sparkles,
} from "lucide-react";

const navMain = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/escalas", label: "Escalas", icon: CalendarCheck },
  { href: "/dashboard/chat", label: "Conversas", icon: MessageSquare },
  { href: "/dashboard/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/dashboard/push-diag", label: "Push", icon: Bell },
];

const navAdmin = [
  { href: "/dashboard/admin?tab=usuarios", label: "Usuários", icon: Users },
  { href: "/dashboard/admin?tab=ministerios", label: "Ministérios", icon: Shield },
  { href: "/dashboard/admin?tab=locais", label: "Locais", icon: CalendarDays },
  { href: "/dashboard/admin?tab=conteudo&secao=avisos", label: "Avisos", icon: Bell },
  { href: "/dashboard/admin?tab=conteudo&secao=devocional", label: "Devocional", icon: BookOpen },
];

const MINISTERIOS_PADRAO = ["Louvor", "Mídias", "Ensino", "Infantil", "Ação Social", "Jovens", "Recepcionamento", "Limpeza"];

const ICONES_MINISTERIO: Record<string, typeof Music> = {
  Louvor: Music,
  "Mídias": Video,
  Ensino: BookOpen,
  Infantil: Baby,
  "Ação Social": HeartHandshake,
  Jovens: Users,
  Recepcionamento: Users,
  Limpeza: Sparkles,
};

function montarItemMinisterio(nome: string) {
  return { value: nome, label: nome, icon: ICONES_MINISTERIO[nome] ?? Shield };
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout, temPermissao } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [ministerios, setMinisterios] = useState(() => MINISTERIOS_PADRAO.map(montarItemMinisterio));
  const { totalUnread } = useChatUnread();
  const { counts, marcarTipo, marcarMinisterio } = useNotifications();

  useEffect(() => {
    supabase
      .from("canais_ministerio")
      .select("ministerio")
      .order("ministerio")
      .then(({ data, error }) => {
        if (!error && data?.length) {
          setMinisterios(data.map((c) => montarItemMinisterio(c.ministerio as string)));
        }
      });
  }, []);

  function isActive(href: string) {
    const [hPath, hQuery] = href.split("?");
    if (pathname !== hPath) return false;
    if (!hQuery) return true;
    return hQuery.split("&").every((pair) => {
      const [key, val] = pair.split("=");
      return searchParams.get(key) === val;
    });
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside
      className={clsx(
        "relative hidden md:flex flex-col h-full bg-vine-900 text-white transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 bg-vine-700 rounded-full p-0.5 shadow text-white hover:bg-vine-600 transition z-10"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="flex items-center gap-3 px-4 h-16 border-b border-vine-700">
        <Image
          src="/logo.png"
          alt="Ramo da Vida"
          width={32}
          height={32}
          className="h-8 w-auto shrink-0"
          style={{ filter: "brightness(0) invert(1)", opacity: 0.9 }}
        />
        {!collapsed && <span className="font-bold text-white text-base truncate">Ramo da Vida</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2" style={{ scrollbarWidth: "none" }}>
        {navMain.map(({ href, label, icon: Icon }) => {
          const isChat = href === "/dashboard/chat";
          const badge =
            isChat ? totalUnread :
            href === "/dashboard" ? counts.avisos :
            href === "/dashboard/escalas" ? counts.escalas :
            href === "/dashboard/eventos" ? counts.eventos :
            0;
          const hasBadge = badge > 0 && !(isChat && pathname === "/dashboard/chat");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => {
                if (href === "/dashboard") marcarTipo("aviso");
                if (href === "/dashboard/escalas") marcarTipo("escala");
                if (href === "/dashboard/eventos") marcarTipo("evento");
              }}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
                pathname === href ? "bg-vine-600 text-white" : "text-vine-100/80 hover:bg-vine-800 hover:text-white"
              )}
              title={collapsed ? label : undefined}
            >
              <div className="relative shrink-0">
                <Icon className="w-5 h-5" />
                {hasBadge && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {(() => {
          const meusItens = ministerios.filter((m) => {
            if (user?.role === "admin" || user?.role === "pastor") return true;
            const pertence = user?.ministerios?.some((um) => um.toLowerCase() === m.value.toLowerCase());
            const eLider = user?.liderMinisterios?.some((um) => um.toLowerCase() === m.value.toLowerCase());
            return pertence || eLider;
          });
          if (meusItens.length === 0) return null;
          return (
            <>
              {!collapsed && (
                <p className="px-3 pt-5 pb-1 text-xs font-bold uppercase tracking-widest text-vine-300/70">
                  Meus Ministérios
                </p>
              )}
              {collapsed && <div className="border-t border-vine-700 my-3 mx-1" />}
              {meusItens.map(({ value, label, icon: Icon }) => {
                const eLider = user?.liderMinisterios?.some((um) => um.toLowerCase() === value.toLowerCase());
                const isAtivo = pathname.includes("/ministerio/") && decodeURIComponent(pathname).includes(value);
                const badge = counts.ministerios[value] ?? 0;
                return (
                  <Link
                    key={value}
                    href={`/dashboard/ministerio/${encodeURIComponent(value)}`}
                    onClick={() => marcarMinisterio(value)}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
                      isAtivo ? "bg-vine-600 text-white" : "text-vine-100/80 hover:bg-vine-800 hover:text-white"
                    )}
                    title={collapsed ? label : undefined}
                  >
                    <div className="relative shrink-0">
                      <Icon className="w-4 h-4" />
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[13px] h-[13px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <span className="flex items-center gap-1 flex-1">
                        {label}
                        {eLider && (
                          <span className="ml-auto text-[9px] font-bold uppercase tracking-wide bg-white/30 text-white rounded px-1 leading-4">
                            líder
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                );
              })}
            </>
          );
        })()}

        {temPermissao("gerenciar_usuarios") && (
          <>
            {!collapsed && (
              <p className="px-3 pt-5 pb-1 text-xs font-bold uppercase tracking-widest text-vine-300/70">
                Painel Admin
              </p>
            )}
            {collapsed && <div className="border-t border-vine-700 my-3 mx-1" />}
            {navAdmin.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                  isActive(href) ? "bg-vine-600 text-white" : "text-vine-100/80 hover:bg-vine-800 hover:text-white"
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            ))}
          </>
        )}

        {!temPermissao("gerenciar_usuarios") && temPermissao("criar_aviso") && (
          <>
            {!collapsed && (
              <p className="px-3 pt-5 pb-1 text-xs font-bold uppercase tracking-widest text-vine-300/70">
                Conteúdo
              </p>
            )}
            {collapsed && <div className="border-t border-vine-700 my-3 mx-1" />}
            {[
              { href: "/dashboard/admin?tab=conteudo&secao=avisos", label: "Avisos", icon: Bell },
              { href: "/dashboard/admin?tab=conteudo&secao=devocional", label: "Devocional", icon: BookOpen },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                  isActive(href) ? "bg-vine-600 text-white" : "text-vine-100/80 hover:bg-vine-800 hover:text-white"
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div
        className="border-t border-vine-700 p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {user && !collapsed && (
          <div className="mb-2 px-1">
            <p className="text-xs font-semibold text-white truncate">{user.nome.split(" ")[0]}</p>
            <p className="text-xs text-vine-300/70 capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-vine-300/70 hover:bg-vine-800 hover:text-white transition w-full"
          title="Sair"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
