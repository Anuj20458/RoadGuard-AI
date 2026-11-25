import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
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
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Assigned-by admin ID is required."],
  },
  assignedAt: {
    type: Date,
    default: Date.now,
    required: true,
    immutable: true,
  },
});

assignmentSchema.index({ complaintId: 1, assignedAt: -1 });
assignmentSchema.index({ workerId: 1, assignedAt: -1 });

const Assignment =
  mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema);

export default Assignment;
