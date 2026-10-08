"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  Edit3,
  Copy,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
  Loader2,
  X,
  ExternalLink,
  User,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { SessionPayload } from "@/lib/auth/session";

interface MockItem {
  id: string;
  title: string;
  levelLabel: string;
  status: "draft" | "ready";
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  ownerName?: string;
  ownerLogin?: string;
  questionCount?: number;
}

interface MocksDashboardProps {
  user: SessionPayload;
  initialMocks: MockItem[];
  isAllScope: boolean;
}

export function MocksDashboard({
  user,
  initialMocks,
  isAllScope,
}: MocksDashboardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [mocks, setMocks] = useState<MockItem[]>(initialMocks);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLevel, setNewLevel] = useState("B1–C1");
  const [isCreating, setIsCreating] = useState(false);

  // Deletion modal state
  const [deleteMockItem, setDeleteMockItem] = useState<MockItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicating state
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleCreateMock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsCreating(true);
      const res = await fetch("/api/mocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          levelLabel: newLevel.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Mock yaratishda xatolik");
      }

      showToast("Yangi mock test yaratildi!", "success");
      setIsCreateOpen(false);
      setNewTitle("");
      router.push(`/mocks/${data.mock.id}/edit`);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDuplicate = async (mockId: string) => {
    try {
      setDuplicatingId(mockId);
      const res = await fetch(`/api/mocks/${mockId}/duplicate`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Nusxa olishda xatolik");
      }

      showToast("Mock testdan nusxa olindi!", "success");
      setMocks((prev) => [
        {
          ...data.mock,
          createdAt: data.mock.createdAt,
          updatedAt: data.mock.updatedAt,
        },
        ...prev,
      ]);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteMockItem) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/mocks/${deleteMockItem.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "O'chirishda xatolik");
      }

      setMocks((prev) => prev.filter((m) => m.id !== deleteMockItem.id));
      showToast("Mock test va unga tegishli barcha fayllar o'chirildi", "info");
      setDeleteMockItem(null);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isAllScope ? "Barcha mock testlar" : "Mening mocklarim"}
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#0B4F37]">
              {mocks.length} ta
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {isAllScope
              ? "Markazdagi barcha o'qituvchilar tomonidan yaratilgan mock testlar"
              : "CEFR Multilevel Speaking imtihonlari va darslar uchun savollar to'plamlari"}
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#0B4F37] hover:bg-[#083B29] text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm hover:shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi mock yaratish</span>
        </button>
      </div>

      {/* Mocks Grid */}
      {mocks.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#0B4F37] flex items-center justify-center mx-auto mb-4">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Mock testlar mavjud emas
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Darsda o'tkazish uchun yangi Speaking mock test to'plamini yarating.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 bg-[#0B4F37] hover:bg-[#083B29] text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Mock test qo'shish</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mocks.map((mock) => {
            const isOwnerOrAdmin =
              user.role === "admin" || mock.ownerId === user.userId;

            return (
              <div
                key={mock.id}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group"
              >
                {/* Header */}
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-[#0B4F37] border border-emerald-100">
                      {mock.levelLabel || "B1–C1"}
                    </span>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        mock.status === "ready"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {mock.status === "ready" ? "Tayyor" : "Qoralama"}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-[#0B4F37] transition">
                    {mock.title}
                  </h3>

                  {isAllScope && mock.ownerName && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{mock.ownerName}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-auto pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(mock.updatedAt).toLocaleDateString("uz-UZ")}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Link
                    href={`/mocks/${mock.id}/present`}
                    target="_blank"
                    className="flex-1 flex items-center justify-center gap-1.5 bg-[#0B4F37] hover:bg-[#083B29] text-white py-2 px-3 rounded-xl text-xs font-semibold shadow-sm transition"
                    title="Katta ekranda imtihon rejimida ishga tushirish"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Ishga tushirish</span>
                  </Link>

                  {isOwnerOrAdmin && (
                    <Link
                      href={`/mocks/${mock.id}/edit`}
                      className="p-2 text-slate-600 hover:text-[#0B4F37] hover:bg-emerald-50 rounded-lg transition"
                      title="Tahrirlash"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Link>
                  )}

                  <button
                    onClick={() => handleDuplicate(mock.id)}
                    disabled={duplicatingId === mock.id}
                    className="p-2 text-slate-600 hover:text-[#0B4F37] hover:bg-emerald-50 rounded-lg transition disabled:opacity-50"
                    title="Nusxa olish"
                  >
                    {duplicatingId === mock.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#0B4F37]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => setDeleteMockItem(mock)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="O'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                Yangi mock test yaratish
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMock} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mock test nomi
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="masalan: CEFR Multilevel Mock #1 (Aprel)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Daraja yorlig'i
                </label>
                <input
                  type="text"
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value)}
                  placeholder="B1–C1, B2 yoki C1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37]"
                  required
                />
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-xs text-emerald-800 leading-relaxed">
                Yangi test yaratilganda unga avtomatik ravishda barcha standart qismlar (Part 1.1, Part 1.2, Part 2, Part 3) va rasmiy ko'rsatmalar biriktiriladi.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 bg-[#0B4F37] hover:bg-[#083B29] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow disabled:opacity-60"
                >
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Yaratish va tahrirlash</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteMockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Mock testni o'chirishni tasdiqlaysizmi?
            </h3>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              <strong className="text-slate-800">{deleteMockItem.title}</strong> nomli mock test, unga tegishli barcha savollar va Cloudinary ga yuklangan media fayllar butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteMockItem(null)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow disabled:opacity-60"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>O'chirish</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
