"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import clsx from "clsx";
import {
  Church,
  LayoutDashboard,
  CalendarCheck,
  MessageSquare,
  CalendarDays,
  UserPlus,
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
} from "lucide-react";
import { useState } from "react";

const navMain = [
  { href: "/dashboard",          label: "Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/escalas",  label: "Escalas",     icon: CalendarCheck   },
  { href: "/dashboard/mural",    label: "Conversas",  icon: MessageSquare   },
  { href: "/dashboard/eventos",  label: "Eventos",    icon: CalendarDays    },
  { href: "/cadastro",           label: "Membros",    icon: UserPlus        },
];

const ministerios = [
  { label: "Louvor",      icon: Music,          href: "/dashboard/ministerio/Louvor"       },
  { label: "Mídias",      icon: Video,          href: "/dashboard/ministerio/M%C3%ADdias"  },
  { label: "Ensino",      icon: BookOpen,       href: "/dashboard/ministerio/Ensino"       },
  { label: "Infantil",    icon: Baby,           href: "/dashboard/ministerio/Infantil"     },
  { label: "Ação Social", icon: HeartHandshake, href: "/dashboard/ministerio/A%C3%A7%C3%A3o%20Social" },
  { label: "Jovens",      icon: Users,          href: "/dashboard/ministerio/Jovens"       },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, temPermissao } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside
      className={clsx(
        "relative flex flex-col h-screen bg-vine-950 text-vine-100 transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 bg-vine-700 rounded-full p-0.5 shadow text-white hover:bg-vine-500 transition z-10"
        aria-label="Toggle sidebar"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-vine-800">
        <Church className="w-7 h-7 shrink-0 text-gold-400" />
        {!collapsed && (
          <span className="font-bold text-white text-base truncate">
            Ramo da Vida
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {navMain.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
              pathname === href
                ? "bg-vine-700 text-white"
                : "text-vine-300 hover:bg-vine-800 hover:text-white"
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}

        {/* Ministérios section */}
        {!collapsed && (
          <p className="px-3 pt-5 pb-1 text-xs font-bold uppercase tracking-widest text-vine-500">
            Ministérios
          </p>
        )}
        {collapsed && <div className="border-t border-vine-800 my-3 mx-1" />}

        {ministerios.map(({ label, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
              pathname.includes("/ministerio/") && decodeURIComponent(pathname).includes(label)
                ? "bg-vine-700 text-white"
                : "text-vine-400 hover:bg-vine-800 hover:text-white"
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}

        {/* Admin */}
        {temPermissao("gerenciar_usuarios") && (
          <>
            {!collapsed && (
              <p className="px-3 pt-5 pb-1 text-xs font-bold uppercase tracking-widest text-vine-500">
                Sistema
              </p>
            )}
            {collapsed && <div className="border-t border-vine-800 my-3 mx-1" />}
            <Link
              href="/dashboard/admin"
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                pathname === "/dashboard/admin"
                  ? "bg-vine-700 text-white"
                  : "text-vine-400 hover:bg-vine-800 hover:text-white"
              )}
              title={collapsed ? "Painel Admin" : undefined}
            >
              <Shield className="w-5 h-5 shrink-0" />
              {!collapsed && <span>Painel Admin</span>}
            </Link>
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-vine-800 p-3">
        {user && !collapsed && (
          <div className="mb-2 px-1">
            <p className="text-xs font-semibold text-white truncate">
              {user.nome.split(" ")[0]}
            </p>
            <p className="text-xs text-vine-400 capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-vine-400 hover:bg-vine-800 hover:text-white transition w-full"
          title="Sair"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
