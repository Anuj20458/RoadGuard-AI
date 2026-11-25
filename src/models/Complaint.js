import mongoose from "mongoose";

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
