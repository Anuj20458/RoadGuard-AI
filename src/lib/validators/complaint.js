import { z } from "zod";
import {
  AUTHORITY_CATEGORY_VALUES,
  DEFAULT_COUNTRY,
  INDIAN_PIN_ERROR_MESSAGE,
  isValidIndianPinCode,
  REPORT_CATEGORY_VALUES,
  ROAD_TYPE_VALUES,
} from "@/lib/india-data";
import { COMPLAINT_PRIORITIES } from "@/models/Complaint";
import { validateCloudinaryComplaintImageUrl } from "@/lib/roboflow";

export const DEFAULT_COMPLAINTS_PAGE = 1;
export const DEFAULT_COMPLAINTS_LIMIT = 10;
export const MAX_COMPLAINTS_LIMIT = 50;

const locationSchema = z.strictObject(
  {
    latitude: z
      .number({ error: "Latitude must be a valid number." })
      .finite("Latitude must be a finite number.")
      .min(-90, "Latitude must be between -90 and 90.")
      .max(90, "Latitude must be between -90 and 90."),
    longitude: z
      .number({ error: "Longitude must be a valid number." })
      .finite("Longitude must be a finite number.")
      .min(-180, "Longitude must be between -180 and 180.")
      .max(180, "Longitude must be between -180 and 180."),
    address: z
      .string({ error: "Address must be a text string." })
      .trim()
      .max(300, "Address cannot exceed 300 characters.")
      .optional()
      .default(""),
    country: z
      .string({ error: "Country must be a text string." })
      .trim()
      .max(80, "Country cannot exceed 80 characters.")
      .optional()
      .default(DEFAULT_COUNTRY),
    state: z
      .string({ error: "State / UT must be a text string." })
      .trim()
      .max(100, "State / UT cannot exceed 100 characters.")
      .optional()
      .default(""),
    district: z
      .string({ error: "District must be a text string." })
      .trim()
      .max(100, "District cannot exceed 100 characters.")
      .optional()
      .default(""),
    city: z
      .string({ error: "City / town must be a text string." })
      .trim()
      .max(100, "City / town cannot exceed 100 characters.")
      .optional()
      .default(""),
    ward: z
      .string({ error: "Ward / locality must be a text string." })
      .trim()
      .max(120, "Ward / locality cannot exceed 120 characters.")
      .optional()
      .default(""),
    pinCode: z
      .string({ error: "PIN code must be a text string." })
      .trim()
      .refine((value) => isValidIndianPinCode(value), {
        message: INDIAN_PIN_ERROR_MESSAGE,
      })
      .optional()
      .default(""),
  },
  { error: "Location is required." }
);

export const createComplaintSchema = z.strictObject({
  title: z
    .string({ error: "Title is required." })
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(150, "Title cannot exceed 150 characters."),
  description: z
    .string({ error: "Description is required." })
    .trim()
    .min(5, "Description must be at least 5 characters.")
    .max(2000, "Description cannot exceed 2000 characters."),
  imageUrl: z
    .string({ error: "Image URL is required." })
    .trim()
    .min(1, "Image URL is required.")
    .max(2048, "Image URL cannot exceed 2048 characters.")
    .transform((value, ctx) => {
      try {
        return validateCloudinaryComplaintImageUrl(value);
      } catch (error) {
        if (error?.code === "INVALID_IMAGE_URL") {
          ctx.addIssue({
            code: "custom",
            message: error.message || "Invalid Cloudinary complaint image URL.",
          });
          return z.NEVER;
        }
        throw error;
      }
    }),
  location: locationSchema,
  priority: z
    .enum(COMPLAINT_PRIORITIES, {
      error: "Priority must be low, medium, high, or critical.",
    })
    .optional()
    .default("medium"),
  reportCategory: z
    .enum(REPORT_CATEGORY_VALUES, {
      error: "Invalid report category.",
    })
    .optional()
    .default("pothole"),
  roadType: z
    .enum(["", ...ROAD_TYPE_VALUES], {
      error: "Invalid road type.",
    })
    .optional()
    .default(""),
  authorityCategory: z
    .enum(["", ...AUTHORITY_CATEGORY_VALUES], {
      error: "Invalid road authority category.",
    })
    .optional()
    .default(""),
});

export const listComplaintsQuerySchema = z.strictObject({
  page: z
    .string()
    .trim()
    .regex(/^\d+$/, "Page must be a positive integer.")
    .transform((value) => Number.parseInt(value, 10))
    .refine(
      (value) => Number.isSafeInteger(value) && value >= 1 && value <= 10000,
      "Page must be between 1 and 10000."
    )
    .optional()
    .default(DEFAULT_COMPLAINTS_PAGE),
  limit: z
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
    .default(DEFAULT_COMPLAINTS_LIMIT),
});
