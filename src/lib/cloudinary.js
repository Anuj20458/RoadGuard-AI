import { v2 as cloudinary } from "cloudinary";

export const COMPLAINT_UPLOAD_FOLDER = "roadguard/complaints";
export const REPAIR_UPLOAD_FOLDER = "roadguard/repairs";

/**
 * Checks whether all required Cloudinary server environment variables are set.
 *
 * @returns {boolean}
 */
export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

/**
 * Configures the Cloudinary v2 SDK using server-only environment variables.
 * Throws a coded error without leaking secret values when configuration is missing.
 */
function ensureCloudinaryConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error("Cloudinary configuration is missing.");
    error.code = "MISSING_CLOUDINARY_CONFIG";
    throw error;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

/**
 * Uploads a validated image buffer to Cloudinary under the specified folder.
 *
 * @param {Buffer} imageBuffer
 * @param {string} folder
 * @param {Record<string, unknown>} [options]
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export async function uploadRoadGuardImage(imageBuffer, folder, options = {}) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("A non-empty image buffer is required.");
  }

  ensureCloudinaryConfigured();

  const uploadOptions = {
    ...options,
    folder,
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    use_filename: false,
    unique_filename: true,
    overwrite: false,
  };

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          const uploadError = new Error("Cloudinary upload failed.");
          uploadError.name = "CloudinaryUploadError";
          uploadError.httpCode = error.http_code || 502;
          reject(uploadError);
          return;
        }

        if (!result?.secure_url || !result?.public_id) {
          const invalidResultError = new Error(
            "Cloudinary upload did not return expected asset details."
          );
          invalidResultError.name = "CloudinaryResponseError";
          reject(invalidResultError);
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(imageBuffer);
  });
}

/**
 * Uploads a validated complaint image buffer to Cloudinary under the
 * dedicated `roadguard/complaints` folder.
 *
 * @param {Buffer} imageBuffer
 * @param {Record<string, unknown>} [options]
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export async function uploadComplaintImage(imageBuffer, options = {}) {
  return uploadRoadGuardImage(imageBuffer, COMPLAINT_UPLOAD_FOLDER, options);
}

/**
 * Uploads a validated after-repair image buffer to Cloudinary under the
 * dedicated `roadguard/repairs` folder.
 *
 * @param {Buffer} imageBuffer
 * @param {Record<string, unknown>} [options]
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export async function uploadRepairImage(imageBuffer, options = {}) {
  return uploadRoadGuardImage(imageBuffer, REPAIR_UPLOAD_FOLDER, options);
}

/**
 * Validates that an image URL is a clean HTTPS Cloudinary delivery URL
 * belonging strictly to the specified `roadguard/<folder>` path segments.
 *
 * @param {string} imageUrl
 * @param {[string, string]} [folderSegments]
 * @returns {string}
 */
export function validateCloudinaryFolderImageUrl(
  imageUrl,
  folderSegments = ["roadguard", "complaints"]
) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName)) {
    const err = new Error("Image storage service is not configured.");
    err.name = "CloudinaryConfigError";
    err.code = "MISSING_CLOUDINARY_CONFIG";
    err.status = 503;
    throw err;
  }

  const makeUrlError = (message) => {
    const err = new Error(message);
    err.name = "InvalidImageUrlError";
    err.code = "INVALID_IMAGE_URL";
    err.status = 400;
    return err;
  };

  if (typeof imageUrl !== "string") {
    throw makeUrlError("A valid Cloudinary image URL is required.");
  }

  const trimmed = imageUrl.trim();
  if (!trimmed || /[\r\n\t\s]/.test(trimmed)) {
    throw makeUrlError("A valid Cloudinary image URL is required.");
  }

  if (/%2e|%2f|%5c|\.\./i.test(trimmed)) {
    throw makeUrlError("Image URL contains invalid path segments.");
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw makeUrlError("Image URL is malformed.");
  }

  if (parsed.protocol !== "https:") {
    throw makeUrlError("Image URL must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw makeUrlError("Image URL must not contain credentials.");
  }
  if (parsed.port !== "" || /:\d+$/.test(parsed.host)) {
    throw makeUrlError("Image URL must not specify a custom port.");
  }
  if (parsed.hostname.toLowerCase() !== "res.cloudinary.com") {
    throw makeUrlError("Image URL host is not permitted.");
  }
  if (parsed.search || parsed.hash) {
    throw makeUrlError("Image URL must not contain query parameters or fragments.");
  }

  const rawSegments = parsed.pathname.split("/").filter(Boolean);
  let segments;
  try {
    segments = rawSegments.map((segment) => decodeURIComponent(segment));
  } catch {
    throw makeUrlError("Image URL path is malformed.");
  }

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\")
    )
  ) {
    throw makeUrlError("Image URL contains invalid path segments.");
  }

  if (
    segments.length < 6 ||
    segments[0] !== cloudName ||
    segments[1] !== "image" ||
    segments[2] !== "upload"
  ) {
    throw makeUrlError(
      "Image URL must reference a valid Cloudinary image upload."
    );
  }

  const hasVersionSegment = /^v\d+$/.test(segments[3]);
  const folderStartIndex = hasVersionSegment ? 4 : 3;

  if (
    segments.length !== folderStartIndex + 3 ||
    segments[folderStartIndex] !== folderSegments[0] ||
    segments[folderStartIndex + 1] !== folderSegments[1]
  ) {
    throw makeUrlError(
      `Image URL must belong to the ${folderSegments.join("/")} folder.`
    );
  }

  const filename = segments[folderStartIndex + 2];
  if (!/\.(jpe?g|png|webp)$/i.test(filename)) {
    throw makeUrlError("Image URL must point to a JPEG, PNG, or WebP upload.");
  }

  return parsed.toString();
}
