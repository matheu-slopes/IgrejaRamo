"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { mockConversasDiretas, mockChatsCulto } from "@/lib/mockData";
import {
  Church,
  LayoutDashboard,
  CalendarDays,
  UserPlus,
  Info,
  LogOut,
  MessageSquare,
} from "lucide-react";
import clsx from "clsx";

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  // Unread message count for the badge
  const unreadCount = user
    ? [
        ...mockConversasDiretas
          .filter((dm) => dm.participantes.includes(user.id))
          .flatMap((dm) => dm.mensagens.filter((m) => m.autorId !== user.id && !m.lida)),
        ...mockChatsCulto.flatMap((c) =>
          c.mensagens.filter((m) => m.autorId !== user.id && !m.lida)
        ),
      ].length
    : 0;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/chat", label: "Mensagens", icon: MessageSquare, badge: unreadCount },
    { href: "/eventos", label: "Eventos", icon: CalendarDays },
    { href: "/cadastro", label: "Cadastro", icon: UserPlus },
    { href: "/sobre", label: "Sobre", icon: Info },
  ];

  return (
    <nav className="bg-vine-800 text-white w-full">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <Church className="w-6 h-6" />
          Ramo
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition relative",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-vine-950"
                  : "hover:bg-vine-700"
              )}
            >
              <span className="relative">
                <Icon className="w-4 h-4" />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-vine-300 hidden sm:block">
              {user.nome.split(" ")[0]} · {user.role}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm hover:text-red-300 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
