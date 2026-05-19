"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useChatUnread } from "@/contexts/ChatUnreadContext";
import {
  LayoutDashboard, CalendarCheck, MessageSquare, CalendarDays,
  MoreHorizontal, X, Users, Shield, Bell, BookOpen, Music, Video,
  Baby, HeartHandshake, CalendarDays as CalDays, Layers,
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
  const drawerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const touchStartY = useRef<number>(0);

  // Mantém o nav pregado na base da tela física no iOS PWA.
  // position:fixed segue o visual viewport; quando ele encolhe (teclado, prompts, sheets)
  // o nav subiria. Usamos translateY para compensar sem causar reflow.
  // Também ouvimos focusout porque o iOS às vezes não dispara 'resize' ao fechar o teclado.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    function pin() {
      const vv = window.visualViewport;
      if (!vv || !el) return;

      // drop: teclado encolheu a viewport (só compensa se > 120px para ignorar quirks)
      const drop = Math.max(0, window.innerHeight - vv.height);
      const keyboardDrop = drop > 120 ? drop : 0;

      // offsetTop: iOS desloca o visual viewport para baixo quando um dialog nativo aparece
      // (permissão de notificação, share sheet, etc). Para elementos fixed bottom:0,
      // isso faz o nav aparecer acima do fundo da tela. translateY(offsetTop) compensa.
      const offsetTop = Math.round(vv.offsetTop ?? 0);

      const totalTranslate = keyboardDrop + offsetTop;
      // Só aplica se for relevante (>10px). Evita "vão" por offsetTop pequeno.
      el.style.transform = totalTranslate > 10 ? `translateY(${totalTranslate}px) translateZ(0)` : "";
    }

    function pinAfterDelay() {
      // Pequeno delay para deixar a animação do teclado terminar antes de reposicionar
      setTimeout(pin, 120);
    }

    function pinOnVisible() {
      // Dialogs nativos (permissão de notificação, teclado) podem deixar a
      // viewport encolhida sem disparar 'resize' ao fechar. Resetamos ao
      // app voltar ao foco ou ficar visível.
      if (document.visibilityState === "visible") {
        setTimeout(pin, 150);
        setTimeout(pin, 500);
      }
    }

    pin();
    window.visualViewport?.addEventListener("resize", pin);
    window.visualViewport?.addEventListener("scroll", pin);
    // Garante restauração quando o teclado fecha (iOS às vezes não dispara 'resize')
    document.addEventListener("focusout", pinAfterDelay);
    // Garante restauração ao voltar ao app (fechar/abrir, trocar de aba)
    document.addEventListener("visibilitychange", pinOnVisible);
    window.addEventListener("focus", pinAfterDelay);

    return () => {
      window.visualViewport?.removeEventListener("resize", pin);
      window.visualViewport?.removeEventListener("scroll", pin);
      document.removeEventListener("focusout", pinAfterDelay);
      document.removeEventListener("visibilitychange", pinOnVisible);
      window.removeEventListener("focus", pinAfterDelay);
    };
  }, []);

  const isAdmin = user?.role === "admin" || user?.role === "pastor";
  const meusMinisterios = isAdmin
    ? Object.keys(ministeriosMap)
    : (user?.ministerios ?? []).filter((m) => ministeriosMap[m]);

  const hasExtras = meusMinisterios.length > 0 || isAdmin;

  // Scroll-lock no body quando o drawer está aberto
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

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
    href, label, icon: Icon, active, badge,
  }: { href: string; label: string; icon: React.ElementType; active: boolean; badge?: number }) {
    return (
      <Link
        href={href}
        className={clsx(
          "nav-item flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative select-none",
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
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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
                  return (
                    <Link
                      key={nome}
                      href={m.href}
                      onClick={() => setDrawerOpen(false)}
                      className={clsx(
                        "nav-item flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold",
                        active ? "bg-gray-50 text-gray-900" : "bg-gray-50 text-gray-700"
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
        ref={navRef}
        className="bottom-nav fixed inset-x-0 z-40 md:hidden bg-white border-t border-gray-100 flex items-stretch"
        style={{
          bottom: 0,
          height: "calc(4rem + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const isChat = href === "/dashboard/chat";
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={active}
              badge={isChat ? totalUnread : undefined}
            />
          );
        })}

        {/* Botão Ministérios / Mais */}
        {meusMinisterios.length === 1 && !isAdmin ? (
          (() => {
            const nome = meusMinisterios[0];
            const m = ministeriosMap[nome];
            const active = m ? (pathname.includes("/ministerio/") && decodeURIComponent(pathname).includes(nome)) : false;
            return (
              <NavItem
                href={m?.href ?? "/dashboard"}
                label={nome}
                icon={Layers}
                active={active}
              />
            );
          })()
        ) : meusMinisterios.length > 1 ? (
          <button
            onClick={() => setDrawerOpen(true)}
            className={clsx(
              "nav-item flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative select-none",
              drawerOpen ? "text-vine-600" : "text-gray-400"
            )}
          >
            <div className="relative">
              <Layers className={clsx("w-5 h-5 transition-transform duration-150", drawerOpen && "scale-110")} />
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
              "nav-item flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative select-none",
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
