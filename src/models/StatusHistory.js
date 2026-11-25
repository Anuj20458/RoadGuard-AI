import mongoose from "mongoose";
import { COMPLAINT_STATUSES } from "./Complaint.js";

const statusHistorySchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Complaint",
    required: [true, "Complaint ID is required."],
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Changed-by user ID is required."],
  },
  previousStatus: {
    type: String,
    enum: {
      values: [...COMPLAINT_STATUSES, null],
      message: "Invalid previous complaint status.",
    },
    default: null,
  },
  newStatus: {
    type: String,
    enum: {
      values: COMPLAINT_STATUSES,
      message: "Invalid new complaint status.",
    },
    required: [true, "New status is required."],
  },
  note: {
    type: String,
    trim: true,
    maxlength: [1000, "Note cannot exceed 1000 characters."],
    default: "",
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    immutable: true,
  },
});

statusHistorySchema.index({ complaintId: 1, timestamp: -1 });
statusHistorySchema.index({ changedBy: 1, timestamp: -1 });

const StatusHistory =
  mongoose.models.StatusHistory ||
  mongoose.model("StatusHistory", statusHistorySchema);

export default StatusHistory;
