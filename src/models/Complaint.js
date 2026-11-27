import mongoose from "mongoose";
import {
  AUTHORITY_CATEGORY_VALUES,
  DEFAULT_COUNTRY,
  INDIAN_PIN_ERROR_MESSAGE,
  isValidIndianPinCode,
  REPORT_CATEGORY_VALUES,
  ROAD_TYPE_VALUES,
} from "../lib/india-data.js";

export const COMPLAINT_STATUSES = [
  "pending",
  "verified",
  "assigned",
  "in_progress",
  "resolved",
  "rejected",
];

export const COMPLAINT_PRIORITIES = ["low", "medium", "high", "critical"];

export const HTTP_URL_REGEX = /^https?:\/\/.+/;

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: [true, "Latitude is required."],
      min: [-90, "Latitude must be between -90 and 90."],
      max: [90, "Latitude must be between -90 and 90."],
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required."],
      min: [-180, "Longitude must be between -180 and 180."],
      max: [180, "Longitude must be between -180 and 180."],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [300, "Address cannot exceed 300 characters."],
      default: "",
    },
    country: {
      type: String,
      trim: true,
      maxlength: [80, "Country cannot exceed 80 characters."],
      default: DEFAULT_COUNTRY,
    },
    state: {
      type: String,
      trim: true,
      maxlength: [100, "State / UT cannot exceed 100 characters."],
      default: "",
    },
    district: {
      type: String,
      trim: true,
      maxlength: [100, "District cannot exceed 100 characters."],
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, "City / town cannot exceed 100 characters."],
      default: "",
    },
    ward: {
      type: String,
      trim: true,
      maxlength: [120, "Ward / locality cannot exceed 120 characters."],
      default: "",
    },
    pinCode: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (value) => !value || isValidIndianPinCode(value),
        message: INDIAN_PIN_ERROR_MESSAGE,
      },
    },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Citizen ID is required."],
    },
    title: {
      type: String,
      required: [true, "Title is required."],
      trim: true,
      minlength: [3, "Title must be at least 3 characters."],
      maxlength: [150, "Title cannot exceed 150 characters."],
    },
    description: {
      type: String,
      required: [true, "Description is required."],
      trim: true,
      minlength: [5, "Description must be at least 5 characters."],
      maxlength: [2000, "Description cannot exceed 2000 characters."],
    },
    imageUrl: {
      type: String,
      required: [true, "Image URL is required."],
      trim: true,
      match: [HTTP_URL_REGEX, "Image URL must be a valid HTTP or HTTPS URL."],
    },
    location: {
      type: locationSchema,
      required: [true, "Location is required."],
    },
    detectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Detection",
      default: null,
    },
    priority: {
      type: String,
      enum: {
        values: COMPLAINT_PRIORITIES,
        message: "Priority must be low, medium, high, or critical.",
      },
      default: "medium",
      required: true,
    },
    reportCategory: {
      type: String,
      enum: {
        values: REPORT_CATEGORY_VALUES,
        message: "Invalid report category.",
      },
      default: "pothole",
    },
    roadType: {
      type: String,
      enum: {
        values: ["", ...ROAD_TYPE_VALUES],
        message: "Invalid road type.",
      },
      default: "",
    },
    authorityCategory: {
      type: String,
      enum: {
        values: ["", ...AUTHORITY_CATEGORY_VALUES],
        message: "Invalid road authority category.",
      },
      default: "",
    },
    status: {
      type: String,
      enum: {
        values: COMPLAINT_STATUSES,
        message: "Invalid complaint status.",
      },
      default: "pending",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

complaintSchema.index({ citizenId: 1, createdAt: -1 });
complaintSchema.index({ status: 1, priority: 1, createdAt: -1 });
complaintSchema.index({ "location.latitude": 1, "location.longitude": 1 });

const Complaint =
  mongoose.models.Complaint || mongoose.model("Complaint", complaintSchema);

export default Complaint;
