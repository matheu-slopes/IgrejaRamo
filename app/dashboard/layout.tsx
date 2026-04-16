"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/dashboard/NotificationBell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-vine-950">
        <div className="w-8 h-8 border-4 border-vine-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between shadow-sm">
          <div />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">
                {user.nome.split(" ").slice(0, 2).join(" ")}
              </p>
              <p className="text-xs text-gray-400 capitalize">
                {user.role} · {user.ministerios.join(", ")}
              </p>
            </div>
            <div className="w-8 h-8 bg-vine-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user.nome.charAt(0)}
            </div>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
