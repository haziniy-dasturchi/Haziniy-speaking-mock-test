"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Play,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Volume2,
  Image as ImageIcon,
  HelpCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  FileCheck,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { MediaUploader } from "@/components/MediaUploader";
import { ImageGalleryEditor, MAX_QUESTION_IMAGES } from "@/components/ImageGalleryEditor";
import { QuestionImageItem } from "@/lib/db/schema";

const BULLET = String.fromCharCode(10) + String.fromCharCode(8226) + " ";

interface QuestionData {
  id: string;
  partId: string;
  order: number;
  text: string;
  audioUrl: string | null;
  audioPublicId: string | null;
  imageUrls: QuestionImageItem[];
  prepSeconds: number | null;
  answerSeconds: number | null;
  topic: string | null;
  forPoints: string[];
  againstPoints: string[];
}

interface PartData {
  id: string;
  mockId: string;
  order: number;
  type: "part1_1" | "part1_2" | "part2" | "part3";
  displayLabel: string;
  instructionText: string;
  instructionAudioUrl: string | null;
  instructionAudioPublicId: string | null;
  defaultPrepSeconds: number;
  defaultAnswerSeconds: number;
  questions: QuestionData[];
}

interface MockData {
  id: string;
  title: string;
  levelLabel: string;
  status: "draft" | "ready";
  parts: PartData[];
}

