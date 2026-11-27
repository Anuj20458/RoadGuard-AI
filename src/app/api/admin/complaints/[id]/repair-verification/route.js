import { connection, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireApiAuth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { withOptionalTransaction } from "@/lib/db-transactions";
import {
  COMPLAINT_PUBLIC_FIELDS,
  getAdminDashboardStats,
  handleOperationsRouteError,
  hydrateComplaints,
  listWorkersWithLoad,
  parseJsonBody,
} from "@/lib/operations-data";
import { formatZodErrors } from "@/lib/validators/auth";
import {
  adminRepairVerificationSchema,
  objectIdSchema,
} from "@/lib/validators/operations";
import Complaint from "@/models/Complaint";
import RepairVerification from "@/models/RepairVerification";
import StatusHistory from "@/models/StatusHistory";

/**
 * PATCH /api/admin/complaints/[id]/repair-verification
 * Allows an authenticated admin to approve (marking the complaint resolved)
 * or reject (returning to in_progress for rework) a pending repair submission.
 */
export async function PATCH(request, context) {
  await connection();

  try {
    const auth = await requireApiAuth("admin");
    if (auth.response) {
      return auth.response;
    }

    const { id } = await context.params;
    const parsedId = objectIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "Invalid complaint ID." },
        { status: 400 }
      );
    }

    const { data: body, errorResponse } = await parseJsonBody(request);
    if (errorResponse) {
      return errorResponse;
    }

    const parsedBody = adminRepairVerificationSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: formatZodErrors(parsedBody.error),
        },
        { status: 400 }
      );
    }

    const { action, note } = parsedBody.data;

    await connectDB();

    const complaintId = new mongoose.Types.ObjectId(parsedId.data);
    const adminId = new mongoose.Types.ObjectId(auth.user.id);

    const [existingComplaint, latestVerification] = await Promise.all([
      Complaint.findById(complaintId).select("_id status").lean(),
      RepairVerification.findOne({ complaintId })
        .sort({ createdAt: -1, _id: -1 })
        .select("_id verificationStatus")
        .lean(),
    ]);

    if (!existingComplaint) {
      return NextResponse.json(
        { error: "Complaint not found." },
        { status: 404 }
      );
    }

    if (
      !latestVerification ||
      latestVerification.verificationStatus !== "pending"
    ) {
      return NextResponse.json(
        { error: "No pending repair verification found for this complaint." },
        { status: 409 }
      );
    }

    if (existingComplaint.status !== "in_progress") {
      return NextResponse.json(
        {
          error: `Complaint must be in_progress for repair verification (current status: ${existingComplaint.status}).`,
        },
        { status: 409 }
      );
    }

    const verificationStatus = action === "approve" ? "approved" : "rejected";
    const newComplaintStatus =
      action === "approve" ? "resolved" : "in_progress";
    const historyNote =
      note ||
      (action === "approve"
        ? "Repair evidence verified and approved by municipal admin."
        : "Repair evidence rejected by municipal admin; rework required.");

    const updatedDoc = await withOptionalTransaction(async (session) => {
      const updatedVerification = await RepairVerification.findOneAndUpdate(
        { _id: latestVerification._id, verificationStatus: "pending" },
        { $set: { verificationStatus } },
        { new: true, ...(session ? { session } : {}) }
      ).lean();

      if (!updatedVerification) {
        return null;
      }

      const updatedComplaint = await Complaint.findOneAndUpdate(
        { _id: complaintId, status: "in_progress" },
        { $set: { status: newComplaintStatus } },
        { new: true, ...(session ? { session } : {}) }
      )
        .select(COMPLAINT_PUBLIC_FIELDS)
        .lean();

      if (!updatedComplaint) {
        return null;
      }

      await StatusHistory.create(
        [
          {
            complaintId,
            changedBy: adminId,
            previousStatus: "in_progress",
            newStatus: newComplaintStatus,
            note: historyNote,
          },
        ],
        session ? { session } : undefined
      );

      return updatedComplaint;
    });

    if (!updatedDoc) {
      return NextResponse.json(
        { error: "Repair verification state changed concurrently. Please refresh." },
        { status: 409 }
      );
    }

    const [[complaint], stats, workers] = await Promise.all([
      hydrateComplaints([updatedDoc]),
      getAdminDashboardStats(),
      listWorkersWithLoad(),
    ]);
    return NextResponse.json({ complaint, stats, workers }, { status: 200 });
  } catch (error) {
    return handleOperationsRouteError(error, "AdminRepairVerification:PATCH");
  }
}
