import { z } from "zod";

export const loginSchema = z.object({
  login: z.string().min(2, "Login kamida 2 ta belgidan iborat bo'lishi kerak"),
  password: z.string().min(4, "Parol kamida 4 ta belgidan iborat bo'lishi kerak"),
});

export type LoginInput = z.infer<typeof loginSchema>;
