import { connection, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import {
  isCloudinaryConfigured,
  uploadRepairImage,
} from "@/lib/cloudinary";
import { parseAndValidateImageUpload } from "@/lib/upload-validation";

/**
 * POST /api/worker/upload
 * Validates and uploads a single after-repair evidence image (JPEG, PNG, or WebP, max 5 MB)
 * to Cloudinary under `roadguard/repairs` for authenticated field workers.
 */
export async function POST(request) {
  await connection();

  try {
    const auth = await requireApiAuth("worker");
    if (auth.response) {
      return auth.response;
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Image upload service is not configured." },
        { status: 503 }
      );
    }

    const { buffer, errorResponse } = await parseAndValidateImageUpload(request);
    if (errorResponse) {
      return errorResponse;
    }

    const uploaded = await uploadRepairImage(buffer);

    return NextResponse.json(
      {
        imageUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.code === "MISSING_CLOUDINARY_CONFIG") {
      return NextResponse.json(
        { error: "Image upload service is not configured." },
        { status: 503 }
      );
    }

    if (
      error?.code === "MISSING_AUTH_SECRET" ||
      error?.code === "MISSING_MONGODB_URI"
    ) {
      console.error("[WorkerUpload] Configuration error:", error.code);
      return NextResponse.json(
        { error: "Authentication service is not configured." },
        { status: 500 }
      );
    }

    console.error("[WorkerUpload] Upload failed:", error?.name || "UploadError");
    return NextResponse.json(
      { error: "Unable to upload repair image right now. Please try again later." },
      { status: 502 }
    );
  }
}