export function MockBuilder({ initialMock }: { initialMock: MockData }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [mock, setMock] = useState<MockData>(initialMock);
  const [activeTab, setActiveTab] = useState<string>(
    initialMock.parts[0]?.id || "part1_1"
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidatingReady, setIsValidatingReady] = useState(false);

  // Warn before leaving if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const currentPart = mock.parts.find((p) => p.id === activeTab) || mock.parts[0];

  // Update part settings
  const updateCurrentPart = (updates: Partial<PartData>) => {
    setMock((prev) => ({
      ...prev,
      parts: prev.parts.map((p) =>
        p.id === currentPart.id ? { ...p, ...updates } : p
      ),
    }));
    setHasUnsavedChanges(true);
  };

  // Update question within current part
  const updateQuestion = (qId: string, updates: Partial<QuestionData>) => {
    setMock((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => {
        if (p.id !== currentPart.id) return p;
        return {
          ...p,
          questions: p.questions.map((q) =>
            q.id === qId ? { ...q, ...updates } : q
          ),
        };
      }),
    }));
    setHasUnsavedChanges(true);
  };

  // Add question to current part
  const handleAddQuestion = async () => {
    try {
      const isPart3 = currentPart.type === "part3";
      const initialForPoints = isPart3 ? ["", "", ""] : [];
      const initialAgainstPoints = isPart3 ? ["", "", ""] : [];

      const res = await fetch(`/api/parts/${currentPart.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "",
          forPoints: initialForPoints,
          againstPoints: initialAgainstPoints,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMock((prev) => ({
        ...prev,
        parts: prev.parts.map((p) =>
          p.id === currentPart.id
            ? { ...p, questions: [...p.questions, data.question] }
            : p
        ),
      }));

      showToast("Yangi savol qo'shildi", "success");
    } catch (err: any) {
      showToast(err.message || "Savol qo'shishda xatolik", "error");
    }
  };

  // Delete question
  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm("Savolni o'chirishni tasdiqlaysizmi?")) return;

    try {
      const res = await fetch(`/api/questions/${qId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setMock((prev) => ({
        ...prev,
        parts: prev.parts.map((p) =>
          p.id === currentPart.id
            ? { ...p, questions: p.questions.filter((q) => q.id !== qId) }
            : p
        ),
      }));

      showToast("Savol o'chirildi", "info");
    } catch (err: any) {
      showToast(err.message || "Savolni o'chirishda xatolik", "error");
    }
  };

  // Move question up or down
  const moveQuestion = async (index: number, direction: "up" | "down") => {
    const questions = [...currentPart.questions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const temp = questions[index];
    questions[index] = questions[targetIndex];
    questions[targetIndex] = temp;

    // Update locally
    setMock((prev) => ({
      ...prev,
      parts: prev.parts.map((p) =>
        p.id === currentPart.id ? { ...p, questions } : p
      ),
    }));

    // Save order to API
    try {
      await fetch(`/api/parts/${currentPart.id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: questions.map((q) => q.id) }),
      });
    } catch (err) {
      console.error("Reorder error:", err);
    }
  };

  // Save every part and question of the mock to the backend
  const handleSave = async (): Promise<boolean> => {
    try {
      setIsSaving(true);

      const failures: string[] = [];

      const check = async (res: Response, what: string) => {
        if (res.ok) return;
        let message = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          /* response had no JSON body */
        }
        failures.push(`${what}: ${message}`);
      };

      // 1. Mock details
      await check(
        await fetch(`/api/mocks/${mock.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: mock.title,
            levelLabel: mock.levelLabel,
          }),
        }),
        "Mock sarlavhasi"
      );

      // 2. Every part with all of its questions (not just the open tab)
      for (const part of mock.parts) {
        await check(
          await fetch(`/api/parts/${part.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instructionText: part.instructionText,
              instructionAudioUrl: part.instructionAudioUrl,
              instructionAudioPublicId: part.instructionAudioPublicId,
              defaultPrepSeconds: part.defaultPrepSeconds,
              defaultAnswerSeconds: part.defaultAnswerSeconds,
            }),
          }),
          part.displayLabel
        );

        for (const [index, q] of part.questions.entries()) {
          await check(
            await fetch(`/api/questions/${q.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: q.text,
                audioUrl: q.audioUrl,
                audioPublicId: q.audioPublicId,
                imageUrls: q.imageUrls,
                prepSeconds: q.prepSeconds,
                answerSeconds: q.answerSeconds,
                topic: q.topic,
                forPoints: q.forPoints,
                againstPoints: q.againstPoints,
              }),
            }),
            `${part.displayLabel} — ${index + 1}-topshiriq`
          );
        }
      }

      if (failures.length > 0) {
        showToast(
          "Ba'zi ma'lumotlar saqlanmadi:" + BULLET + failures.join(BULLET),
          "error"
        );
        return false;
      }

      setHasUnsavedChanges(false);
      showToast("Barcha o'zgarishlar muvaffaqiyatli saqlandi!", "success");
      return true;
    } catch (err: any) {
      showToast(err?.message || "Saqlashda xatolik yuz berdi", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle or validate Ready status
  const handleToggleReady = async () => {
    const nextStatus = mock.status === "ready" ? "draft" : "ready";

    try {
      setIsValidatingReady(true);
      // Auto-save first; a failed save must not be reported as "ready"
      const saved = await handleSave();
      if (!saved) return;

      const res = await fetch(`/api/mocks/${mock.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.validationErrors && Array.isArray(data.validationErrors)) {
          showToast(
            `Mock testni tayyor deb belgilash uchun kamchiliklarni to'g'rilang:\n• ${data.validationErrors.join("\n• ")}`,
            "error"
          );
        } else {
          showToast(data.error || "Holatni yangilashda xatolik", "error");
        }
        return;
      }

      setMock((prev) => ({ ...prev, status: nextStatus }));
      showToast(
        nextStatus === "ready"
          ? "Mock test muvaffaqiyatli 'Tayyor' holatiga o'tkazildi!"
          : "Mock test 'Qoralama' holatiga o'tkazildi",
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Holatni o'zgartirishda xatolik", "error");
    } finally {
      setIsValidatingReady(false);
    }
  };

  return (
    <div className="pb-24">
      {/* Top Sticky Header */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 py-3.5 px-4 sm:px-6 lg:px-8 mb-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/mocks"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              title="Orqaga qaytish"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="flex flex-col">
              <input
                type="text"
                value={mock.title}
                onChange={(e) => {
                  setMock((prev) => ({ ...prev, title: e.target.value }));
                  setHasUnsavedChanges(true);
                }}
                className="text-lg font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-[#0B4F37] focus:outline-none transition py-0.5 bg-transparent"
                placeholder="Mock test sarlavhasi"
              />
              <div className="flex items-center gap-2 mt-0.5">
                <input
                  type="text"
                  value={mock.levelLabel}
                  onChange={(e) => {
                    setMock((prev) => ({ ...prev, levelLabel: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-[#0B4F37] border border-emerald-200 focus:outline-none w-20"
                  placeholder="B1–C1"
                />
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    mock.status === "ready"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {mock.status === "ready" ? "Tayyor" : "Qoralama"}
                </span>
                {hasUnsavedChanges && (
                  <span className="text-[11px] text-amber-600 font-medium">
                    (Saqlanmagan o'zgarishlar)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleToggleReady}
              disabled={isValidatingReady}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                mock.status === "ready"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  : "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
              }`}
            >
              {isValidatingReady ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCheck className="w-3.5 h-3.5" />
              )}
              <span>
                {mock.status === "ready"
                  ? "Qoralamaga qaytarish"
                  : "Tayyor deb belgilash"}
              </span>
            </button>

            <Link
              href={`/mocks/${mock.id}/present`}
              target="_blank"
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-[#0B4F37] px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 transition"
              title="Katta ekranda sinab ko'rish"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Ko'rish (Preview)</span>
            </Link>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-[#0B4F37] hover:bg-[#083B29] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Saqlash</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Parts Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-slate-200">
          {mock.parts.map((p) => {
            const isActive = p.id === activeTab;
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (hasUnsavedChanges) {
                    handleSave();
                  }
                  setActiveTab(p.id);
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition whitespace-nowrap ${
                  isActive
                    ? "bg-[#0B4F37] text-white shadow-sm"
                    : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>{p.displayLabel}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {p.questions.length} savol
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Part Configuration Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#FEF08A] text-[#854D0E] font-extrabold text-xs">
                  {currentPart.displayLabel}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Bo'lim sozlamalari va yo'riqnomasi
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Ushbu bo'lim boshlanishida ekranda ko'rsatiladigan va o'qib eshittiriladigan ko'rsatma
              </p>
            </div>

            {/* Default Timers */}
            <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-slate-600 font-medium">Tayyorgarlik:</span>
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={currentPart.defaultPrepSeconds}
                  onChange={(e) =>
                    updateCurrentPart({
                      defaultPrepSeconds: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-14 px-1.5 py-0.5 text-center font-bold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0B4F37]"
                />
                <span className="text-slate-400">sek.</span>
              </div>

              <div className="w-px h-4 bg-slate-200" />

              <div className="flex items-center gap-1.5 text-xs">
                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-600 font-medium">Javob berish:</span>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={currentPart.defaultAnswerSeconds}
                  onChange={(e) =>
                    updateCurrentPart({
                      defaultAnswerSeconds: parseInt(e.target.value, 10) || 30,
                    })
                  }
                  className="w-14 px-1.5 py-0.5 text-center font-bold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0B4F37]"
                />
                <span className="text-slate-400">sek.</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
            {/* Instruction Text */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Yo'riqnoma matni (Instruction Text)
              </label>
              <textarea
                rows={4}
                value={currentPart.instructionText}
                onChange={(e) =>
                  updateCurrentPart({ instructionText: e.target.value })
                }
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37]"
                placeholder="Bo'lim ko'rsatmasi..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Agar audio fayl yuklanmasa, ushbu matnni AI ovoz (TTS) avtomatik o'qib beradi.
              </p>
            </div>

            {/* Instruction Audio */}
            <div>
              <MediaUploader
                resourceType="video"
                label="Yo'riqnoma audiosi (Audio File)"
                sublabel="Ixtiyoriy (yuklanmasa AI ovoz o'qiydi)"
                valueUrl={currentPart.instructionAudioUrl}
                valuePublicId={currentPart.instructionAudioPublicId}
                onUploadComplete={(res) =>
                  updateCurrentPart({
                    instructionAudioUrl: res.url,
                    instructionAudioPublicId: res.public_id,
                  })
                }
                onRemove={() =>
                  updateCurrentPart({
                    instructionAudioUrl: null,
                    instructionAudioPublicId: null,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Questions Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {currentPart.displayLabel} savollari
            </h3>
            <p className="text-xs text-slate-500">
              {currentPart.type === "part1_1" &&
                "Part 1.1 da odatda 3 ta qisqa matnli savol bo'ladi (tayyorgarlik 5s, javob 30s)."}
              {currentPart.type === "part1_2" &&
                "Part 1.2 da rasm(lar) va ular asosidagi savollar beriladi. Har bir topshiriqqa 1 tadan 4 tagacha rasm qo'shish mumkin."}
              {currentPart.type === "part2" &&
                "Part 2 da rasm va 3 ta savol birdaniga ko'rsatiladi (tayyorgarlik 60s, javob 120s umumiy to'plamga)."}
              {currentPart.type === "part3" &&
                "Part 3 da muhokama mavzusi hamda 'FOR' va 'AGAINST' dalillari beriladi (tayyorgarlik 60s, javob 120s)."}
            </p>
          </div>

          <button
            onClick={handleAddQuestion}
            className="flex items-center gap-1.5 bg-[#0B4F37] hover:bg-[#083B29] text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Savol qo'shish</span>
          </button>
        </div>

        {/* Questions List */}
        {currentPart.questions.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-400 text-xs">
            Ushbu bo'limda hali savollar yo'q. "Savol qo'shish" tugmasini bosing.
          </div>
        ) : (
          <div className="space-y-6">
            {currentPart.questions.map((question, qIndex) => {
              // Tasks are numbered continuously across the exam (Topshiriq #1 ... #N)
              const taskNumber =
                mock.parts
                  .filter((p) => p.order < currentPart.order)
                  .reduce((total, p) => total + p.questions.length, 0) +
                qIndex +
                1;
              const isPart1_2 = currentPart.type === "part1_2";
              const isPart2 = currentPart.type === "part2";
              const isPart3 = currentPart.type === "part3";

              return (
                <div
                  key={question.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs relative"
                >
                  {/* Question top row: order & actions */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-100 text-[#0B4F37] font-bold text-xs flex items-center justify-center">
                        {taskNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {isPart3 ? `Topshiriq #${taskNumber} — Mavzu` : `Topshiriq #${taskNumber}`}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({currentPart.displayLabel} ichida {qIndex + 1}-o'rin)
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveQuestion(qIndex, "up")}
                        disabled={qIndex === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                        title="Yuqoriga"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveQuestion(qIndex, "down")}
                        disabled={qIndex === currentPart.questions.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                        title="Pastga"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-1" />
                      <button
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question fields */}
                  {isPart3 ? (
                    /* PART 3: TOPIC STATEMENT + 3 FOR + 3 AGAINST */
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Mavzu (Topic Statement)
                        </label>
                        <textarea
                          rows={2}
                          value={question.topic || question.text || ""}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              topic: e.target.value,
                              text: e.target.value,
                            })
                          }
                          placeholder="masalan: Some people think that distance learning is more effective than traditional learning..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37]"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(
                          [
                            {
                              key: "forPoints" as const,
                              title: "Points FOR (Rozi fikrlar)",
                              accent: "emerald",
                            },
                            {
                              key: "againstPoints" as const,
                              title: "Points AGAINST (Qarshi fikrlar)",
                              accent: "rose",
                            },
                          ]
                        ).map(({ key, title, accent }) => {
                          const points =
                            (question[key] || []).length > 0
                              ? question[key]
                              : ["", "", ""];

                          const setPoints = (next: string[]) =>
                            updateQuestion(question.id, { [key]: next } as Partial<QuestionData>);

                          return (
                            <div
                              key={key}
                              className={`p-4 rounded-xl border ${
                                accent === "emerald"
                                  ? "bg-emerald-50/50 border-emerald-100"
                                  : "bg-rose-50/50 border-rose-100"
                              }`}
                            >
                              <h4
                                className={`text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                                  accent === "emerald" ? "text-emerald-900" : "text-rose-900"
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    accent === "emerald" ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                />
                                {title}
                              </h4>

                              {points.map((point, idx) => (
                                <div key={idx} className="mb-2 flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={point}
                                    onChange={(e) => {
                                      const next = [...points];
                                      next[idx] = e.target.value;
                                      setPoints(next);
                                    }}
                                    placeholder={`${
                                      accent === "emerald" ? "FOR" : "AGAINST"
                                    } argument #${idx + 1}`}
                                    className={`w-full p-2 bg-white border rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 ${
                                      accent === "emerald"
                                        ? "border-emerald-200 focus:ring-emerald-600"
                                        : "border-rose-200 focus:ring-rose-600"
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setPoints(points.filter((_, i) => i !== idx))}
                                    disabled={points.length <= 1}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg hover:bg-white"
                                    title="Bandni o'chirish"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}

                              {points.length < 6 && (
                                <button
                                  type="button"
                                  onClick={() => setPoints([...points, ""])}
                                  className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#0B4F37] transition"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Band qo'shish</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <ImageGalleryEditor
                        images={question.imageUrls || []}
                        onChange={(images) =>
                          updateQuestion(question.id, { imageUrls: images })
                        }
                        title="Mavzu rasmlari"
                        hint="Ixtiyoriy — Part 3 uchun odatda rasm kerak emas"
                      />

                      <MediaUploader
                        resourceType="video"
                        label="Mavzu audiosi"
                        sublabel="Ixtiyoriy (bo'sh bo'lsa matnni AI ovoz o'qiydi)"
                        valueUrl={question.audioUrl}
                        valuePublicId={question.audioPublicId}
                        onUploadComplete={(res) =>
                          updateQuestion(question.id, {
                            audioUrl: res.url,
                            audioPublicId: res.public_id,
                          })
                        }
                        onRemove={() =>
                          updateQuestion(question.id, {
                            audioUrl: null,
                            audioPublicId: null,
                          })
                        }
                      />
                    </div>
                  ) : (
                    /* PART 1.1, PART 1.2, PART 2 */
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            {isPart2 ? "Savollar matni (1, 2, 3 raqamlar bilan)" : "Savol matni"}
                          </label>
                          <span className="text-[11px] text-slate-400">
                            Ixtiyoriy - savol rasm ichida bo'lsa bo'sh qoldiring
                          </span>
                        </div>
                        <textarea
                          rows={isPart2 ? 4 : 2}
                          value={question.text}
                          onChange={(e) =>
                            updateQuestion(question.id, { text: e.target.value })
                          }
                          placeholder={
                            isPart2
                              ? "1. Describe the picture.\n2. Why do you think...\n3. Have you ever..."
                              : "Savol matnini kiriting (ixtiyoriy)..."
                          }
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4F37]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Matn yozilsa va audio yuklanmasa, uni imtihon vaqtida AI ovoz (TTS) o'qib beradi.
                        </p>
                      </div>

                      {/* Universal picture gallery: 0 - 4 pictures for any part */}
                      <ImageGalleryEditor
                        images={question.imageUrls || []}
                        onChange={(images) =>
                          updateQuestion(question.id, { imageUrls: images })
                        }
                        max={MAX_QUESTION_IMAGES}
                        title="Topshiriq rasmlari"
                        hint={
                          isPart1_2
                            ? "Taqqoslash uchun odatda 2 ta rasm, lekin 1 tadan 4 tagacha mumkin"
                            : isPart2
                            ? "Odatda 1 ta asosiy rasm, lekin 4 tagacha qo'shsa bo'ladi"
                            : "Ixtiyoriy - kerak bo'lsa 4 tagacha rasm qo'shing"
                        }
                      />

                      {/* Question Audio & Timer Overrides */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div>
                          <MediaUploader
                            resourceType="video"
                            label="Savol audiosi"
                            sublabel="Ixtiyoriy (bo'sh bo'lsa AI ovoz o'qiydi)"
                            valueUrl={question.audioUrl}
                            valuePublicId={question.audioPublicId}
                            onUploadComplete={(res) =>
                              updateQuestion(question.id, {
                                audioUrl: res.url,
                                audioPublicId: res.public_id,
                              })
                            }
                            onRemove={() =>
                              updateQuestion(question.id, {
                                audioUrl: null,
                                audioPublicId: null,
                              })
                            }
                          />
                        </div>

                        {/* Timer Overrides */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center">
                          <span className="text-xs font-semibold text-slate-700 mb-2">
                            Savol uchun shaxsiy taymerlar (Ixtiyoriy)
                          </span>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500 block text-[11px] mb-1">
                                Tayyorgarlik (sek):
                              </span>
                              <input
                                type="number"
                                placeholder={`Standart: ${currentPart.defaultPrepSeconds}`}
                                value={question.prepSeconds ?? ""}
                                onChange={(e) =>
                                  updateQuestion(question.id, {
                                    prepSeconds: e.target.value ? parseInt(e.target.value, 10) : null,
                                  })
                                }
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px] mb-1">
                                Javob (sek):
                              </span>
                              <input
                                type="number"
                                placeholder={`Standart: ${currentPart.defaultAnswerSeconds}`}
                                value={question.answerSeconds ?? ""}
                                onChange={(e) =>
                                  updateQuestion(question.id, {
                                    answerSeconds: e.target.value ? parseInt(e.target.value, 10) : null,
                                  })
                                }
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
