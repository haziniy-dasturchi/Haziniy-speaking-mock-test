"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!login.trim() || !password.trim()) {
      setErrorMessage("Iltimos, login va parolni kiriting");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: login.trim(),
          password: password.trim(),
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // response was not JSON
      }

      if (!res.ok) {
        if (res.status === 500) {
          setErrorMessage(
            "Server xatoligi (500): Vercel'da DATABASE_URL o'rnatilmagan yoki ma'lumotlar bazasiga ulanib bo'lmadi."
          );
        } else {
          setErrorMessage(data?.error || "Login yoki parol noto'g'ri");
        }
        return;
      }

      router.push("/mocks");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Tarmoq xatoligi yuz berdi. Qayta urinib ko'ring.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-gradient-to-br from-[#0A5D3A] via-[#084A2E] to-[#04331F] relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-white/20 p-8 sm:p-10 relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/brand/logo-full.png"
            alt="Haziniy ilm maskani"
            className="h-16 w-auto object-contain mb-4 select-none drop-shadow-sm"
          />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            CEFR Multilevel Speaking Mock
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">
            O'qituvchilar va ma'muriyat uchun boshqaruv tizimi
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Foydalanuvchi logini
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="masalan: teacher1 yoki admin"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37] focus:border-transparent transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Parol
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37] focus:border-transparent transition"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-[#0B4F37] hover:bg-[#083B29] text-white py-3 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Tekshirilmoqda...</span>
              </>
            ) : (
              <>
                <span>Tizimga kirish</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Haziniy Learning Center • Farg'ona</span>
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <Sparkles className="w-3 h-3 text-emerald-600" /> CEFR Standard
          </span>
        </div>
      </div>
    </div>
  );
}
