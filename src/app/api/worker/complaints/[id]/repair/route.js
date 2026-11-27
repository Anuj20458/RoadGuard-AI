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
  workerSubmitRepairSchema,
} from "@/lib/validators/operations";
import Complaint from "@/models/Complaint";
import RepairVerification from "@/models/RepairVerification";
import StatusHistory from "@/models/StatusHistory";

/**
 * POST /api/worker/complaints/[id]/repair
 * Submits repair evidence (afterImage + repairNotes) for an assigned complaint.
 * Creates a RepairVerification record in `pending` verificationStatus and keeps
 * complaint status in `in_progress` until an authorized admin verifies it.
 */
export async function POST(request, context) {
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

    const parsedBody = workerSubmitRepairSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: formatZodErrors(parsedBody.error),
        },
        { status: 400 }
      );
    }

    const { afterImage, repairNotes } = parsedBody.data;

    await connectDB();

    const complaintId = new mongoose.Types.ObjectId(parsedId.data);
    const workerId = new mongoose.Types.ObjectId(auth.user.id);

    const [existingComplaint, latestAssignment, latestVerification] =
      await Promise.all([
        Complaint.findById(complaintId).select("_id status imageUrl").lean(),
        getLatestAssignmentForComplaint(complaintId),
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
      !latestAssignment ||
      String(latestAssignment.workerId) !== auth.user.id
    ) {
      return NextResponse.json(
        { error: "You are not assigned to this complaint." },
        { status: 403 }
      );
    }

    if (
      existingComplaint.status !== "assigned" &&
      existingComplaint.status !== "in_progress"
    ) {
      return NextResponse.json(
        {
          error: `Repair evidence cannot be submitted for a complaint with status ${existingComplaint.status}.`,
        },
        { status: 409 }
      );
    }

    if (latestVerification?.verificationStatus === "pending") {
      return NextResponse.json(
        {
          error:
            "Repair evidence is already awaiting admin verification for this complaint.",
        },
        { status: 409 }
      );
    }

    const previousStatus = existingComplaint.status;

    const updatedDoc = await withOptionalTransaction(async (session) => {
      // Never mark resolved here; admin approval is required before resolving.
      const updated = await Complaint.findOneAndUpdate(
        { _id: complaintId, status: { $in: ["assigned", "in_progress"] } },
        { $set: { status: "in_progress" } },
        { new: true, ...(session ? { session } : {}) }
      )
        .select(COMPLAINT_PUBLIC_FIELDS)
        .lean();

      if (!updated) {
        return null;
      }

      await RepairVerification.create(
        [
          {
            complaintId,
            workerId,
            beforeImage: existingComplaint.imageUrl,
            afterImage,
            repairNotes,
            verificationStatus: "pending",
          },
        ],
        session ? { session } : undefined
      );

      await StatusHistory.create(
        [
          {
            complaintId,
            changedBy: workerId,
            previousStatus,
            newStatus: "in_progress",
            note: `Repair evidence submitted for admin verification: ${repairNotes.slice(0, 800)}`,
          },
        ],
        session ? { session } : undefined
      );

      return updated;
    });

    if (!updatedDoc) {
      return NextResponse.json(
        { error: "Complaint state changed concurrently. Please refresh." },
        { status: 409 }
      );
    }

    const [complaint] = await hydrateComplaints([updatedDoc]);
    return NextResponse.json({ complaint }, { status: 201 });
  } catch (error) {
    return handleOperationsRouteError(error, "WorkerRepair:POST");
  }
}
