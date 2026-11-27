import { z } from "zod";
import {
  INDIAN_PHONE_ERROR_MESSAGE,
  isValidIndianPhone,
} from "@/lib/india-data";

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
    .max(20, "Phone number cannot exceed 20 characters.")
    .refine((value) => value === "" || isValidIndianPhone(value), {
      message: INDIAN_PHONE_ERROR_MESSAGE,
    })
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
    const key =
      issue.path && issue.path.length > 0
        ? issue.path.map(String).join(".")
        : "form";
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}
