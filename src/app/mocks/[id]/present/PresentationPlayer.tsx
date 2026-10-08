"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Maximize2,
  Minimize2,
  X,
  Check,
  CheckCircle2,
  Volume2,
  Mic,
  Clock,
  Sparkles,
} from "lucide-react";
import { playExamBeep, playEndTone, speakText, stopSpeaking, preloadAudio, preloadImage } from "@/lib/audio-player";
import { QuestionImageItem } from "@/lib/db/schema";

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

type ExamPhase =
  | "LOADING"
  | "START"
  | "PART_INTRO"
  | "QUESTION_AUDIO"
  | "PREPARATION"
  | "ANSWER"
  | "FINISHED";

export function PresentationPlayer({ mock }: { mock: MockData }) {
  const router = useRouter();

  // Navigation index: currentPartIndex & currentQuestionIndex
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Exam phase
  const [phase, setPhase] = useState<ExamPhase>("LOADING");
  const [preloadProgress, setPreloadProgress] = useState(0);

  // Timer states
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Controls visibility
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio elements ref for playing real audio
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Current active part & question
  const currentPart = mock.parts[currentPartIndex];
  const currentQuestion = currentPart?.questions[currentQuestionIndex];

  // Completed parts tracking: Part 1 (parts 0 and 1), Part 2 (part 2), Part 3 (part 3)
  const isPart1Completed =
    currentPartIndex > 1 || (currentPartIndex === 1 && phase === "FINISHED");
  const isPart2Completed =
    currentPartIndex > 2 || (currentPartIndex === 2 && phase === "FINISHED");
  const isPart3Completed = phase === "FINISHED";

  // Preloading media on mount
  useEffect(() => {
    let isCancelled = false;

    async function preloadAllMedia() {
      const mediaList: { type: "image" | "audio"; url: string }[] = [];

      for (const p of mock.parts) {
        if (p.instructionAudioUrl) {
          mediaList.push({ type: "audio", url: p.instructionAudioUrl });
        }
        for (const q of p.questions) {
          if (q.audioUrl) {
            mediaList.push({ type: "audio", url: q.audioUrl });
          }
          if (q.imageUrls && Array.isArray(q.imageUrls)) {
            for (const img of q.imageUrls) {
              if (img.url) {
                mediaList.push({ type: "image", url: img.url });
              }
            }
          }
        }
      }

      if (mediaList.length === 0) {
        setPreloadProgress(100);
        setPhase("START");
        return;
      }

      let loadedCount = 0;
      for (const item of mediaList) {
        if (isCancelled) return;
        try {
          if (item.type === "image") {
            await preloadImage(item.url);
          } else {
            await preloadAudio(item.url);
          }
        } catch {
          // Continue if any individual asset fails
        }
        loadedCount++;
        setPreloadProgress(Math.round((loadedCount / mediaList.length) * 100));
      }

      if (!isCancelled) {
        setPhase("START");
      }
    }

    preloadAllMedia();

    return () => {
      isCancelled = true;
      stopSpeaking();
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
    };
  }, [mock]);

  // Handle auto-hiding teacher controls
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3500);
  }, []);

  useEffect(() => {
    const handleMouseMove = () => resetControlsTimeout();
    window.addEventListener("mousemove", handleMouseMove);
    resetControlsTimeout();
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Main step advancing logic
  const advanceToNext = useCallback(async () => {
    stopSpeaking();
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }

    // If on Part Intro, move to question audio / prep
    if (phase === "PART_INTRO") {
      setPhase("QUESTION_AUDIO");
      return;
    }

    // For Part 2 or Part 3, questions are answered as a single set
    const isWholeSetPart =
      currentPart.type === "part2" || currentPart.type === "part3";

    if (isWholeSetPart || currentQuestionIndex >= currentPart.questions.length - 1) {
      // Part is finished; move to next part or FINISHED
      if (currentPartIndex < mock.parts.length - 1) {
        setCurrentPartIndex((prev) => prev + 1);
        setCurrentQuestionIndex(0);
        setPhase("PART_INTRO");
      } else {
        setPhase("FINISHED");
      }
    } else {
      // Move to next question in same part
      setCurrentQuestionIndex((prev) => prev + 1);
      setPhase("QUESTION_AUDIO");
    }
  }, [phase, currentPart, currentPartIndex, currentQuestionIndex, mock.parts.length]);

  // Previous step logic
  const goToPrevious = useCallback(() => {
    stopSpeaking();
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }

    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setPhase("QUESTION_AUDIO");
    } else if (currentPartIndex > 0) {
      setCurrentPartIndex((prev) => prev - 1);
      setCurrentQuestionIndex(0);
      setPhase("PART_INTRO");
    } else {
      setPhase("START");
    }
  }, [currentQuestionIndex, currentPartIndex]);

  // Restart current question
  const restartQuestion = useCallback(() => {
    stopSpeaking();
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setPhase("QUESTION_AUDIO");
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        advanceToNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape") {
        // Esc handles exit fullscreen naturally, or exit to dashboard
        if (!document.fullscreenElement) {
          router.push("/mocks");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceToNext, goToPrevious, router]);

  // Phase transition handlers
  useEffect(() => {
    if (isPaused) return;

    // 1. PART INTRO: Play audio or TTS, then auto-advance
    if (phase === "PART_INTRO" && currentPart) {
      let isCancelled = false;

      const playIntro = async () => {
        if (currentPart.instructionAudioUrl) {
          const audio = new Audio(currentPart.instructionAudioUrl);
          activeAudioRef.current = audio;
          audio.onended = () => {
            if (!isCancelled) advanceToNext();
          };
          audio.onerror = () => {
            if (!isCancelled) advanceToNext();
          };
          audio.play().catch(() => {
            if (!isCancelled) advanceToNext();
          });
        } else if (currentPart.instructionText) {
          await speakText(currentPart.instructionText);
          if (!isCancelled) advanceToNext();
        } else {
          // Small pause then advance
          setTimeout(() => {
            if (!isCancelled) advanceToNext();
          }, 3000);
        }
      };

      playIntro();

      return () => {
        isCancelled = true;
        stopSpeaking();
        if (activeAudioRef.current) activeAudioRef.current.pause();
      };
    }

    // 2. QUESTION AUDIO: Play question audio or TTS fallback
    if (phase === "QUESTION_AUDIO" && currentQuestion) {
      let isCancelled = false;

      const playQuestionAudio = async () => {
        if (currentQuestion.audioUrl) {
          const audio = new Audio(currentQuestion.audioUrl);
          activeAudioRef.current = audio;
          audio.onended = () => {
            if (!isCancelled) startPrepPhase();
          };
          audio.onerror = () => {
            if (!isCancelled) startPrepPhase();
          };
          audio.play().catch(() => {
            if (!isCancelled) startPrepPhase();
          });
        } else if (currentQuestion.text && currentPart.type !== "part2" && currentPart.type !== "part3") {
          // For Part 1.1 / 1.2 read question aloud
          await speakText(currentQuestion.text);
          if (!isCancelled) startPrepPhase();
        } else {
          // If no audio or Part 2/3, begin preparation countdown directly
          startPrepPhase();
        }
      };

      const startPrepPhase = () => {
        const prepSecs =
          currentQuestion.prepSeconds !== null && currentQuestion.prepSeconds !== undefined
            ? currentQuestion.prepSeconds
            : currentPart.defaultPrepSeconds;

        if (prepSecs <= 0) {
          startAnswerPhase();
        } else {
          setTotalSeconds(prepSecs);
          setRemainingSeconds(prepSecs);
          setPhase("PREPARATION");
        }
      };

      playQuestionAudio();

      return () => {
        isCancelled = true;
        stopSpeaking();
        if (activeAudioRef.current) activeAudioRef.current.pause();
      };
    }

    // 3. PREPARATION TIMER COUNTDOWN
    if (phase === "PREPARATION") {
      if (remainingSeconds <= 0) {
        startAnswerPhase();
        return;
      }

      const timer = setInterval(() => {
        setRemainingSeconds((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(timer);
    }

    // 4. ANSWER TIMER COUNTDOWN
    if (phase === "ANSWER") {
      if (remainingSeconds <= 0) {
        handleAnswerTimeUp();
        return;
      }

      const timer = setInterval(() => {
        setRemainingSeconds((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [phase, isPaused, remainingSeconds, currentPart, currentQuestion, advanceToNext]);

  const startAnswerPhase = async () => {
    // Play exam beep tone (~0.4s 1000Hz)
    await playExamBeep();

    const ansSecs =
      currentQuestion?.answerSeconds !== null && currentQuestion?.answerSeconds !== undefined
        ? currentQuestion.answerSeconds
        : currentPart?.defaultAnswerSeconds || 30;

    setTotalSeconds(ansSecs);
    setRemainingSeconds(ansSecs);
    setPhase("ANSWER");
  };

  const handleAnswerTimeUp = async () => {
    // Play exam end tone
    await playEndTone();
    // Auto-advance
    advanceToNext();
  };

  // Timer circle calculation
  const circleRadius = 110;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset =
    totalSeconds > 0
      ? circumference - (remainingSeconds / totalSeconds) * circumference
      : 0;

  // Render Part number label
  const getPartBadgeNumber = () => {
    if (!currentPart) return "Part 1";
    if (currentPart.type === "part1_1" || currentPart.type === "part1_2") {
      return "Part 1";
    }
    if (currentPart.type === "part2") return "Part 2";
    return "Part 3";
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#FAFAFA] text-slate-900 select-none overflow-hidden flex flex-col font-sans">
      {/* Top Header: Progress Pill & Brand Logo */}
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-slate-200/60 bg-white/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-700 tracking-wide uppercase">
            {mock.levelLabel} CEFR Speaking Mock
          </span>
        </div>

        {/* Top Center Progress Pill ("1.  2.  3.") */}
        <div className="flex items-center gap-3 bg-[#0B4F37] text-white px-6 py-2 rounded-full shadow-md">
          {/* Part 1 */}
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <span>1.</span>
            {isPart1Completed && (
              <span className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center animate-in zoom-in">
                <Check className="w-3 h-3 text-white stroke-[3]" />
              </span>
            )}
          </div>

          <span className="text-emerald-400 font-extralight text-sm">•</span>

          {/* Part 2 */}
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <span>2.</span>
            {isPart2Completed && (
              <span className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center animate-in zoom-in">
                <Check className="w-3 h-3 text-white stroke-[3]" />
              </span>
            )}
          </div>

          <span className="text-emerald-400 font-extralight text-sm">•</span>

          {/* Part 3 */}
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <span>3.</span>
            {isPart3Completed && (
              <span className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center animate-in zoom-in">
                <Check className="w-3 h-3 text-white stroke-[3]" />
              </span>
            )}
          </div>
        </div>

        {/* Top Right: Haziniy Mark Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/brand/logo-mark.png"
            alt="Haziniy Learning Center"
            className="h-10 w-10 object-contain drop-shadow-sm"
          />
        </div>
      </header>

      {/* Main 16:9 Exam Screen Area */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto p-6 md:p-12 flex items-center justify-center relative">
        {/* 1. LOADING SCREEN */}
        {phase === "LOADING" && (
          <div className="text-center max-w-md w-full">
            <img
              src="/brand/logo-full.png"
              alt="Haziniy"
              className="h-16 mx-auto mb-6 object-contain"
            />
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Imtihon materiallari yuklanmoqda...
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Silliq va to'xtovsiz imtihon uchun barcha audio va rasmlar oldindan xotiraga yuklanmoqda.
            </p>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-[#0B4F37] transition-all duration-300"
                style={{ width: `${preloadProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-slate-600">
              {preloadProgress}%
            </span>
          </div>
        )}

        {/* 2. START SCREEN */}
        {phase === "START" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xl p-10 md:p-14 text-center max-w-2xl w-full">
            <img
              src="/brand/logo-full.png"
              alt="Haziniy Learning Center"
              className="h-20 mx-auto mb-8 object-contain"
            />
            <div className="inline-block px-3.5 py-1 rounded-full bg-emerald-50 text-[#0B4F37] font-bold text-xs uppercase tracking-widest border border-emerald-200 mb-4">
              {mock.levelLabel} Multilevel Speaking Mock
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              {mock.title}
            </h1>
            <p className="text-slate-500 text-sm md:text-base leading-relaxed mb-8 max-w-lg mx-auto">
              Real CEFR kompyuter-asosidagi imtihon standarti bo'yicha loyihalashtirilgan.
              Imtihonni proyektor yoki katta ekranda to'liq ekran (Fullscreen) rejimida o'tkazish tavsiya etiladi.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => {
                  toggleFullscreen();
                  setPhase("PART_INTRO");
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#0B4F37] hover:bg-[#083B29] text-white px-8 py-4 rounded-2xl font-bold text-base shadow-lg hover:shadow-xl transition cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Imtihonni boshlash (Fullscreen)</span>
              </button>

              <button
                onClick={() => setPhase("PART_INTRO")}
                className="w-full sm:w-auto text-slate-600 hover:text-slate-900 px-6 py-4 rounded-2xl font-semibold text-sm transition"
              >
                Oddiy oynada boshlash
              </button>
            </div>
          </div>
        )}

        {/* 3. PART INTRO SCREEN */}
        {phase === "PART_INTRO" && currentPart && (
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xl p-10 md:p-16 text-center max-w-3xl w-full animate-in fade-in zoom-in-95">
            {/* Big Yellow Part Badge */}
            <div className="inline-flex items-center justify-center px-8 py-3 rounded-2xl bg-[#EAB308] text-slate-900 font-black text-2xl md:text-3xl tracking-tight shadow-md mb-8">
              {getPartBadgeNumber()}
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-8 mb-8 text-left">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                <Volume2 className="w-4 h-4 text-emerald-600" />
                <span>Instructions</span>
              </div>
              <p className="text-xl md:text-2xl font-medium text-slate-800 leading-relaxed">
                {currentPart.instructionText}
              </p>
            </div>

            <button
              onClick={advanceToNext}
              className="inline-flex items-center gap-2 bg-[#0B4F37] hover:bg-[#083B29] text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-md transition"
            >
              <span>Davom etish</span>
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4. QUESTION SCREEN (AUDIO / PREP / ANSWER) */}
        {(phase === "QUESTION_AUDIO" ||
          phase === "PREPARATION" ||
          phase === "ANSWER") &&
          currentPart &&
          currentQuestion && (
            <div className="w-full h-full flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12">
              {/* LEFT: QUESTION CONTENT AREA */}
              <div className="flex-1 w-full flex flex-col justify-center">
                {/* PART 1.1: TEXT ONLY (Question text >= 40px) */}
                {currentPart.type === "part1_1" && (
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-8 md:p-12 shadow-md">
                    <span className="text-xs font-bold tracking-widest uppercase text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200 mb-4 inline-block">
                      Question {currentQuestionIndex + 1} of {currentPart.questions.length}
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-[42px] font-bold text-slate-900 leading-tight">
                      {currentQuestion.text}
                    </h2>
                  </div>
                )}

                {/* PART 1.2: 2 IMAGES SIDE BY SIDE + QUESTION */}
                {currentPart.type === "part1_2" && (
                  <div className="flex flex-col gap-6 w-full">
                    {/* Images side-by-side */}
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                      {currentQuestion.imageUrls?.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-4/3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-md"
                        >
                          <img
                            src={img.url}
                            alt={`Image ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Question text */}
                    {currentQuestion.text && (
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                          {currentQuestion.text}
                        </h2>
                      </div>
                    )}
                  </div>
                )}

                {/* PART 2: 1 IMAGE + 3 QUESTIONS SHOWN TOGETHER */}
                {currentPart.type === "part2" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-center">
                    {/* Image */}
                    {currentQuestion.imageUrls?.[0]?.url && (
                      <div className="relative aspect-4/3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-md">
                        <img
                          src={currentQuestion.imageUrls[0].url}
                          alt="Part 2 visual"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Numbered Questions card */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md mb-4 inline-block">
                        Answer all questions:
                      </span>
                      <div className="space-y-4">
                        {currentQuestion.text.split("\n").map((line, idx) => {
                          if (!line.trim()) return null;
                          return (
                            <p
                              key={idx}
                              className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900 leading-snug"
                            >
                              {line}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* PART 3: TOPIC STATEMENT + FOR TABLE + AGAINST TABLE */}
                {currentPart.type === "part3" && (
                  <div className="flex flex-col gap-6 w-full">
                    {/* Topic card */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0B4F37] mb-2 block">
                        Topic Statement:
                      </span>
                      <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">
                        {currentQuestion.topic || currentQuestion.text}
                      </h2>
                    </div>

                    {/* FOR & AGAINST Tables */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* FOR TABLE */}
                      <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-6 shadow-xs">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-emerald-200">
                          <span className="w-3 h-3 rounded-full bg-emerald-600" />
                          <h3 className="text-base font-extrabold uppercase tracking-wider text-emerald-900">
                            FOR
                          </h3>
                        </div>
                        <ul className="space-y-3">
                          {currentQuestion.forPoints?.map((pt, idx) => {
                            if (!pt.trim()) return null;
                            return (
                              <li
                                key={idx}
                                className="flex items-start gap-2.5 text-base md:text-lg font-semibold text-slate-800 leading-relaxed"
                              >
                                <span className="text-emerald-700 font-bold">•</span>
                                <span>{pt}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {/* AGAINST TABLE */}
                      <div className="bg-rose-50/70 border-2 border-rose-300 rounded-2xl p-6 shadow-xs">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-rose-200">
                          <span className="w-3 h-3 rounded-full bg-rose-600" />
                          <h3 className="text-base font-extrabold uppercase tracking-wider text-rose-900">
                            AGAINST
                          </h3>
                        </div>
                        <ul className="space-y-3">
                          {currentQuestion.againstPoints?.map((pt, idx) => {
                            if (!pt.trim()) return null;
                            return (
                              <li
                                key={idx}
                                className="flex items-start gap-2.5 text-base md:text-lg font-semibold text-slate-800 leading-relaxed"
                              >
                                <span className="text-rose-700 font-bold">•</span>
                                <span>{pt}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: LARGE CIRCULAR COUNTDOWN TIMER & SOUND-WAVE */}
              <div className="w-full lg:w-80 flex flex-col items-center justify-center shrink-0">
                <div className="relative flex items-center justify-center">
                  <svg className="w-64 h-64 -rotate-90 transform">
                    {/* Background track circle */}
                    <circle
                      cx="128"
                      cy="128"
                      r={circleRadius}
                      stroke="#E2E8F0"
                      strokeWidth="14"
                      fill="transparent"
                    />
                    {/* Depleting countdown circle */}
                    <circle
                      cx="128"
                      cy="128"
                      r={circleRadius}
                      stroke={
                        phase === "ANSWER"
                          ? "#10B981" // Mint / vibrant emerald for answering
                          : "#EAB308" // Amber / yellow for preparation
                      }
                      strokeWidth="14"
                      strokeLinecap="round"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>

                  {/* Center Seconds Number & Status Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-6xl md:text-7xl font-black text-slate-900 tracking-tight font-mono">
                      {phase === "QUESTION_AUDIO" ? "—" : remainingSeconds}
                    </span>
                    <span
                      className={`text-xs md:text-sm font-extrabold uppercase tracking-widest mt-1 ${
                        phase === "ANSWER"
                          ? "text-[#10B981]"
                          : phase === "PREPARATION"
                          ? "text-amber-600"
                          : "text-slate-400"
                      }`}
                    >
                      {phase === "QUESTION_AUDIO"
                        ? "Listening..."
                        : phase === "PREPARATION"
                        ? "Preparation"
                        : "Speak now"}
                    </span>
                  </div>
                </div>

                {/* Animated Sound-wave bars (Shown ONLY during Answer phase, decorative only, NO mic access) */}
                <div className="h-12 flex items-end justify-center gap-1.5 mt-6">
                  {phase === "ANSWER" && (
                    <>
                      {[40, 75, 55, 90, 60, 100, 70, 85, 45, 95, 65, 80, 50].map(
                        (h, i) => (
                          <div
                            key={i}
                            className="w-1.5 bg-[#10B981] rounded-full animate-wave-bar"
                            style={{
                              height: `${h}%`,
                              animationDelay: `${(i * 0.08) % 1.2}s`,
                              animationDuration: `${0.8 + ((i % 5) * 0.15)}s`,
                            }}
                          />
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* 5. FINISHED SCREEN */}
        {phase === "FINISHED" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xl p-10 md:p-14 text-center max-w-xl w-full animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#0B4F37] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 stroke-[2.5]" />
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
              Test yakunlandi!
            </h1>
            <p className="text-slate-500 text-sm mb-8">
              Barcha 3 ta qism (Part 1, Part 2, Part 3) muvaffaqiyatli yakuniga yetdi.
            </p>

            <img
              src="/brand/logo-full.png"
              alt="Haziniy"
              className="h-14 mx-auto mb-8 object-contain"
            />

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setCurrentPartIndex(0);
                  setCurrentQuestionIndex(0);
                  setPhase("START");
                }}
                className="flex items-center gap-2 bg-[#0B4F37] hover:bg-[#083B29] text-white px-6 py-3 rounded-xl font-semibold text-sm transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Boshidan boshlash</span>
              </button>

              <button
                onClick={() => router.push("/mocks")}
                className="text-slate-600 hover:text-slate-900 px-5 py-3 rounded-xl font-semibold text-sm transition"
              >
                Chiqish
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Teacher Controls Bar (Semi-transparent, auto-hides) */}
      <footer
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700/50 text-xs font-semibold">
          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
            title="Pauza / Davom ettirish (Space)"
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4 fill-current text-emerald-400" />
                <span className="text-emerald-400">Davom</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                <span>Pauza</span>
              </>
            )}
          </button>

          <div className="w-px h-4 bg-slate-700" />

          {/* Previous Question / Part */}
          <button
            onClick={goToPrevious}
            className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
            title="Oldingi (←)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Restart question */}
          <button
            onClick={restartQuestion}
            className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
            title="Savolni qaytadan boshlash"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Next / Skip */}
          <button
            onClick={advanceToNext}
            className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
            title="Keyingi / O'tkazib yuborish (→)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-700" />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
            title="To'liq ekran (F)"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Exit */}
          <button
            onClick={() => router.push("/mocks")}
            className="p-1.5 rounded-full text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
            title="Chiqish (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
