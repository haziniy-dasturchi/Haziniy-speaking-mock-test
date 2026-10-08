import { z } from "zod";

export const createMockSchema = z.object({
  title: z.string().min(2, "Sarlavha kamida 2 ta belgidan iborat bo'lishi kerak"),
  levelLabel: z.string().default("B1–C1"),
});

export const updateMockSchema = z.object({
  title: z.string().min(2).optional(),
  levelLabel: z.string().optional(),
  status: z.enum(["draft", "ready"]).optional(),
});

export const updatePartSchema = z.object({
  instructionText: z.string().min(1, "Yo'riqnoma matni kiritilishi lozim"),
  instructionAudioUrl: z.string().nullable().optional(),
  instructionAudioPublicId: z.string().nullable().optional(),
  defaultPrepSeconds: z.number().int().min(0).max(600),
  defaultAnswerSeconds: z.number().int().min(0).max(600),
});

export const questionImageSchema = z.object({
  url: z.string().url(),
  public_id: z.string(),
});

export const questionSchema = z.object({
  text: z.string().default(""),
  audioUrl: z.string().nullable().optional(),
  audioPublicId: z.string().nullable().optional(),
  imageUrls: z.array(questionImageSchema).optional().default([]),
  prepSeconds: z.number().int().min(0).max(600).nullable().optional(),
  answerSeconds: z.number().int().min(0).max(600).nullable().optional(),
  topic: z.string().nullable().optional(),
  forPoints: z.array(z.string()).optional().default([]),
  againstPoints: z.array(z.string()).optional().default([]),
});

export const updateQuestionOrderSchema = z.object({
  questionIds: z.array(z.string()),
});

// Full validation to check if a mock is complete and ready for exam
export interface MockValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateMockReady(partsWithQuestions: any[]): MockValidationResult {
  const errors: string[] = [];

  const part1_1 = partsWithQuestions.find((p) => p.type === "part1_1");
  const part1_2 = partsWithQuestions.find((p) => p.type === "part1_2");
  const part2 = partsWithQuestions.find((p) => p.type === "part2");
  const part3 = partsWithQuestions.find((p) => p.type === "part3");

  // Part 1.1: 3 short personal questions
  if (!part1_1 || !part1_1.questions || part1_1.questions.length < 1) {
    errors.push("Part 1.1 da kamida 1 ta savol bo'lishi kerak (tavsiya: 3 ta savol).");
  }

  // Part 1.2: 2 images + questions
  if (!part1_2 || !part1_2.questions || part1_2.questions.length === 0) {
    errors.push("Part 1.2 da savollar va 2 ta rasm kiritilishi kerak.");
  } else {
    const hasImages = part1_2.questions.some(
      (q: any) => q.imageUrls && q.imageUrls.length >= 2
    );
    if (!hasImages) {
      errors.push("Part 1.2 da taqqoslash uchun 2 ta rasm yuklangan bo'lishi kerak.");
    }
  }

  // Part 2: 1 image + questions
  if (!part2 || !part2.questions || part2.questions.length === 0) {
    errors.push("Part 2 da rasm va savollar to'plami kiritilishi kerak.");
  } else {
    const hasImage = part2.questions.some(
      (q: any) => q.imageUrls && q.imageUrls.length >= 1
    );
    if (!hasImage) {
      errors.push("Part 2 da kamida 1 ta rasm yuklangan bo'lishi kerak.");
    }
  }

  // Part 3: Topic statement + FOR table + AGAINST table
  if (!part3 || !part3.questions || part3.questions.length === 0) {
    errors.push("Part 3 da mavzu va FOR/AGAINST dalillari kiritilishi kerak.");
  } else {
    const q3 = part3.questions[0];
    if (!q3.topic && !q3.text) {
      errors.push("Part 3 da muhokama mavzusi (topic) kiritilishi kerak.");
    }
    const forCount = (q3.forPoints || []).filter((p: string) => p.trim().length > 0).length;
    const againstCount = (q3.againstPoints || []).filter((p: string) => p.trim().length > 0).length;
    if (forCount < 1 || againstCount < 1) {
      errors.push("Part 3 da FOR va AGAINST jadvallarida dalillar kiritilishi kerak (tavsiya: 3 tadan).");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
