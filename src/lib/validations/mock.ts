import { z } from "zod";

export const MAX_QUESTION_IMAGES = 4;

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
  instructionText: z.string().optional(),
  instructionAudioUrl: z.string().nullable().optional(),
  instructionAudioPublicId: z.string().nullable().optional(),
  defaultPrepSeconds: z.number().int().min(0).max(600).optional(),
  defaultAnswerSeconds: z.number().int().min(0).max(600).optional(),
});

/**
 * Media URLs can be absolute (Cloudinary) or application-relative
 * (/api/media/<id>), so a plain non-empty string is the right check here.
 */
export const questionImageSchema = z.object({
  url: z.string().min(1),
  public_id: z.string().min(1),
});

export const questionSchema = z.object({
  text: z.string().default(""),
  audioUrl: z.string().nullable().optional(),
  audioPublicId: z.string().nullable().optional(),
  imageUrls: z
    .array(questionImageSchema)
    .max(MAX_QUESTION_IMAGES, `Bitta savolga ko'pi bilan ${MAX_QUESTION_IMAGES} ta rasm qo'shish mumkin`)
    .optional()
    .default([]),
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

function hasContent(question: any): boolean {
  const hasText = typeof question?.text === "string" && question.text.trim().length > 0;
  const hasTopic = typeof question?.topic === "string" && question.topic.trim().length > 0;
  const hasImages = Array.isArray(question?.imageUrls) && question.imageUrls.length > 0;
  const hasAudio = !!question?.audioUrl;
  return hasText || hasTopic || hasImages || hasAudio;
}

/**
 * A mock is ready when every part has at least one task and every task has
 * something to show the student: a question text, a picture, or an audio file.
 * Pictures and question text are both optional on their own — a task whose
 * question is printed inside the picture is perfectly valid.
 */
export function validateMockReady(partsWithQuestions: any[]): MockValidationResult {
  const errors: string[] = [];

  if (!partsWithQuestions || partsWithQuestions.length === 0) {
    errors.push("Mock testda bo'limlar topilmadi.");
    return { isValid: false, errors };
  }

  const nonEmptyParts = partsWithQuestions.filter(
    (p) => (p.questions || []).length > 0
  );

  if (nonEmptyParts.length === 0) {
    errors.push("Kamida bitta bo'limda savol bo'lishi kerak.");
    return { isValid: false, errors };
  }

  for (const part of partsWithQuestions) {
    const questions = part.questions || [];
    if (questions.length === 0) {
      errors.push(
        `${part.displayLabel}: kamida 1 ta topshiriq qo'shing (yoki bo'limni bo'sh qoldirmang).`
      );
      continue;
    }

    questions.forEach((q: any, index: number) => {
      if (part.type === "part3") {
        const topic = (q.topic || q.text || "").trim();
        if (!topic) {
          errors.push(`${part.displayLabel} — ${index + 1}-topshiriq: muhokama mavzusi kiritilmagan.`);
        }
        const forCount = (q.forPoints || []).filter((p: string) => p?.trim()).length;
        const againstCount = (q.againstPoints || []).filter((p: string) => p?.trim()).length;
        if (forCount === 0 || againstCount === 0) {
          errors.push(
            `${part.displayLabel} — ${index + 1}-topshiriq: FOR va AGAINST ustunlarining har birida kamida 1 ta dalil bo'lishi kerak.`
          );
        }
        return;
      }

      if (!hasContent(q)) {
        errors.push(
          `${part.displayLabel} — ${index + 1}-topshiriq: savol matni, rasm yoki audiodan kamida bittasi bo'lishi kerak.`
        );
      }

      if (Array.isArray(q.imageUrls) && q.imageUrls.length > MAX_QUESTION_IMAGES) {
        errors.push(
          `${part.displayLabel} — ${index + 1}-topshiriq: ko'pi bilan ${MAX_QUESTION_IMAGES} ta rasm qo'shish mumkin.`
        );
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
