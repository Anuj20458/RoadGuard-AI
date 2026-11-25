import { connection, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

/**
 * GET /api/health
 * Verifies that the application can connect to and ping MongoDB.
 */
export async function GET() {
  // Ensure this health check always runs per request and is never prerendered at build time.
  await connection();

  try {
    const conn = await connectDB();

    if (!conn.connection?.db) {
      throw new Error("Database handle is unavailable.");
    }

    await conn.connection.db.admin().ping();

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        readyState: conn.connection.readyState,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const isMissingConfig = error?.code === "MISSING_MONGODB_URI";

    // Log only the error category/name so credentials or URIs are never printed.
    console.error(
      "[Health Check] MongoDB check failed:",
      isMissingConfig ? "MISSING_MONGODB_URI" : error?.name || "ConnectionError"
    );

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        message: isMissingConfig
          ? "Database configuration is missing."
          : "Unable to connect to MongoDB.",
        timestamp: new Date().toISOString(),
      },
      { status: isMissingConfig ? 500 : 503 }
    );
  }
}
