import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "roadguard_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const VALID_ROLES = ["citizen", "admin", "worker"];

/**
 * Reads the JWT signing secret from the environment as a Uint8Array.
 * Throws a tagged error if missing so callers can fail safely without leaking secrets.
 *
 * @returns {Uint8Array}
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length < 16) {
    const error = new Error(
      "JWT_SECRET environment variable must be configured with at least 16 characters."
    );
    error.code = "MISSING_AUTH_SECRET";
    throw error;
  }

  return new TextEncoder().encode(secret);
}

/**
 * Builds consistent cookie attributes for the HTTP-only session cookie.
 *
 * @param {number} [maxAge]
 */
export function getSessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

/**
 * Signs a minimal JWT session token containing user ID and role.
 *
 * @param {{ _id?: unknown, id?: string, role: string }} user
 * @returns {Promise<string>}
 */
export async function signSessionToken(user) {
  const userId = String(user._id ?? user.id);

  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret());
}

/**
 * Verifies a signed JWT session token and returns its payload or null.
 *
 * @param {string | undefined} token
 * @returns {Promise<{ userId: string, role: string } | null>}
 */
export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.role !== "string" ||
      !VALID_ROLES.includes(payload.role)
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Attaches the signed session cookie to an outgoing NextResponse.
 *
 * @param {import("next/server").NextResponse} response
 * @param {string} token
 */
export function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

/**
 * Clears the session cookie on an outgoing NextResponse.
 *
 * @param {import("next/server").NextResponse} response
 */
export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(0),
    expires: new Date(0),
  });
}
