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
  parseJsonBody,
} from "@/lib/operations-data";
import { formatZodErrors } from "@/lib/validators/auth";
import {
  adminReviewComplaintSchema,
  objectIdSchema,
} from "@/lib/validators/operations";
import Complaint from "@/models/Complaint";
import StatusHistory from "@/models/StatusHistory";

/**
 * PATCH /api/admin/complaints/[id]/review
 * Allows an authenticated admin to verify or reject a pending complaint,
 * recording the transition in StatusHistory.
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

    const parsedBody = adminReviewComplaintSchema.safeParse(body);
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
    const newStatus = action === "verify" ? "verified" : "rejected";
    const historyNote =
      note ||
      (action === "verify"
        ? "Complaint verified by municipal admin."
        : "Complaint rejected by municipal admin.");

    await connectDB();

    const complaintId = new mongoose.Types.ObjectId(parsedId.data);
    const adminId = new mongoose.Types.ObjectId(auth.user.id);

    const existing = await Complaint.findById(complaintId)
      .select("_id status")
      .lean();
    if (!existing) {
      return NextResponse.json(
        { error: "Complaint not found." },
        { status: 404 }
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        {
          error: `Only pending complaints can be verified or rejected (current status: ${existing.status}).`,
        },
        { status: 409 }
      );
    }

    const updatedDoc = await withOptionalTransaction(async (session) => {
      const updated = await Complaint.findOneAndUpdate(
        { _id: complaintId, status: "pending" },
        { $set: { status: newStatus } },
        { new: true, ...(session ? { session } : {}) }
      )
        .select(COMPLAINT_PUBLIC_FIELDS)
        .lean();

      if (!updated) {
        return null;
      }

      await StatusHistory.create(
        [
          {
            complaintId,
            changedBy: adminId,
            previousStatus: "pending",
            newStatus,
            note: historyNote,
          },
        ],
        session ? { session } : undefined
      );

      return updated;
    });

    if (!updatedDoc) {
      return NextResponse.json(
        { error: "Complaint status changed concurrently. Please refresh." },
        { status: 409 }
      );
    }

    const [[complaint], stats] = await Promise.all([
      hydrateComplaints([updatedDoc]),
      getAdminDashboardStats(),
    ]);
    return NextResponse.json({ complaint, stats }, { status: 200 });
  } catch (error) {
    return handleOperationsRouteError(error, "AdminReview:PATCH");
  }
}
