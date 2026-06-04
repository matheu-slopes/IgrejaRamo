"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useChatUnread } from "@/contexts/ChatUnreadContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { usePendingScaleConfirmations } from "@/hooks/usePendingScaleConfirmations";
import { userMinisterios } from "@/lib/userMinistries";
import {
  LayoutDashboard, CalendarCheck, MessageSquare, CalendarDays,
  MoreHorizontal, X, Users, Shield, Bell, BookOpen, Music, Video,
  Baby, HeartHandshake, CalendarDays as CalDays, Layers, Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { useState, useEffect, useRef } from "react";

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
  "Recepcionamento": { icon: Users,      href: "/dashboard/ministerio/Recepcionamento" },
  "Limpeza":     { icon: Sparkles,       href: "/dashboard/ministerio/Limpeza" },
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
  const { counts, marcarTipo, marcarMinisterio } = useNotifications();
  const { count: escalasPendentes } = usePendingScaleConfirmations(user?.id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);



  const isAdmin = user?.role === "admin" || user?.role === "pastor";
  const meusMinisterios = isAdmin
    ? Object.keys(ministeriosMap)
    : userMinisterios(user).filter((m) => ministeriosMap[m]);

  const hasExtras = meusMinisterios.length > 0 || isAdmin;

  // Fecha o drawer ao navegar para outra rota
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Swipe-to-close: arrastar o drawer pra baixo fecha
  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (dy > 60) setDrawerOpen(false); // swipe down 60px+ fecha
  }

  function NavItem({
    href, label, icon: Icon, active, badge, pendingBadge, onClick,
  }: { href: string; label: string; icon: React.ElementType; active: boolean; badge?: number; pendingBadge?: number; onClick?: () => void }) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={clsx(
          "nav-item flex-1 flex flex-col items-center justify-center gap-1 py-2 relative select-none",
          active ? "text-vine-600" : "text-gray-400"
        )}
      >
        <div className="relative">
          <Icon className={clsx("w-5 h-5 transition-transform duration-150", active && "scale-110")} />
          {!!badge && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
          {!!pendingBadge && pendingBadge > 0 && (
            <span className="absolute -bottom-1 -right-1.5 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-white shadow-sm">
              <span className="absolute inset-0 rounded-full bg-amber-300 opacity-60 animate-ping" />
            </span>
          )}
        </div>
        <span className={clsx("text-[10px] font-semibold leading-none", active ? "text-vine-600" : "text-gray-400")}>
          {label}
        </span>
        {active && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-vine-600 rounded-full" />
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer sheet com swipe-to-close */}
      <div
        ref={drawerRef}
        className={clsx(
          "fixed bottom-0 inset-x-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out",
          drawerOpen ? "translate-y-0" : "translate-y-full"
        )}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800">Menu</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="nav-item p-1 rounded-full hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] px-4 py-3 space-y-4">
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
                  const badge = counts.ministerios[nome] ?? 0;
                  return (
                    <Link
                      key={nome}
                      href={m.href}
                      onClick={() => { marcarMinisterio(nome); setDrawerOpen(false); }}
                      className={clsx(
                        "nav-item flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold",
                        active ? "bg-gray-50 text-gray-900" : "bg-gray-50 text-gray-700"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Icon className="w-4 h-4" />
                        {badge > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[13px] h-[13px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </div>
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
                        "nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold",
                        active ? "bg-gray-50 text-gray-900" : "text-gray-700"
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

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">
              Sistema
            </p>
            <Link
              href="/dashboard/push-diag"
              onClick={() => setDrawerOpen(false)}
              className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-gray-600" />
              </div>
              Diagnostico Push
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <nav
        className="bottom-nav relative z-[9999] md:hidden bg-white border-t border-gray-100 flex items-stretch shrink-0 min-h-16 overflow-visible shadow-[0_-8px_24px_rgba(15,23,42,0.05)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const isChat = href === "/dashboard/chat";
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const badge =
            isChat ? totalUnread :
            href === "/dashboard" ? counts.avisos :
            href === "/dashboard/escalas" ? counts.escalas :
            href === "/dashboard/eventos" ? counts.eventos :
            undefined;
          return (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={active}
              badge={badge}
              pendingBadge={href === "/dashboard/escalas" ? escalasPendentes : undefined}
              onClick={() => {
                if (href === "/dashboard") marcarTipo("aviso");
                if (href === "/dashboard/escalas") marcarTipo("escala");
                if (href === "/dashboard/eventos") marcarTipo("evento");
              }}
            />
          );
        })}

        {/* Botão Ministérios / Mais */}
        {meusMinisterios.length === 1 && !isAdmin ? (
          (() => {
            const nome = meusMinisterios[0];
            const m = ministeriosMap[nome];
            const active = m ? (pathname.includes("/ministerio/") && decodeURIComponent(pathname).includes(nome)) : false;
            const badge = counts.ministerios[nome] ?? 0;
            return (
              <NavItem
                href={m?.href ?? "/dashboard"}
                label={nome}
                icon={Layers}
                active={active}
                badge={badge}
                onClick={() => marcarMinisterio(nome)}
              />
            );
          })()
        ) : meusMinisterios.length > 1 ? (
          <button
            onClick={() => setDrawerOpen(true)}
            className={clsx(
              "nav-item flex-1 flex flex-col items-center justify-center gap-1 py-2 relative select-none",
              drawerOpen ? "text-vine-600" : "text-gray-400"
            )}
          >
            <div className="relative">
              <Layers className={clsx("w-5 h-5 transition-transform duration-150", drawerOpen && "scale-110")} />
              {Object.values(counts.ministerios).some((n) => n > 0) && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                  {Math.min(99, Object.values(counts.ministerios).reduce((s, n) => s + n, 0))}
                </span>
              )}
            </div>
            <span className={clsx("text-[10px] font-semibold leading-none", drawerOpen ? "text-vine-600" : "text-gray-400")}>
              Ministérios
            </span>
            {drawerOpen && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-vine-600 rounded-full" />
            )}
          </button>
        ) : (
          <button
            onClick={() => setDrawerOpen(true)}
            className={clsx(
              "nav-item flex-1 flex flex-col items-center justify-center gap-1 py-2 relative select-none",
              drawerOpen ? "text-gray-900" : "text-gray-400"
            )}
          >
            <div className="relative">
              <MoreHorizontal className={clsx("w-5 h-5 transition-transform duration-150", drawerOpen && "scale-110")} />
              {hasExtras && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-gray-500" />
              )}
            </div>
            <span className={clsx("text-[10px] font-semibold leading-none", drawerOpen ? "text-gray-900" : "text-gray-400")}>
              Mais
            </span>
            {drawerOpen && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gray-800 rounded-full" />
            )}
          </button>
        )}
      </nav>
    </>
  );
}
