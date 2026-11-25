import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

/**
 * Optimistically guards protected UI routes before rendering.
 * Server Components and API routes still enforce authoritative DB-backed role checks.
 *
 * @param {import("next/server").NextRequest} request
 */
export async function proxy(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
