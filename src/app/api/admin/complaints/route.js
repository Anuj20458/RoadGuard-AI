import { connection, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  COMPLAINT_PUBLIC_FIELDS,
  getAdminDashboardStats,
  handleOperationsRouteError,
  hydrateComplaints,
  listWorkersWithLoad,
  NO_STORE_HEADERS,
} from "@/lib/operations-data";
import { formatZodErrors } from "@/lib/validators/auth";
import { adminListComplaintsQuerySchema } from "@/lib/validators/operations";
import Complaint from "@/models/Complaint";

/**
 * GET /api/admin/complaints
 * Returns paginated complaints across all citizens with status/priority filters,
 * hydrated AI detections, assignments, repair verifications, status histories,
 * overall statistics, and available worker accounts.
 */
export async function GET(request) {
  await connection();

  try {
    const auth = await requireApiAuth("admin");
    if (auth.response) {
      return auth.response;
    }

    const rawParams = {};
    const searchParams = request.nextUrl.searchParams;
    for (const key of ["page", "limit", "status", "priority"]) {
      const value = searchParams.get(key);
      if (value !== null && value.trim() !== "") {
        rawParams[key] = value;
      }
    }

    const parsedQuery = adminListComplaintsQuerySchema.safeParse(rawParams);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters.",
          details: formatZodErrors(parsedQuery.error),
        },
        { status: 400 }
      );
    }

    const { page, limit, status, priority } = parsedQuery.data;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    await connectDB();

    const [filteredTotal, complaintDocs, stats, workers] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .select(COMPLAINT_PUBLIC_FIELDS)
        .lean(),
      getAdminDashboardStats(),
      listWorkersWithLoad(),
    ]);

    const complaints = await hydrateComplaints(complaintDocs);

    const totalPages =
      filteredTotal === 0 ? 0 : Math.ceil(filteredTotal / limit);

    return NextResponse.json(
      {
        stats,
        complaints,
        workers,
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
    return handleOperationsRouteError(error, "AdminComplaints:GET");
  }
}
