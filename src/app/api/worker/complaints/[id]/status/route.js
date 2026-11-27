import { connection, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireApiAuth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { withOptionalTransaction } from "@/lib/db-transactions";
import {
  COMPLAINT_PUBLIC_FIELDS,
  getLatestAssignmentForComplaint,
  handleOperationsRouteError,
  hydrateComplaints,
  parseJsonBody,
} from "@/lib/operations-data";
import { formatZodErrors } from "@/lib/validators/auth";
import {
  objectIdSchema,
  workerUpdateStatusSchema,
} from "@/lib/validators/operations";
import Complaint from "@/models/Complaint";
import StatusHistory from "@/models/StatusHistory";

/**
 * PATCH /api/worker/complaints/[id]/status
 * Allows the assigned worker to accept an assigned complaint and transition it
 * to `in_progress`, recording the change in StatusHistory.
 */
export async function PATCH(request, context) {
  await connection();

  try {
    const auth = await requireApiAuth("worker");
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

    const parsedBody = workerUpdateStatusSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: formatZodErrors(parsedBody.error),
        },
        { status: 400 }
      );
    }

    const { status: targetStatus, note } = parsedBody.data;

    await connectDB();

    const complaintId = new mongoose.Types.ObjectId(parsedId.data);
    const workerId = new mongoose.Types.ObjectId(auth.user.id);

    const [existingComplaint, latestAssignment] = await Promise.all([
      Complaint.findById(complaintId).select("_id status").lean(),
      getLatestAssignmentForComplaint(complaintId),
    ]);

    if (!existingComplaint) {
      return NextResponse.json(
        { error: "Complaint not found." },
        { status: 404 }
      );
    }

    if (
      !latestAssignment ||
      String(latestAssignment.workerId) !== auth.user.id
    ) {
      return NextResponse.json(
        { error: "You are not assigned to this complaint." },
        { status: 403 }
      );
    }

    if (existingComplaint.status !== "assigned") {
      return NextResponse.json(
        {
          error: `Only assigned complaints can be started (current status: ${existingComplaint.status}).`,
        },
        { status: 409 }
      );
    }

    const historyNote =
      note || "Field worker accepted assignment and started repair work.";

    const updatedDoc = await withOptionalTransaction(async (session) => {
      const updated = await Complaint.findOneAndUpdate(
        { _id: complaintId, status: "assigned" },
        { $set: { status: targetStatus } },
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
            changedBy: workerId,
            previousStatus: "assigned",
            newStatus: targetStatus,
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

    const [complaint] = await hydrateComplaints([updatedDoc]);
    return NextResponse.json({ complaint }, { status: 200 });
  } catch (error) {
    return handleOperationsRouteError(error, "WorkerStatus:PATCH");
  }
}
