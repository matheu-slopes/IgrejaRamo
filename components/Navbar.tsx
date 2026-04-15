"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Church,
  LayoutDashboard,
  CalendarDays,
  UserPlus,
  Info,
  LogOut,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/cadastro", label: "Cadastro", icon: UserPlus },
  { href: "/sobre", label: "Sobre", icon: Info },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <nav className="bg-indigo-700 text-white w-full">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <Church className="w-6 h-6" />
          Ramo
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition",
                pathname === href
                  ? "bg-indigo-900"
                  : "hover:bg-indigo-600"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-indigo-200 hidden sm:block">
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
