import { z } from "zod";


export const createClusterSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(120),

    connectionType:
      z.enum([
        "kubeconfig"
      ])
      .default("kubeconfig"),

    kubeContext:
      z
        .string()
        .trim()
        .min(1)
        .max(255),

    namespace:
      z
        .string()
        .trim()
        .max(255)
        .optional()
  });