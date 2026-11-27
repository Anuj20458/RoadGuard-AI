import { NextResponse } from "next/server";

export const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

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
export function detectImageSignature(buffer) {
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
 * Validates a multipart/form-data single-image upload request and returns the
 * validated Buffer or a ready-to-return NextResponse error.
 *
 * @param {Request} request
 * @returns {Promise<{ buffer: Buffer, errorResponse: null } | { buffer: null, errorResponse: NextResponse }>}
 */
export async function parseAndValidateImageUpload(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "Request must use multipart/form-data." },
        { status: 400 }
      ),
    };
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_UPLOAD_IMAGE_BYTES + 256 * 1024
    ) {
      return {
        buffer: null,
        errorResponse: NextResponse.json(
          { error: "Image file size cannot exceed 5 MB." },
          { status: 413 }
        ),
      };
    }
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "Unable to parse multipart form data." },
        { status: 400 }
      ),
    };
  }

  const imageEntries = formData.getAll("image");
  if (imageEntries.length === 0) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "An image file in the 'image' field is required." },
        { status: 400 }
      ),
    };
  }

  if (imageEntries.length > 1) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "Only one image file may be uploaded per request." },
        { status: 400 }
      ),
    };
  }

  const file = imageEntries[0];
  if (
    !file ||
    typeof file === "string" ||
    typeof file.arrayBuffer !== "function"
  ) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "Invalid image upload payload." },
        { status: 400 }
      ),
    };
  }

  if (file.size <= 0) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "Uploaded image file is empty." },
        { status: 400 }
      ),
    };
  }

  if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "Image file size cannot exceed 5 MB." },
        { status: 413 }
      ),
    };
  }

  const declaredMime = (file.type || "").trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(declaredMime)) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed." },
        { status: 415 }
      ),
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "Uploaded image file is empty." },
        { status: 400 }
      ),
    };
  }

  if (buffer.length > MAX_UPLOAD_IMAGE_BYTES) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "Image file size cannot exceed 5 MB." },
        { status: 413 }
      ),
    };
  }

  const detectedSignature = detectImageSignature(buffer);
  if (!detectedSignature || detectedSignature !== declaredMime) {
    return {
      buffer: null,
      errorResponse: NextResponse.json(
        { error: "File content does not match a valid JPEG, PNG, or WebP image." },
        { status: 415 }
      ),
    };
  }

  return { buffer, errorResponse: null };
}
