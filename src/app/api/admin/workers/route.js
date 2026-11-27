import { connection, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  handleOperationsRouteError,
  listWorkersWithLoad,
  NO_STORE_HEADERS,
  parseJsonBody,
} from "@/lib/operations-data";
import { formatZodErrors } from "@/lib/validators/auth";
import { adminCreateWorkerSchema } from "@/lib/validators/operations";
import User from "@/models/User";

/**
 * GET /api/admin/workers
 * Lists all real worker accounts with their current active assignment count.
 */
export async function GET() {
  await connection();

  try {
    const auth = await requireApiAuth("admin");
    if (auth.response) {
      return auth.response;
    }

    await connectDB();
    const workers = await listWorkersWithLoad();

    return NextResponse.json(
      { workers },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleOperationsRouteError(error, "AdminWorkers:GET");
  }
}

/**
 * POST /api/admin/workers
 * Admin-only endpoint to create a field worker account securely.
 * Enforces role="worker" server-side and never allows public role selection.
 */
export async function POST(request) {
  await connection();

  try {
    const auth = await requireApiAuth("admin");
    if (auth.response) {
      return auth.response;
    }

    const { data: body, errorResponse } = await parseJsonBody(request);
    if (errorResponse) {
      return errorResponse;
    }

    const parsed = adminCreateWorkerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: formatZodErrors(parsed.error),
        },
        { status: 400 }
      );
    }

    const { name, email, password, phone } = parsed.data;

    await connectDB();

    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const workerUser = await User.create({
      name,
      email,
      passwordHash: password,
      role: "worker",
      ...(phone ? { phone } : {}),
    });

    const workers = await listWorkersWithLoad();

    return NextResponse.json(
      {
        worker: {
          id: String(workerUser._id),
          name: workerUser.name,
          email: workerUser.email,
          phone: workerUser.phone || "",
          createdAt: workerUser.createdAt,
          activeAssignments: 0,
        },
        workers,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleOperationsRouteError(error, "AdminWorkers:POST");
  }
}
