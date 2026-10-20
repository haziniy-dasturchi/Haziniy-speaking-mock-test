"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  ZoomIn,
} from "lucide-react";
import {
  playExamBeep,
  playEndTone,
  speakText,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  preloadAudio,
  preloadImage,
} from "@/lib/audio-player";
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

interface Step {
  kind: "intro" | "task";
  partIndex: number;
  questionIndex: number;
  taskNumber: number;
}

/** Group shown in the top progress pill: Part 1.1 and 1.2 are both "Part 1". */
function partGroup(type: PartData["type"]): 1 | 2 | 3 {
  if (type === "part2") return 2;
  if (type === "part3") return 3;
  return 1;
}

function buildTextToSpeak(part: PartData, question: QuestionData): string {
  if (part.type === "part3") {
    return (question.topic || question.text || "").trim();
  }
  return (question.text || "").trim();
}

export function PresentationPlayer({ mock }: { mock: MockData }) {
  const router = useRouter();

  /**
   * The exam is a flat list of steps: a part introduction followed by its
   * tasks. Parts without tasks are skipped automatically, so an unfinished
   * mock never leaves the projector on a blank screen.
   */
  const steps = useMemo<Step[]>(() => {
    const result: Step[] = [];
    let taskNumber = 0;

    mock.parts.forEach((part, partIndex) => {
      if (!part.questions || part.questions.length === 0) return;
      result.push({ kind: "intro", partIndex, questionIndex: -1, taskNumber: 0 });
      part.questions.forEach((_, questionIndex) => {
        taskNumber += 1;
        result.push({ kind: "task", partIndex, questionIndex, taskNumber });
      });
    });

    return result;
  }, [mock]);

  const totalTasks = useMemo(
    () => steps.filter((step) => step.kind === "task").length,
    [steps]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<ExamPhase>("LOADING");
  const [preloadProgress, setPreloadProgress] = useState(0);

  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const deadlineRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number | null>(null);

  const currentStep = steps[stepIndex];
  const currentPart = currentStep ? mock.parts[currentStep.partIndex] : undefined;
  const currentQuestion =
    currentStep && currentStep.kind === "task"
      ? currentPart?.questions[currentStep.questionIndex]
      : undefined;

  const currentGroup = currentPart ? partGroup(currentPart.type) : 1;
  const isFinished = phase === "FINISHED";
  const isGroupCompleted = (group: 1 | 2 | 3) => isFinished || currentGroup > group;

  const stopActiveSound = useCallback(() => {
    stopSpeaking();
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------- preload
  useEffect(() => {
    let isCancelled = false;

    async function preloadAllMedia() {
      const mediaList: { type: "image" | "audio"; url: string }[] = [];

      for (const part of mock.parts) {
        if (part.instructionAudioUrl) {
          mediaList.push({ type: "audio", url: part.instructionAudioUrl });
        }
        for (const question of part.questions) {
          if (question.audioUrl) {
            mediaList.push({ type: "audio", url: question.audioUrl });
          }
          for (const image of question.imageUrls || []) {
            if (image?.url) mediaList.push({ type: "image", url: image.url });
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
          const task =
            item.type === "image" ? preloadImage(item.url) : preloadAudio(item.url);
          // A broken asset must never block the start of a lesson.
          await Promise.race([
            task,
            new Promise((resolve) => setTimeout(resolve, 8000)),
          ]);
        } catch {
          /* keep going */
        }
        loadedCount += 1;
        setPreloadProgress(Math.round((loadedCount / mediaList.length) * 100));
      }

      if (!isCancelled) setPhase("START");
    }

    preloadAllMedia();

    return () => {
      isCancelled = true;
      stopSpeaking();
      if (activeAudioRef.current) activeAudioRef.current.pause();
    };
  }, [mock]);

  // ------------------------------------------------------- teacher controls
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 3500);
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

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // ------------------------------------------------------------- navigation
  const goToStep = useCallback(
    (index: number) => {
      stopActiveSound();
      deadlineRef.current = null;
      pausedRemainingRef.current = null;
      setIsPaused(false);

      if (index < 0) {
        setStepIndex(0);
        setPhase("START");
        return;
      }
      if (index >= steps.length) {
        setPhase("FINISHED");
        return;
      }

      setStepIndex(index);
      setPhase(steps[index].kind === "intro" ? "PART_INTRO" : "QUESTION_AUDIO");
    },
    [steps, stopActiveSound]
  );

  const advanceToNext = useCallback(() => {
    goToStep(stepIndex + 1);
  }, [goToStep, stepIndex]);

  const goToPrevious = useCallback(() => {
    goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  const restartStep = useCallback(() => {
    goToStep(stepIndex);
  }, [goToStep, stepIndex]);

  // ---------------------------------------------------------------- timers
  const startAnswerPhase = useCallback(async () => {
    await playExamBeep();

    const seconds =
      currentQuestion?.answerSeconds ?? currentPart?.defaultAnswerSeconds ?? 30;

    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    deadlineRef.current = Date.now() + seconds * 1000;
    pausedRemainingRef.current = null;
    setPhase("ANSWER");
  }, [currentQuestion, currentPart]);

  const startPrepPhase = useCallback(() => {
    const seconds = currentQuestion?.prepSeconds ?? currentPart?.defaultPrepSeconds ?? 5;

    if (seconds <= 0) {
      startAnswerPhase();
      return;
    }

    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    deadlineRef.current = Date.now() + seconds * 1000;
    pausedRemainingRef.current = null;
    setPhase("PREPARATION");
  }, [currentQuestion, currentPart, startAnswerPhase]);

  // Part introduction: play the audio file, otherwise read it with the AI voice
  useEffect(() => {
    if (phase !== "PART_INTRO" || !currentPart || isPaused) return;

    let isCancelled = false;

    const run = async () => {
      if (currentPart.instructionAudioUrl) {
        const audio = new Audio(currentPart.instructionAudioUrl);
        activeAudioRef.current = audio;
        audio.onended = () => !isCancelled && advanceToNext();
        audio.onerror = () => !isCancelled && advanceToNext();
        audio.play().catch(() => !isCancelled && advanceToNext());
        return;
      }

      if (currentPart.instructionText?.trim()) {
        await speakText(currentPart.instructionText);
        if (!isCancelled) advanceToNext();
        return;
      }

      setTimeout(() => !isCancelled && advanceToNext(), 2500);
    };

    run();

    return () => {
      isCancelled = true;
      stopSpeaking();
      if (activeAudioRef.current) activeAudioRef.current.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex]);

  // Question: play the audio file, otherwise read the question with the AI voice
  useEffect(() => {
    if (phase !== "QUESTION_AUDIO" || !currentPart || !currentQuestion || isPaused) {
      return;
    }

    let isCancelled = false;

    const run = async () => {
      if (currentQuestion.audioUrl) {
        const audio = new Audio(currentQuestion.audioUrl);
        activeAudioRef.current = audio;
        audio.onended = () => !isCancelled && startPrepPhase();
        audio.onerror = () => !isCancelled && startPrepPhase();
        audio.play().catch(() => !isCancelled && startPrepPhase());
        return;
      }

      const spoken = buildTextToSpeak(currentPart, currentQuestion);
      if (spoken) {
        await speakText(spoken);
        if (!isCancelled) startPrepPhase();
        return;
      }

      // Nothing to read aloud — the question is printed inside the picture.
      startPrepPhase();
    };

    run();

    return () => {
      isCancelled = true;
      stopSpeaking();
      if (activeAudioRef.current) activeAudioRef.current.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex]);

  // Countdown driven by a wall-clock deadline so it never drifts
  useEffect(() => {
    if (phase !== "PREPARATION" && phase !== "ANSWER") return;
    if (isPaused || deadlineRef.current === null) return;

    let finished = false;

    const tick = () => {
      if (finished || deadlineRef.current === null) return;
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);

      if (left <= 0) {
        finished = true;
        clearInterval(interval);
        deadlineRef.current = null;
        if (phase === "PREPARATION") {
          startAnswerPhase();
        } else {
          playEndTone().finally(() => advanceToNext());
        }
      }
    };

    const interval = setInterval(tick, 200);
    tick();

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isPaused, stepIndex]);

  // Pausing freezes the countdown and the audio instead of restarting them
  useEffect(() => {
    if (phase === "PREPARATION" || phase === "ANSWER") {
      if (isPaused) {
        if (deadlineRef.current !== null) {
          pausedRemainingRef.current = Math.max(0, deadlineRef.current - Date.now());
          deadlineRef.current = null;
        }
      } else if (pausedRemainingRef.current !== null) {
        deadlineRef.current = Date.now() + pausedRemainingRef.current;
        pausedRemainingRef.current = null;
      }
    }

    if (isPaused) {
      pauseSpeaking();
      activeAudioRef.current?.pause();
    } else {
      resumeSpeaking();
      activeAudioRef.current?.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused]);

  // ------------------------------------------------------------- shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setIsPaused((prev) => !prev);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        advanceToNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key === "Escape") {
        if (zoomedImage) {
          setZoomedImage(null);
        } else if (!document.fullscreenElement) {
          router.push("/mocks");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceToNext, goToPrevious, toggleFullscreen, router, zoomedImage]);

  useEffect(() => {
    return () => stopActiveSound();
  }, [stopActiveSound]);

  // ---------------------------------------------------------------- render
  const circleRadius = 110;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset =
    totalSeconds > 0
      ? circumference - (remainingSeconds / totalSeconds) * circumference
      : 0;

  const images = (currentQuestion?.imageUrls || []).filter((image) => image?.url);
  const questionText = (currentQuestion?.text || "").trim();
  const isTaskPhase =
    phase === "QUESTION_AUDIO" || phase === "PREPARATION" || phase === "ANSWER";

  /** 1 picture fills the row, 2 sit side by side, 3 or 4 form a grid. */
  const imageGridClass =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 3
      ? "grid-cols-3"
      : "grid-cols-2";

  const renderImages = () => {
    if (images.length === 0) return null;
    return (
      <div className={`grid ${imageGridClass} gap-4 md:gap-5 w-full`}>
        {images.map((image, index) => (
          <button
            key={`${image.public_id}-${index}`}
            type="button"
            onClick={() => setZoomedImage(image.url)}
            title="Rasmni kattalashtirish"
            className="group relative aspect-4/3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-md cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={`${index + 1}-rasm`}
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition">
              <ZoomIn className="w-4 h-4" />
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#FAFAFA] text-slate-900 select-none overflow-hidden flex flex-col font-sans">
      {/* Header: level, progress pill, logo */}
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-slate-200/60 bg-white/80 backdrop-blur-sm z-20">
        <span className="text-sm font-bold text-slate-700 tracking-wide uppercase">
          {mock.levelLabel} CEFR Speaking Mock
        </span>

        <div className="flex items-center gap-3 bg-[#0B4F37] text-white px-6 py-2 rounded-full shadow-md">
          {([1, 2, 3] as const).map((group, index) => (
            <React.Fragment key={group}>
              {index > 0 && (
                <span className="text-emerald-400 font-extralight text-sm">•</span>
              )}
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <span
                  className={currentGroup === group && !isFinished ? "text-[#FDE68A]" : ""}
                >
                  {group}.
                </span>
                {isGroupCompleted(group) && (
                  <span className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  </span>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-full.png"
          alt="Haziniy ilm maskani"
          className="h-9 w-auto object-contain drop-shadow-sm select-none"
        />
      </header>

      <main className="flex-1 w-full max-w-[1920px] mx-auto p-6 md:p-10 flex items-center justify-center relative overflow-y-auto">
        {/* Loading */}
        {phase === "LOADING" && (
          <div className="text-center max-w-md w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-full.png"
              alt="Haziniy"
              className="h-16 mx-auto mb-6 object-contain"
            />
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Imtihon materiallari yuklanmoqda...
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Silliq va to&apos;xtovsiz imtihon uchun barcha audio va rasmlar oldindan
              xotiraga yuklanmoqda.
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

        {/* Start */}
        {phase === "START" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xl p-10 md:p-14 text-center max-w-2xl w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
              {steps.length === 0
                ? "Bu mock testda hali topshiriqlar yo'q. Tahrirlash sahifasiga qaytib savollar qo'shing."
                : "Real CEFR kompyuter-asosidagi imtihon standarti bo'yicha loyihalashtirilgan. Imtihonni proyektor yoki katta ekranda to'liq ekran (Fullscreen) rejimida o'tkazish tavsiya etiladi."}
            </p>

            {steps.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => {
                    toggleFullscreen();
                    goToStep(0);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#0B4F37] hover:bg-[#083B29] text-white px-8 py-4 rounded-2xl font-bold text-base shadow-lg hover:shadow-xl transition cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Imtihonni boshlash (Fullscreen)</span>
                </button>

                <button
                  onClick={() => goToStep(0)}
                  className="w-full sm:w-auto text-slate-600 hover:text-slate-900 px-6 py-4 rounded-2xl font-semibold text-sm transition"
                >
                  Oddiy oynada boshlash
                </button>
              </div>
            )}
          </div>
        )}

        {/* Part introduction */}
        {phase === "PART_INTRO" && currentPart && (
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xl p-10 md:p-16 text-center max-w-3xl w-full">
            <div className="inline-flex items-center justify-center px-8 py-3 rounded-2xl bg-[#EAB308] text-slate-900 font-black text-2xl md:text-3xl tracking-tight shadow-md mb-8">
              Part {currentGroup}
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

        {/* Task */}
        {isTaskPhase && currentPart && currentQuestion && (
          <div className="w-full h-full flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12">
            <div className="flex-1 w-full flex flex-col justify-center gap-5">
              {/* Task header — mirrors the official exam layout */}
              <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl px-6 py-3 shadow-sm">
                <span className="text-lg md:text-xl font-bold text-slate-800">
                  Topshiriq #{currentStep?.taskNumber}
                </span>
                <span className="px-4 py-1.5 rounded-full bg-[#0B8A63] text-white font-bold text-sm md:text-base">
                  Part {currentGroup}
                </span>
              </div>

              {currentPart.type === "part3" ? (
                <div className="flex flex-col gap-5">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0B4F37] mb-2 block">
                      Topic Statement:
                    </span>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">
                      {currentQuestion.topic || currentQuestion.text}
                    </h2>
                  </div>

                  {renderImages()}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-emerald-200">
                        <span className="w-3 h-3 rounded-full bg-emerald-600" />
                        <h3 className="text-base font-extrabold uppercase tracking-wider text-emerald-900">
                          FOR
                        </h3>
                      </div>
                      <ul className="space-y-3">
                        {(currentQuestion.forPoints || [])
                          .filter((point) => point?.trim())
                          .map((point, index) => (
                            <li
                              key={index}
                              className="flex items-start gap-2.5 text-base md:text-lg font-semibold text-slate-800 leading-relaxed"
                            >
                              <span className="text-emerald-700 font-bold">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                      </ul>
                    </div>

                    <div className="bg-rose-50/70 border-2 border-rose-300 rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-rose-200">
                        <span className="w-3 h-3 rounded-full bg-rose-600" />
                        <h3 className="text-base font-extrabold uppercase tracking-wider text-rose-900">
                          AGAINST
                        </h3>
                      </div>
                      <ul className="space-y-3">
                        {(currentQuestion.againstPoints || [])
                          .filter((point) => point?.trim())
                          .map((point, index) => (
                            <li
                              key={index}
                              className="flex items-start gap-2.5 text-base md:text-lg font-semibold text-slate-800 leading-relaxed"
                            >
                              <span className="text-rose-700 font-bold">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`flex gap-5 ${
                    images.length === 1 && questionText
                      ? "flex-col md:flex-row md:items-center"
                      : "flex-col"
                  }`}
                >
                  {questionText && (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm flex-1">
                      {currentPart.type === "part2" ? (
                        <div className="space-y-3">
                          {questionText
                            .split("\n")
                            .filter((line) => line.trim())
                            .map((line, index) => (
                              <p
                                key={index}
                                className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900 leading-snug"
                              >
                                {line}
                              </p>
                            ))}
                        </div>
                      ) : (
                        <h2
                          className={`font-bold text-slate-900 leading-tight ${
                            images.length === 0
                              ? "text-3xl md:text-4xl lg:text-[42px]"
                              : "text-2xl md:text-3xl"
                          }`}
                        >
                          {questionText}
                        </h2>
                      )}
                    </div>
                  )}

                  {images.length > 0 && (
                    <div
                      className={images.length === 1 && questionText ? "flex-1" : "w-full"}
                    >
                      {renderImages()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Countdown */}
            <div className="w-full lg:w-80 flex flex-col items-center justify-center shrink-0">
              <div className="relative flex items-center justify-center">
                <svg className="w-64 h-64 -rotate-90 transform">
                  <circle
                    cx="128"
                    cy="128"
                    r={circleRadius}
                    stroke="#E2E8F0"
                    strokeWidth="14"
                    fill="transparent"
                  />
                  <circle
                    cx="128"
                    cy="128"
                    r={circleRadius}
                    stroke={phase === "ANSWER" ? "#10B981" : "#EAB308"}
                    strokeWidth="14"
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: "stroke-dashoffset 0.3s linear" }}
                  />
                </svg>

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

              <div className="h-12 flex items-end justify-center gap-1.5 mt-6">
                {phase === "ANSWER" &&
                  [40, 75, 55, 90, 60, 100, 70, 85, 45, 95, 65, 80, 50].map(
                    (height, index) => (
                      <div
                        key={index}
                        className="w-1.5 bg-[#10B981] rounded-full animate-wave-bar"
                        style={{
                          height: `${height}%`,
                          animationDelay: `${(index * 0.08) % 1.2}s`,
                          animationDuration: `${0.8 + (index % 5) * 0.15}s`,
                        }}
                      />
                    )
                  )}
              </div>

              {isPaused && (
                <span className="mt-3 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider">
                  Pauza
                </span>
              )}
            </div>
          </div>
        )}

        {/* Finished */}
        {phase === "FINISHED" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xl p-10 md:p-14 text-center max-w-xl w-full">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#0B4F37] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 stroke-[2.5]" />
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
              Test yakunlandi!
            </h1>
            <p className="text-slate-500 text-sm mb-8">
              Barcha qismlar muvaffaqiyatli yakuniga yetdi.
            </p>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-full.png"
              alt="Haziniy"
              className="h-14 mx-auto mb-8 object-contain"
            />

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setStepIndex(0);
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

      {/* Enlarged picture */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedImage}
            alt="Kattalashtirilgan rasm"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-6 right-6 p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition"
            title="Yopish (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Teacher controls */}
      <footer
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700/50 text-xs font-semibold">
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

          <button
            onClick={goToPrevious}
            className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
            title="Oldingi (←)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={restartStep}
            className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
            title="Topshiriqni qaytadan boshlash"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={advanceToNext}
            className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer"
            title="Keyingi / O'tkazib yuborish (→)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {currentStep?.kind === "task" && totalTasks > 0 && (
            <>
              <div className="w-px h-4 bg-slate-700" />
              <span className="px-1 text-[11px] font-bold text-slate-300">
                {currentStep.taskNumber} / {totalTasks}
              </span>
            </>
          )}

          <div className="w-px h-4 bg-slate-700" />

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
