import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import {
  createAuthSessionResponse,
  handleAuthRouteError,
} from "@/lib/auth";
import { formatZodErrors, registerSchema } from "@/lib/validators/auth";

/**
 * POST /api/auth/register
 * Registers a new citizen account and issues an HTTP-only session cookie.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = registerSchema.safeParse(body);
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

  try {
    await connectDB();

    const existingUser = await User.findOne({ email }).select("_id").lean();
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Public registration is strictly restricted to the "citizen" role.
    const newUser = await User.create({
      name,
      email,
      passwordHash: password,
      role: "citizen",
      ...(phone ? { phone } : {}),
    });

    return await createAuthSessionResponse(newUser, 201);
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    return handleAuthRouteError(error, "register");
  }
}
