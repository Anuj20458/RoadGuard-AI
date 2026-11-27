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
  adminAssignComplaintSchema,
  objectIdSchema,
} from "@/lib/validators/operations";
import Assignment from "@/models/Assignment";
import Complaint from "@/models/Complaint";
import StatusHistory from "@/models/StatusHistory";
import User from "@/models/User";

/**
 * POST /api/admin/complaints/[id]/assign
 * Assigns a verified (or currently assigned) complaint to an existing worker
 * account, creating Assignment and StatusHistory records.
 */
export async function POST(request, context) {
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

    const parsedBody = adminAssignComplaintSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: formatZodErrors(parsedBody.error),
        },
        { status: 400 }
      );
    }

    const { workerId: rawWorkerId, note } = parsedBody.data;

    await connectDB();

    const complaintId = new mongoose.Types.ObjectId(parsedId.data);
    const workerId = new mongoose.Types.ObjectId(rawWorkerId);
    const adminId = new mongoose.Types.ObjectId(auth.user.id);

    const [existingComplaint, targetWorker] = await Promise.all([
      Complaint.findById(complaintId).select("_id status").lean(),
      User.findById(workerId).select("_id name email role").lean(),
    ]);

    if (!existingComplaint) {
      return NextResponse.json(
        { error: "Complaint not found." },
        { status: 404 }
      );
    }

    if (!targetWorker || targetWorker.role !== "worker") {
      return NextResponse.json(
        { error: "Selected account is not a valid field worker." },
        { status: 400 }
      );
    }

    if (
      existingComplaint.status !== "verified" &&
      existingComplaint.status !== "assigned"
    ) {
      return NextResponse.json(
        {
          error: `Only verified or assigned complaints can be assigned to a worker (current status: ${existingComplaint.status}).`,
        },
        { status: 409 }
      );
    }

    const previousStatus = existingComplaint.status;
    const historyNote =
      note ||
      (previousStatus === "assigned"
        ? `Reassigned to field worker ${targetWorker.name}.`
        : `Assigned to field worker ${targetWorker.name}.`);

    const updatedDoc = await withOptionalTransaction(async (session) => {
      const updated = await Complaint.findOneAndUpdate(
        { _id: complaintId, status: { $in: ["verified", "assigned"] } },
        { $set: { status: "assigned" } },
        { new: true, ...(session ? { session } : {}) }
      )
        .select(COMPLAINT_PUBLIC_FIELDS)
        .lean();

      if (!updated) {
        return null;
      }

      await Assignment.create(
        [
          {
            complaintId,
            workerId,
            assignedBy: adminId,
          },
        ],
        session ? { session } : undefined
      );

      await StatusHistory.create(
        [
          {
            complaintId,
            changedBy: adminId,
            previousStatus,
            newStatus: "assigned",
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

    const [[complaint], stats, workers] = await Promise.all([
      hydrateComplaints([updatedDoc]),
      getAdminDashboardStats(),
      listWorkersWithLoad(),
    ]);
    return NextResponse.json({ complaint, stats, workers }, { status: 200 });
  } catch (error) {
    return handleOperationsRouteError(error, "AdminAssign:POST");
  }
}
