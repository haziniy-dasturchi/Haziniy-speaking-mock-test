"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Users, LogOut, Layers } from "lucide-react";
import { SessionPayload } from "@/lib/auth/session";

interface NavbarProps {
  user: SessionPayload;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const isAdmin = user.role === "admin";

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/mocks" className="flex items-center gap-3">
            <img
              src="/brand/logo-full.png"
              alt="Haziniy ilm maskani"
              className="h-11 w-auto object-contain select-none"
            />
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium">
            <Link
              href="/mocks"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition ${
                pathname === "/mocks"
                  ? "bg-[#0B4F37] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Mening mocklarim</span>
            </Link>

            {isAdmin && (
              <>
                <Link
                  href="/mocks?scope=all"
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition ${
                    pathname === "/mocks" && typeof window !== "undefined" && window.location.search.includes("scope=all")
                      ? "bg-[#0B4F37] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Barcha mocklar</span>
                </Link>

                <Link
                  href="/admin/teachers"
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition ${
                    pathname.startsWith("/admin/teachers")
                      ? "bg-[#0B4F37] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>O'qituvchilar</span>
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col text-right hidden sm:block">
            <span className="text-sm font-semibold text-slate-900">{user.fullName}</span>
            <div className="flex items-center justify-end gap-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isAdmin
                    ? "bg-purple-100 text-purple-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {isAdmin ? "Admin" : "O'qituvchi"}
              </span>
              <span className="text-xs text-slate-400">@{user.login}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-3 py-2 rounded-lg transition"
            title="Tizimdan chiqish"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Chiqish</span>
          </button>
        </div>
      </div>
    </header>
  );
}
