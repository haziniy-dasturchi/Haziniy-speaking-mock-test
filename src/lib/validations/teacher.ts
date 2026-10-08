import { z } from "zod";

export const createTeacherSchema = z.object({
  fullName: z.string().min(2, "To'liq ism kamida 2 ta belgidan iborat bo'lishi kerak"),
  login: z
    .string()
    .min(3, "Login kamida 3 ta belgidan iborat bo'lishi kerak")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Loginda faqat lotin harflari, raqamlar va _ . - bo'lishi mumkin"),
  password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak"),
});

export const updateTeacherSchema = z.object({
  fullName: z.string().min(2).optional(),
  login: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
