import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase().trim()),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),

  workspaceName: z
    .string()
    .min(2)
    .max(120)
    .optional()
});


export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase().trim()),

  password: z
    .string()
    .min(1)
});