import { connection, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import {
  isCloudinaryConfigured,
  uploadComplaintImage,
} from "@/lib/cloudinary";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * Detects an image format strictly from binary file signatures (magic bytes).
 *
 * @param {Buffer} buffer
 * @returns {"image/jpeg" | "image/png" | "image/webp" | null}
 */
function detectImageSignature(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return null;
  }

  // JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" <4-byte size> "WEBP"
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * POST /api/citizen/upload
 * Validates and uploads a single citizen complaint image (JPEG, PNG, or WebP, max 5 MB)
 * to Cloudinary under `roadguard/complaints`.
 */
export async function POST(request) {
  await connection();

  try {
    const auth = await requireApiAuth("citizen");
    if (auth.response) {
      return auth.response;
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Image upload service is not configured." },
        { status: 503 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Request must use multipart/form-data." },
        { status: 400 }
      );
    }

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES + 256 * 1024) {
        return NextResponse.json(
          { error: "Image file size cannot exceed 5 MB." },
          { status: 413 }
        );
      }
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Unable to parse multipart form data." },
        { status: 400 }
      );
    }

    const imageEntries = formData.getAll("image");
    if (imageEntries.length === 0) {
      return NextResponse.json(
        { error: "An image file in the 'image' field is required." },
        { status: 400 }
      );
    }

    if (imageEntries.length > 1) {
      return NextResponse.json(
        { error: "Only one image file may be uploaded per request." },
        { status: 400 }
      );
    }

    const file = imageEntries[0];
    if (
      !file ||
      typeof file === "string" ||
      typeof file.arrayBuffer !== "function"
    ) {
      return NextResponse.json(
        { error: "Invalid image upload payload." },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Uploaded image file is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image file size cannot exceed 5 MB." },
        { status: 413 }
      );
    }

    const declaredMime = (file.type || "").trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(declaredMime)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "Uploaded image file is empty." },
        { status: 400 }
      );
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image file size cannot exceed 5 MB." },
        { status: 413 }
      );
    }

    const detectedSignature = detectImageSignature(buffer);
    if (!detectedSignature || detectedSignature !== declaredMime) {
      return NextResponse.json(
        { error: "File content does not match a valid JPEG, PNG, or WebP image." },
        { status: 415 }
      );
    }

    const uploaded = await uploadComplaintImage(buffer);

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
      console.error("[CitizenUpload] Configuration error:", error.code);
      return NextResponse.json(
        { error: "Authentication service is not configured." },
        { status: 500 }
      );
    }

    console.error(
      "[CitizenUpload] Upload failed:",
      error?.name || "UploadError"
    );
    return NextResponse.json(
      { error: "Unable to upload image right now. Please try again later." },
      { status: 502 }
    );
  }
}
