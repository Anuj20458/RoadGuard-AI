import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import {
  createAuthSessionResponse,
  handleAuthRouteError,
} from "@/lib/auth";
import { formatZodErrors, loginSchema } from "@/lib/validators/auth";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

/**
 * POST /api/auth/login
 * Authenticates a user by email and password and issues an HTTP-only session cookie.
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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: formatZodErrors(parsed.error),
      },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  try {
    await connectDB();

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) {
      return NextResponse.json(
        { error: INVALID_CREDENTIALS_MESSAGE },
        { status: 401 }
      );
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: INVALID_CREDENTIALS_MESSAGE },
        { status: 401 }
      );
    }

    return await createAuthSessionResponse(user, 200);
  } catch (error) {
    return handleAuthRouteError(error, "login");
  }
}
