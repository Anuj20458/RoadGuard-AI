import { connection, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireApiAuth } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  COMPLAINT_PUBLIC_FIELDS,
  handleOperationsRouteError,
  hydrateComplaints,
  NO_STORE_HEADERS,
} from "@/lib/operations-data";
import { formatZodErrors } from "@/lib/validators/auth";
import { workerListComplaintsQuerySchema } from "@/lib/validators/operations";
import Assignment from "@/models/Assignment";
import Complaint from "@/models/Complaint";
import RepairVerification from "@/models/RepairVerification";

/**
 * GET /api/worker/complaints
 * Returns paginated complaints whose latest Assignment belongs strictly to the
 * authenticated worker, along with worker-scoped counts and hydrated details.
 */
export async function GET(request) {
  await connection();

  try {
    const auth = await requireApiAuth("worker");
    if (auth.response) {
      return auth.response;
    }

    const rawParams = {};
    const searchParams = request.nextUrl.searchParams;
    for (const key of ["page", "limit", "status"]) {
      const value = searchParams.get(key);
      if (value !== null && value.trim() !== "") {
        rawParams[key] = value;
      }
    }

    const parsedQuery = workerListComplaintsQuerySchema.safeParse(rawParams);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters.",
          details: formatZodErrors(parsedQuery.error),
        },
        { status: 400 }
      );
    }

    const { page, limit, status } = parsedQuery.data;
    const skip = (page - 1) * limit;

    await connectDB();

    const workerObjectId = new mongoose.Types.ObjectId(auth.user.id);

    // Resolve only complaints where this worker is the CURRENT (latest) assignee.
    const latestAssignments = await Assignment.aggregate([
      { $sort: { assignedAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$complaintId",
          workerId: { $first: "$workerId" },
        },
      },
      { $match: { workerId: workerObjectId } },
    ]);

    const assignedComplaintIds = latestAssignments.map((row) => row._id);

    if (assignedComplaintIds.length === 0) {
      return NextResponse.json(
        {
          stats: {
            total: 0,
            assigned: 0,
            in_progress: 0,
            resolved: 0,
            pendingVerification: 0,
          },
          complaints: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
        { status: 200 }
      );
    }

    const filter = {
      _id: { $in: assignedComplaintIds },
      ...(status ? { status } : {}),
    };

    const [
      filteredTotal,
      complaintDocs,
      statusCounts,
      pendingVerificationCount,
    ] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .select(COMPLAINT_PUBLIC_FIELDS)
        .lean(),
      Complaint.aggregate([
        { $match: { _id: { $in: assignedComplaintIds } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      RepairVerification.countDocuments({
        complaintId: { $in: assignedComplaintIds },
        workerId: workerObjectId,
        verificationStatus: "pending",
      }),
    ]);

    const complaints = await hydrateComplaints(complaintDocs);

    const countsByStatus = Object.fromEntries(
      statusCounts.map((entry) => [entry._id, entry.count])
    );
    const totalAll = statusCounts.reduce((sum, entry) => sum + entry.count, 0);
    const totalPages =
      filteredTotal === 0 ? 0 : Math.ceil(filteredTotal / limit);

    return NextResponse.json(
      {
        stats: {
          total: totalAll,
          assigned: countsByStatus.assigned || 0,
          in_progress: countsByStatus.in_progress || 0,
          resolved: countsByStatus.resolved || 0,
          pendingVerification: pendingVerificationCount || 0,
        },
        complaints,
        pagination: {
          page,
          limit,
          total: filteredTotal,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleOperationsRouteError(error, "WorkerComplaints:GET");
  }
}
