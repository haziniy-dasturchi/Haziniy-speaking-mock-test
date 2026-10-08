"use client";

import React, { useState } from "react";
import {
  UserPlus,
  KeyRound,
  Edit2,
  CheckCircle,
  XCircle,
  X,
  Loader2,
  Layers,
  Calendar,
} from "lucide-react";
import { useToast } from "@/components/Toast";

interface Teacher {
  id: string;
  fullName: string;
  login: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  mockCount: number;
}

export function TeacherManager({ initialTeachers }: { initialTeachers: Teacher[] }) {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  // Form fields
  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);

  const openCreateModal = () => {
    setEditingTeacher(null);
    setFullName("");
    setLogin("");
    setPassword("");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFullName(teacher.fullName);
    setLogin(teacher.login);
    setPassword(""); // Leave blank if not changing
    setIsActive(teacher.isActive);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTeacher(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingTeacher) {
        // Update teacher
        const payload: any = {
          fullName: fullName.trim(),
          login: login.trim(),
          isActive,
        };
        if (password.trim()) {
          payload.password = password.trim();
        }

        const res = await fetch(`/api/admin/teachers/${editingTeacher.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "O'qituvchini yangilashda xatolik");
        }

        setTeachers((prev) =>
          prev.map((t) =>
            t.id === editingTeacher.id
              ? {
                  ...t,
                  fullName: data.teacher.fullName,
                  login: data.teacher.login,
                  isActive: data.teacher.isActive,
                }
              : t
          )
        );
        showToast("O'qituvchi ma'lumotlari muvaffaqiyatli saqlandi!", "success");
        closeModal();
      } else {
        // Create teacher
        const res = await fetch("/api/admin/teachers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            login: login.trim(),
            password: password.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "O'qituvchi qo'shishda xatolik");
        }

        setTeachers((prev) => [
          {
            ...data.teacher,
            mockCount: 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        showToast("Yangi o'qituvchi muvaffaqiyatli yaratildi!", "success");
        closeModal();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTeacherStatus = async (teacher: Teacher) => {
    const nextStatus = !teacher.isActive;
    try {
      const res = await fetch(`/api/admin/teachers/${teacher.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTeachers((prev) =>
        prev.map((t) => (t.id === teacher.id ? { ...t, isActive: nextStatus } : t))
      );
      showToast(
        `O'qituvchi hisobi ${nextStatus ? "faollashtirildi" : "faolsizlantirildi"}`,
        "info"
      );
    } catch (err: any) {
      showToast(err.message || "Holatni o'zgartirishda xatolik", "error");
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            O'qituvchilar ro'yxati
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Markaz o'qituvchilarini boshqarish, yangi hisob yaratish va parollarni tiklash
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#0B4F37] hover:bg-[#083B29] text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm hover:shadow transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Yangi o'qituvchi qo'shish</span>
        </button>
      </div>

      {/* Teachers Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 px-6">F.I.SH.</th>
                <th className="py-3.5 px-6">Login</th>
                <th className="py-3.5 px-6 text-center">Holat</th>
                <th className="py-3.5 px-6 text-center">Mock testlar</th>
                <th className="py-3.5 px-6">Qo'shilgan sana</th>
                <th className="py-3.5 px-6 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    O'qituvchilar hozircha mavjud emas. Yuqoridagi tugma orqali qo'shing.
                  </td>
                </tr>
              ) : (
                teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-semibold text-slate-900">
                      {teacher.fullName}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-slate-600">
                      @{teacher.login}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => toggleTeacherStatus(teacher)}
                        title={teacher.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                          teacher.isActive
                            ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                            : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
                        }`}
                      >
                        {teacher.isActive ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Faol</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Nofaol</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {teacher.mockCount || 0} ta
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(teacher.createdAt).toLocaleDateString("uz-UZ")}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(teacher)}
                          className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-[#0B4F37] bg-slate-100 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition"
                          title="Tahrirlash va parolni tiklash"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Tahrirlash</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingTeacher
                  ? "O'qituvchi ma'lumotlarini tahrirlash"
                  : "Yangi o'qituvchi hisobini yaratish"}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  F.I.SH. (To'liq ism)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="masalan: Alisher Qodirov"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tizimga kirish logini
                </label>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="masalan: a_qodirov"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37]"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {editingTeacher ? "Yangi parol (ixtiyoriy)" : "Boshlang'ich parol"}
                  </label>
                  {editingTeacher && (
                    <span className="text-[11px] text-slate-400">
                      O'zgartirmaslik uchun bo'sh qoldiring
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="kamida 6 ta belgi"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37]"
                    required={!editingTeacher}
                  />
                </div>
              </div>

              {editingTeacher && (
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0B4F37] accent-[#0B4F37] focus:ring-[#0B4F37]"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Hisob faol holatda
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-[#0B4F37] hover:bg-[#083B29] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingTeacher ? "Saqlash" : "Yaratish"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
