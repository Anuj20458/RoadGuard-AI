import { connection, NextResponse } from "next/server";
import { handleAuthRouteError, requireApiAuth } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's safe profile (without passwordHash).
 */
export async function GET() {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (auth.response) {
      return auth.response;
    }

    return NextResponse.json({ user: auth.user }, { status: 200 });
  } catch (error) {
    return handleAuthRouteError(error, "me");
  }
}
