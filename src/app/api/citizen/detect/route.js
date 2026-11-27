import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth";
import { formatZodErrors } from "@/lib/validators/auth";
import {
  detectPotholesFromImageUrl,
  isRoboflowConfigured,
} from "@/lib/roboflow";

const detectRequestSchema = z.strictObject({
  imageUrl: z
    .string({ error: "Image URL is required." })
    .trim()
    .min(1, "Image URL is required.")
    .max(2048, "Image URL cannot exceed 2048 characters."),
});

/**
 * POST /api/citizen/detect
 * Runs real-time pothole detection via Roboflow Hosted Inference against
 * a validated Cloudinary complaint image URL for an authenticated citizen.
 */
export async function POST(request) {
  await connection();

  try {
    const auth = await requireApiAuth("citizen");
    if (auth.response) {
      return auth.response;
    }

    if (!isRoboflowConfigured()) {
      return NextResponse.json(
        { error: "AI pothole detection service is not configured." },
        { status: 503 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsed = detectRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: formatZodErrors(parsed.error),
        },
        { status: 400 }
      );
    }

    const detectionResult = await detectPotholesFromImageUrl(
      parsed.data.imageUrl
    );

    return NextResponse.json(detectionResult, { status: 200 });
  } catch (error) {
    if (
      error?.code === "MISSING_ROBOFLOW_CONFIG" ||
      error?.code === "MISSING_CLOUDINARY_CONFIG"
    ) {
      return NextResponse.json(
        { error: "AI pothole detection service is not configured." },
        { status: 503 }
      );
    }

    if (error?.code === "INVALID_IMAGE_URL") {
      return NextResponse.json(
        { error: error.message || "Invalid Cloudinary image URL." },
        { status: 400 }
      );
    }

    if (error?.code === "ROBOFLOW_TIMEOUT") {
      return NextResponse.json(
        { error: "AI pothole detection timed out. Please try again." },
        { status: 504 }
      );
    }

    if (
      error?.code === "ROBOFLOW_UPSTREAM_ERROR" ||
      error?.code === "ROBOFLOW_INVALID_RESPONSE"
    ) {
      console.error(
        "[CitizenDetect] Upstream failure:",
        error.code || error.name || "RoboflowError"
      );
      return NextResponse.json(
        {
          error:
            "Unable to analyze the image right now. Please try again later.",
        },
        { status: 502 }
      );
    }

    if (
      error?.code === "MISSING_AUTH_SECRET" ||
      error?.code === "MISSING_MONGODB_URI"
    ) {
      console.error("[CitizenDetect] Configuration error:", error.code);
      return NextResponse.json(
        { error: "Authentication service is not configured." },
        { status: 500 }
      );
    }

    console.error(
      "[CitizenDetect] Unexpected failure:",
      error?.name || "DetectError"
    );
    return NextResponse.json(
      { error: "Unable to analyze the image right now. Please try again later." },
      { status: 500 }
    );
  }
}
