import mongoose from "mongoose";
import { HTTP_URL_REGEX } from "./Complaint.js";

export const VERIFICATION_STATUSES = ["pending", "approved", "rejected"];

const repairVerificationSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: [true, "Complaint ID is required."],
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Worker ID is required."],
    },
    beforeImage: {
      type: String,
      required: [true, "Before image URL is required."],
      trim: true,
      match: [HTTP_URL_REGEX, "Before image must be a valid HTTP or HTTPS URL."],
    },
    afterImage: {
      type: String,
      required: [true, "After image URL is required."],
      trim: true,
      match: [HTTP_URL_REGEX, "After image must be a valid HTTP or HTTPS URL."],
    },
    repairNotes: {
      type: String,
      trim: true,
      maxlength: [2000, "Repair notes cannot exceed 2000 characters."],
      default: "",
    },
    verificationStatus: {
      type: String,
      enum: {
        values: VERIFICATION_STATUSES,
        message: "Verification status must be pending, approved, or rejected.",
      },
      default: "pending",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

repairVerificationSchema.index({ complaintId: 1, createdAt: -1 });
repairVerificationSchema.index({ workerId: 1, verificationStatus: 1 });

const RepairVerification =
  mongoose.models.RepairVerification ||
  mongoose.model("RepairVerification", repairVerificationSchema);

export default RepairVerification;
