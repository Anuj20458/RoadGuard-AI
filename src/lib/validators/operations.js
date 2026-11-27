import { z } from "zod";
import {
  INDIAN_PHONE_ERROR_MESSAGE,
  isValidIndianPhone,
} from "@/lib/india-data";
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} from "@/models/Complaint";
import { validateCloudinaryFolderImageUrl } from "@/lib/cloudinary";
import {
  DEFAULT_COMPLAINTS_LIMIT,
  DEFAULT_COMPLAINTS_PAGE,
  MAX_COMPLAINTS_LIMIT,
} from "@/lib/validators/complaint";

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

export const objectIdSchema = z
  .string({ error: "Identifier is required." })
  .trim()
  .regex(OBJECT_ID_REGEX, "Invalid identifier format.");

const pageParamSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Page must be a positive integer.")
  .transform((value) => Number.parseInt(value, 10))
  .refine(
    (value) => Number.isSafeInteger(value) && value >= 1 && value <= 10000,
    "Page must be between 1 and 10000."
  )
  .optional()
  .default(DEFAULT_COMPLAINTS_PAGE);

const limitParamSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Limit must be a positive integer.")
  .transform((value) => Number.parseInt(value, 10))
  .refine(
    (value) =>
      Number.isSafeInteger(value) &&
      value >= 1 &&
      value <= MAX_COMPLAINTS_LIMIT,
    `Limit must be between 1 and ${MAX_COMPLAINTS_LIMIT}.`
  )
  .optional()
  .default(DEFAULT_COMPLAINTS_LIMIT);

export const adminListComplaintsQuerySchema = z.strictObject({
  page: pageParamSchema,
  limit: limitParamSchema,
  status: z
    .enum(COMPLAINT_STATUSES, {
      error: "Invalid complaint status filter.",
    })
    .optional(),
  priority: z
    .enum(COMPLAINT_PRIORITIES, {
      error: "Invalid complaint priority filter.",
    })
    .optional(),
});

export const adminReviewComplaintSchema = z
  .strictObject({
    action: z.enum(["verify", "reject"], {
      error: "Action must be verify or reject.",
    }),
    note: z
      .string({ error: "Review note must be text." })
      .trim()
      .max(1000, "Note cannot exceed 1000 characters.")
      .optional()
      .default(""),
  })
  .superRefine((data, ctx) => {
    if (data.action === "reject" && data.note.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Please provide a rejection reason (at least 3 characters).",
      });
    }
  });

export const adminAssignComplaintSchema = z.strictObject({
  workerId: objectIdSchema,
  note: z
    .string({ error: "Assignment note must be text." })
    .trim()
    .max(1000, "Note cannot exceed 1000 characters.")
    .optional()
    .default(""),
});

export const adminRepairVerificationSchema = z
  .strictObject({
    action: z.enum(["approve", "reject"], {
      error: "Action must be approve or reject.",
    }),
    note: z
      .string({ error: "Verification note must be text." })
      .trim()
      .max(1000, "Note cannot exceed 1000 characters.")
      .optional()
      .default(""),
  })
  .superRefine((data, ctx) => {
    if (data.action === "reject" && data.note.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message:
          "Please provide a reason when rejecting repair verification (at least 3 characters).",
      });
    }
  });

export const adminCreateWorkerSchema = z.strictObject({
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

export const WORKER_FILTER_STATUSES = ["assigned", "in_progress", "resolved"];

export const workerListComplaintsQuerySchema = z.strictObject({
  page: pageParamSchema,
  limit: limitParamSchema,
  status: z
    .enum(WORKER_FILTER_STATUSES, {
      error: "Status filter must be assigned, in_progress, or resolved.",
    })
    .optional(),
});

export const workerUpdateStatusSchema = z.strictObject({
  status: z.enum(["in_progress"], {
    error: "Workers may only transition assigned complaints to in_progress.",
  }),
  note: z
    .string({ error: "Note must be text." })
    .trim()
    .max(1000, "Note cannot exceed 1000 characters.")
    .optional()
    .default(""),
});

export const workerSubmitRepairSchema = z.strictObject({
  afterImage: z
    .string({ error: "After-repair image URL is required." })
    .trim()
    .min(1, "After-repair image URL is required.")
    .max(2048, "Image URL cannot exceed 2048 characters.")
    .transform((value, ctx) => {
      try {
        return validateCloudinaryFolderImageUrl(value, [
          "roadguard",
          "repairs",
        ]);
      } catch (error) {
        if (error?.code === "INVALID_IMAGE_URL") {
          ctx.addIssue({
            code: "custom",
            message:
              error.message || "Invalid Cloudinary repair image URL.",
          });
          return z.NEVER;
        }
        throw error;
      }
    }),
  repairNotes: z
    .string({ error: "Repair notes are required." })
    .trim()
    .min(5, "Repair notes must be at least 5 characters.")
    .max(2000, "Repair notes cannot exceed 2000 characters."),
});
