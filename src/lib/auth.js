import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getSessionCookieOptions,
  signSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
} from "@/lib/session";

export {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getSessionCookieOptions,
  signSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
};

/**
 * Strips sensitive fields and returns a safe user profile object.
 *
 * @param {Record<string, any>} user
 */
export function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id ?? user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    createdAt: user.createdAt,
  };
}

/**
 * Creates an authenticated JSON response with the HTTP-only session cookie set.
 * Never includes passwordHash or the raw JWT token in the JSON body.
 *
 * @param {Record<string, any>} user
 * @param {number} [status]
 */
export async function createAuthSessionResponse(user, status = 200) {
  const token = await signSessionToken(user);
  const response = NextResponse.json({ user: serializeUser(user) }, { status });
  setSessionCookie(response, token);
  return response;
}

/**
 * Reads and verifies the session cookie from the current Next.js request.
 *
 * @returns {Promise<{ userId: string, role: string } | null>}
 */
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/**
 * Loads the currently authenticated user's safe profile from MongoDB.
 * Returns null if unauthenticated or if the user record no longer exists.
 */
export async function getAuthenticatedUser() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  await connectDB();
  const user = await User.findById(session.userId).lean();
  return serializeUser(user);
}

/**
 * Checks whether a user object has one of the allowed roles.
 *
 * @param {{ role?: string } | null} user
 * @param {string | string[]} allowedRoles
 */
export function hasRole(user, allowedRoles) {
  if (!user?.role) {
    return false;
  }
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(user.role);
}

/**
 * Server-side authorization helper for Server Components, Actions, and Route Handlers.
 * Always verifies the live user and role from MongoDB rather than trusting client data.
 *
 * @param {string | string[]} [allowedRoles]
 */
export async function requireAuth(allowedRoles = []) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required.",
      user: null,
    };
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (roles.length > 0 && !roles.includes(user.role)) {
    return {
      ok: false,
      status: 403,
      error: "You do not have permission to perform this action.",
      user: null,
    };
  }

  return {
    ok: true,
    status: 200,
    error: null,
    user,
  };
}

export const requireRole = requireAuth;

/**
 * Convenience helper for API Route Handlers that returns either `{ user }`
 * or `{ response }` ready to be returned directly.
 *
 * @param {string | string[]} [allowedRoles]
 */
export async function requireApiAuth(allowedRoles = []) {
  const result = await requireAuth(allowedRoles);

  if (!result.ok) {
    return {
      user: null,
      response: NextResponse.json(
        { error: result.error },
        { status: result.status }
      ),
    };
  }

  return {
    user: result.user,
    response: null,
  };
}

/**
 * Maps unexpected auth route errors to safe HTTP responses without leaking secrets.
 *
 * @param {unknown} error
 * @param {string} routeLabel
 */
export function handleAuthRouteError(error, routeLabel) {
  const err = /** @type {{ code?: string | number, name?: string }} */ (error);

  if (err?.code === "MISSING_AUTH_SECRET" || err?.code === "MISSING_MONGODB_URI") {
    console.error(`[Auth:${routeLabel}] Configuration error:`, err.code);
    return NextResponse.json(
      { error: "Authentication service is not configured." },
      { status: 500 }
    );
  }

  console.error(`[Auth:${routeLabel}] Unexpected error:`, err?.name || "Error");
  return NextResponse.json(
    { error: "Something went wrong. Please try again later." },
    { status: 500 }
  );
}
