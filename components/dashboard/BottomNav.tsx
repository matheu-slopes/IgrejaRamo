"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useChatUnread } from "@/contexts/ChatUnreadContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { usePendingScaleConfirmations } from "@/hooks/usePendingScaleConfirmations";
import { userMinisterios } from "@/lib/userMinistries";
import { caminhoMinisterio, ministeriosNoMenu } from "@/lib/navegacaoMinisterios";
import { supabase } from "@/lib/supabase";
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

const ministeriosIcones: Record<string, React.ElementType> = {
  "Louvor": Music, "Mídias": Video, "Ensino": BookOpen, "Infantil": Baby,
  "Ação Social": HeartHandshake, "Jovens": Users, "Recepcionamento": Users,
  "Limpeza": Sparkles, "Oração": Shield,
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
  const searchParams = useSearchParams();
  const { user, temPermissao } = useAuth();
  const { totalUnread } = useChatUnread();
  const { counts, marcarTipo, marcarMinisterio } = useNotifications();
  const { count: escalasPendentes } = usePendingScaleConfirmations(user?.id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ministerios, setMinisterios] = useState<string[] | null>(null);
  const [estadoMinisterios, setEstadoMinisterios] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [tentativaMinisterios, setTentativaMinisterios] = useState(0);
  const ministeriosCarregados = useRef(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);



  const isAdmin = user?.role === "admin" || user?.role === "pastor";
  const podeGerenciarMinisterios = isAdmin && temPermissao("gerenciar_usuarios");
  const associados = userMinisterios(user);
  const meusMinisterios = ministeriosNoMenu(ministerios, associados, isAdmin);

  useEffect(() => {
    if (!drawerOpen && ministeriosCarregados.current) return;
    let ativo = true;
    supabase.from("canais_ministerio").select("ministerio").order("ministerio").then(({ data, error }) => {
      if (!ativo) return;
      if (error || !data) { setEstadoMinisterios("erro"); return; }
      ministeriosCarregados.current = true;
      setMinisterios(data.map((item) => item.ministerio).filter((nome): nome is string => typeof nome === "string" && nome.trim().length > 0));
      setEstadoMinisterios("pronto");
    }, () => { if (ativo) setEstadoMinisterios("erro"); });
    return () => { ativo = false; };
  }, [drawerOpen, tentativaMinisterios]);

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
        inert={!drawerOpen}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-gray-100">
          <div><span className="block text-base font-bold text-gray-900">Menu</span><span className="block text-xs text-gray-500">Acesse seus ministérios e recursos</span></div>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Fechar menu"
            className="nav-item h-10 w-10 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain max-h-[60dvh] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-4">
          {/* Meus Ministérios */}
          <div>
              <div className="flex items-center justify-between px-1 mb-2"><p className="text-xs font-bold uppercase tracking-wide text-gray-600">Meus ministérios</p>{estadoMinisterios === "pronto" && <span className="text-xs text-gray-500">{meusMinisterios.length}</span>}</div>
              {estadoMinisterios === "erro" && <div role="status" className="mb-2 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">Não foi possível atualizar os ministérios. <button type="button" onClick={() => { ministeriosCarregados.current = false; setEstadoMinisterios("carregando"); setTentativaMinisterios((n) => n + 1); }} className="font-semibold underline">Tentar novamente</button></div>}
              {ministerios === null && estadoMinisterios === "carregando" ? <p role="status" className="rounded-xl bg-gray-50 px-3 py-4 text-sm text-gray-600">Carregando ministérios...</p> : meusMinisterios.length === 0 && estadoMinisterios === "pronto" ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                  <p className="font-semibold text-gray-800">{isAdmin ? "Nenhum ministério cadastrado" : "Você ainda não participa de um ministério"}</p>
                  <p className="mt-1 text-xs leading-relaxed">{podeGerenciarMinisterios ? "Cadastre o primeiro ministério para começar a organizar sua igreja." : isAdmin ? "Quando um ministério for cadastrado, ele aparecerá aqui." : "Quando você for adicionado a um ministério, ele aparecerá aqui."}</p>
                  {podeGerenciarMinisterios && <Link href="/dashboard/admin?tab=ministerios" onClick={() => setDrawerOpen(false)} className="mt-3 inline-flex min-h-10 items-center font-semibold text-vine-700 underline">Gerenciar ministérios</Link>}
                </div>
              ) : meusMinisterios.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {meusMinisterios.map((nome) => {
                  const Icon = ministeriosIcones[nome] ?? Shield;
                  const active = pathname.includes("/ministerio/") && decodeURIComponent(pathname).includes(nome);
                  const badge = counts.ministerios[nome] ?? 0;
                  return (
                    <Link
                      key={nome}
                      href={caminhoMinisterio(nome)}
                      onClick={() => { marcarMinisterio(nome); setDrawerOpen(false); }}
                      className={clsx(
                        "nav-item min-h-11 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold",
                        active ? "bg-vine-100 text-vine-900 ring-1 ring-vine-300" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
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
              )}
          </div>

          {/* Painel Admin */}
          {isAdmin && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-600 px-1 mb-2">
                Painel Admin
              </p>
              <div className="grid grid-cols-2 gap-2">
                {navAdmin.map(({ href, label, icon: Icon }) => {
                  const params = new URLSearchParams(href.split("?")[1]);
                  const active = pathname === "/dashboard/admin" && [...params.entries()].every(([key, value]) => searchParams.get(key) === value);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDrawerOpen(false)}
                      className={clsx(
                        "nav-item min-h-11 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold",
                        active ? "bg-vine-100 text-vine-900" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
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
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600 px-1 mb-2">
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
        className="bottom-nav relative z-30 md:hidden bg-white border-t border-gray-100 flex items-stretch shrink-0 min-h-16 overflow-visible shadow-[0_-8px_24px_rgba(15,23,42,0.05)]"
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
            const active = pathname.includes("/ministerio/") && decodeURIComponent(pathname).includes(nome);
            const badge = counts.ministerios[nome] ?? 0;
            return (
              <NavItem
                href={caminhoMinisterio(nome)}
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
            aria-expanded={drawerOpen}
            aria-label="Abrir menu de ministérios"
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
            aria-expanded={drawerOpen}
            aria-label="Abrir menu"
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
