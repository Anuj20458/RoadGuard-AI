import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string({ error: "Name is required." })
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(100, "Name cannot exceed 100 characters."),
  email: z
    .string({ error: "Email is required." })
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
  password: z
    .string({ error: "Password is required." })
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password cannot exceed 128 characters."),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{7,20}$/, "Please enter a valid phone number.")
    .optional()
    .or(z.literal("")),
});

export const loginSchema = z.object({
  email: z
    .string({ error: "Email is required." })
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
  password: z
    .string({ error: "Password is required." })
    .min(1, "Password is required.")
    .max(128, "Password cannot exceed 128 characters."),
});

/**
 * Converts Zod validation issues into a clean field-error map for API responses.
 *
 * @param {import("zod").ZodError} zodError
 * @returns {Record<string, string>}
 */
export function formatZodErrors(zodError) {
  const fieldErrors = {};

  for (const issue of zodError.issues) {
    const key = issue.path?.[0] ? String(issue.path[0]) : "form";
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}
