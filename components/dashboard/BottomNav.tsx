"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useChatUnread } from "@/contexts/ChatUnreadContext";
import {
  LayoutDashboard, CalendarCheck, MessageSquare, CalendarDays,
  MoreHorizontal, X, Users, Shield, Bell, BookOpen, Music, Video,
  Baby, HeartHandshake, CalendarDays as CalDays,
} from "lucide-react";
import clsx from "clsx";
import { useState } from "react";

const navItems = [
  { href: "/dashboard",         label: "Início",  icon: LayoutDashboard },
  { href: "/dashboard/escalas", label: "Escalas", icon: CalendarCheck   },
  { href: "/dashboard/chat",    label: "Chat",    icon: MessageSquare   },
  { href: "/dashboard/eventos", label: "Eventos", icon: CalendarDays    },
];

const ministeriosMap: Record<string, { icon: React.ElementType; href: string }> = {
  "Louvor":      { icon: Music,          href: "/dashboard/ministerio/Louvor" },
  "Mídias":      { icon: Video,          href: "/dashboard/ministerio/M%C3%ADdias" },
  "Ensino":      { icon: BookOpen,       href: "/dashboard/ministerio/Ensino" },
  "Infantil":    { icon: Baby,           href: "/dashboard/ministerio/Infantil" },
  "Ação Social": { icon: HeartHandshake, href: "/dashboard/ministerio/A%C3%A7%C3%A3o%20Social" },
  "Jovens":      { icon: Users,          href: "/dashboard/ministerio/Jovens" },
};

const navAdmin = [
  { href: "/dashboard/admin?tab=usuarios",                  label: "Usuários",    icon: Users    },
  { href: "/dashboard/admin?tab=ministerios",               label: "Ministérios", icon: Shield   },
  { href: "/dashboard/admin?tab=locais",                    label: "Locais",      icon: CalDays  },
  { href: "/dashboard/admin?tab=conteudo&secao=avisos",     label: "Avisos",      icon: Bell     },
  { href: "/dashboard/admin?tab=conteudo&secao=devocional", label: "Devocional",  icon: BookOpen },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { totalUnread } = useChatUnread();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "pastor";
  const meusMinisterios = isAdmin
    ? Object.keys(ministeriosMap)
    : (user?.ministerios ?? []).filter((m) => ministeriosMap[m]);

  const hasExtras = meusMinisterios.length > 0 || isAdmin;

  return (
    <>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer sheet */}
      <div
        className={clsx(
          "fixed bottom-0 inset-x-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl transition-transform duration-300",
          drawerOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800">Menu</span>
          <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-full hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] px-4 py-3 space-y-4">
          {/* Membros — sempre aparece */}
          <Link
            href="/dashboard/membros"
            onClick={() => setDrawerOpen(false)}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition",
              pathname === "/dashboard/membros"
                ? "bg-vine-50 text-vine-700"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-gray-600" />
            </div>
            Membros
          </Link>

          {/* Meus Ministérios */}
          {meusMinisterios.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">
                Meus Ministérios
              </p>
              <div className="grid grid-cols-2 gap-2">
                {meusMinisterios.map((nome) => {
                  const m = ministeriosMap[nome];
                  if (!m) return null;
                  const Icon = m.icon;
                  const active = pathname.includes("/ministerio/") && decodeURIComponent(pathname).includes(nome);
                  return (
                    <Link
                      key={nome}
                      href={m.href}
                      onClick={() => setDrawerOpen(false)}
                      className={clsx(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition",
                        active ? "bg-vine-50 text-vine-700" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{nome}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Painel Admin */}
          {isAdmin && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">
                Painel Admin
              </p>
              <div className="space-y-1">
                {navAdmin.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith("/dashboard/admin") && href.includes(pathname.split("?")[0]);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDrawerOpen(false)}
                      className={clsx(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition",
                        active ? "bg-vine-50 text-vine-700" : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-gray-600" />
                      </div>
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-gray-100 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const isChat = href === "/dashboard/chat";
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative",
                active ? "text-vine-700" : "text-gray-400"
              )}
            >
              <div className="relative">
                <Icon className={clsx("w-5 h-5 transition-transform", active && "scale-110")} />
                {isChat && totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </div>
              <span className={clsx("text-[10px] font-semibold leading-none", active ? "text-vine-700" : "text-gray-400")}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-vine-600 rounded-full" />
              )}
            </Link>
          );
        })}

        {/* Botão Mais */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={clsx(
            "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative",
            drawerOpen ? "text-vine-700" : "text-gray-400"
          )}
        >
          <div className="relative">
            <MoreHorizontal className={clsx("w-5 h-5 transition-transform", drawerOpen && "scale-110")} />
            {/* Badge se usuário tem admin ou ministérios */}
            {hasExtras && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-vine-500" />
            )}
          </div>
          <span className={clsx("text-[10px] font-semibold leading-none", drawerOpen ? "text-vine-700" : "text-gray-400")}>
            Mais
          </span>
          {drawerOpen && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-vine-600 rounded-full" />
          )}
        </button>
      </nav>
    </>
  );
}
