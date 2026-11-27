const ROBOFLOW_INFERENCE_BASE_URL = "https://serverless.roboflow.com";
const ROBOFLOW_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.25;
const TARGET_DETECTION_CLASS = "pothole";
const CLOUDINARY_HOST = "res.cloudinary.com";
const CLOUDINARY_COMPLAINT_FOLDER_SEGMENTS = ["roadguard", "complaints"];
const ALLOWED_IMAGE_EXTENSION_REGEX = /\.(jpe?g|png|webp)$/i;
const SAFE_MODEL_SEGMENT_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Creates a coded error instance without attaching secret values.
 *
 * @param {string} message
 * @param {string} code
 * @param {number} status
 * @param {string} [name]
 */
function createRoboflowError(message, code, status, name = "RoboflowError") {
  const error = new Error(message);
  error.name = name;
  error.code = code;
  error.status = status;
  return error;
}

/**
 * Parses and validates the configured confidence threshold in [0, 1].
 *
 * @returns {number | null}
 */
function parseConfidenceThreshold() {
  const raw = process.env.ROBOFLOW_CONFIDENCE_THRESHOLD?.trim();
  if (!raw) {
    return DEFAULT_CONFIDENCE_THRESHOLD;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return null;
  }

  return parsed;
}

/**
 * Reads and validates server-only Roboflow environment configuration, returning
 * `null` when required variables are missing or invalid.
 */
function readRoboflowConfigOrNull() {
  const apiKey = process.env.ROBOFLOW_API_KEY?.trim();
  const modelId = process.env.ROBOFLOW_MODEL_ID?.trim();
  const modelVersion = process.env.ROBOFLOW_MODEL_VERSION?.trim();
  const confidenceThreshold = parseConfidenceThreshold();

  if (
    !apiKey ||
    !modelId ||
    !modelVersion ||
    !SAFE_MODEL_SEGMENT_REGEX.test(modelId) ||
    !SAFE_MODEL_SEGMENT_REGEX.test(modelVersion) ||
    confidenceThreshold === null
  ) {
    return null;
  }

  return {
    apiKey,
    modelId,
    modelVersion,
    modelName: `${modelId}/${modelVersion}`,
    confidenceThreshold,
  };
}

/**
 * Reads and validates server-only Roboflow configuration from environment variables.
 */
function getRoboflowConfig() {
  const config = readRoboflowConfigOrNull();
  if (!config) {
    throw createRoboflowError(
      "AI pothole detection service is not configured.",
      "MISSING_ROBOFLOW_CONFIG",
      503,
      "RoboflowConfigError"
    );
  }
  return config;
}

/**
 * Checks whether all required Roboflow server environment variables are configured and valid.
 *
 * @returns {boolean}
 */
export function isRoboflowConfigured() {
  return readRoboflowConfigOrNull() !== null;
}

/**
 * Validates that an image URL is a clean HTTPS Cloudinary delivery URL
 * belonging strictly to this project's `roadguard/complaints` folder.
 *
 * @param {string} imageUrl
 * @returns {string}
 */
export function validateCloudinaryComplaintImageUrl(imageUrl) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName || !SAFE_MODEL_SEGMENT_REGEX.test(cloudName)) {
    throw createRoboflowError(
      "Image storage service is not configured.",
      "MISSING_CLOUDINARY_CONFIG",
      503,
      "CloudinaryConfigError"
    );
  }

  if (typeof imageUrl !== "string") {
    throw createRoboflowError(
      "A valid Cloudinary complaint image URL is required.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  const trimmed = imageUrl.trim();
  if (!trimmed || /[\r\n\t\s]/.test(trimmed)) {
    throw createRoboflowError(
      "A valid Cloudinary complaint image URL is required.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  // Reject encoded path-traversal or separator characters before parsing.
  if (/%2e|%2f|%5c|\.\./i.test(trimmed)) {
    throw createRoboflowError(
      "Image URL contains invalid path segments.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw createRoboflowError(
      "Image URL is malformed.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  if (parsed.protocol !== "https:") {
    throw createRoboflowError(
      "Image URL must use HTTPS.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  if (parsed.username || parsed.password) {
    throw createRoboflowError(
      "Image URL must not contain credentials.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  if (parsed.port !== "" || /:\d+$/.test(parsed.host)) {
    throw createRoboflowError(
      "Image URL must not specify a custom port.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  if (parsed.hostname.toLowerCase() !== CLOUDINARY_HOST) {
    throw createRoboflowError(
      "Image URL host is not permitted.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  if (parsed.search || parsed.hash) {
    throw createRoboflowError(
      "Image URL must not contain query parameters or fragments.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  const rawSegments = parsed.pathname.split("/").filter(Boolean);
  let segments;
  try {
    segments = rawSegments.map((segment) => decodeURIComponent(segment));
  } catch {
    throw createRoboflowError(
      "Image URL path is malformed.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
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
    throw createRoboflowError(
      "Image URL contains invalid path segments.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  // Expected structure:
  // /<cloudName>/image/upload/[v<digits>/]roadguard/complaints/<filename>.<ext>
  if (
    segments.length < 6 ||
    segments[0] !== cloudName ||
    segments[1] !== "image" ||
    segments[2] !== "upload"
  ) {
    throw createRoboflowError(
      "Image URL must reference a valid Cloudinary complaint image upload.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  const hasVersionSegment = /^v\d+$/.test(segments[3]);
  const folderStartIndex = hasVersionSegment ? 4 : 3;

  if (
    segments.length !== folderStartIndex + 3 ||
    segments[folderStartIndex] !== CLOUDINARY_COMPLAINT_FOLDER_SEGMENTS[0] ||
    segments[folderStartIndex + 1] !== CLOUDINARY_COMPLAINT_FOLDER_SEGMENTS[1]
  ) {
    throw createRoboflowError(
      "Image URL must belong to the roadguard/complaints folder.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  const filename = segments[folderStartIndex + 2];
  if (!ALLOWED_IMAGE_EXTENSION_REGEX.test(filename)) {
    throw createRoboflowError(
      "Image URL must point to a JPEG, PNG, or WebP upload.",
      "INVALID_IMAGE_URL",
      400,
      "InvalidImageUrlError"
    );
  }

  return parsed.toString();
}

/**
 * Strips any unexpected credential-like keys from raw upstream response data.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeRawResult(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRawResult(item));
  }

  if (value && typeof value === "object") {
    const clean = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if (/^(api_?key|authorization|token|secret)$/i.test(key)) {
        continue;
      }
      clean[key] = sanitizeRawResult(entryValue);
    }
    return clean;
  }

  return value;
}

/**
 * Clamps a finite number to [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Validates and normalizes the Roboflow Hosted Inference JSON response
 * into the Detection schema shape without fabricating predictions.
 *
 * @param {unknown} payload
 * @param {string} modelName
 * @param {number} confidenceThreshold
 */
function normalizeRoboflowResponse(payload, modelName, confidenceThreshold) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createRoboflowError(
      "AI inference service returned an invalid response payload.",
      "ROBOFLOW_INVALID_RESPONSE",
      502,
      "RoboflowResponseError"
    );
  }

  const imageDimensions = payload.image;
  if (
    !imageDimensions ||
    typeof imageDimensions !== "object" ||
    typeof imageDimensions.width !== "number" ||
    !Number.isFinite(imageDimensions.width) ||
    imageDimensions.width <= 0 ||
    typeof imageDimensions.height !== "number" ||
    !Number.isFinite(imageDimensions.height) ||
    imageDimensions.height <= 0
  ) {
    throw createRoboflowError(
      "AI inference service returned invalid image dimensions.",
      "ROBOFLOW_INVALID_RESPONSE",
      502,
      "RoboflowResponseError"
    );
  }

  if (!Array.isArray(payload.predictions)) {
    throw createRoboflowError(
      "AI inference service returned an invalid predictions list.",
      "ROBOFLOW_INVALID_RESPONSE",
      502,
      "RoboflowResponseError"
    );
  }

  const boundingBoxes = [];

  for (const prediction of payload.predictions) {
    if (!prediction || typeof prediction !== "object" || Array.isArray(prediction)) {
      throw createRoboflowError(
        "AI inference service returned a malformed prediction entry.",
        "ROBOFLOW_INVALID_RESPONSE",
        502,
        "RoboflowResponseError"
      );
    }

    const { x, y, width, height, confidence, class: rawClass } = prediction;

    if (
      typeof x !== "number" ||
      !Number.isFinite(x) ||
      typeof y !== "number" ||
      !Number.isFinite(y) ||
      typeof width !== "number" ||
      !Number.isFinite(width) ||
      typeof height !== "number" ||
      !Number.isFinite(height) ||
      typeof confidence !== "number" ||
      !Number.isFinite(confidence) ||
      typeof rawClass !== "string" ||
      !rawClass.trim()
    ) {
      throw createRoboflowError(
        "AI inference service returned invalid prediction values.",
        "ROBOFLOW_INVALID_RESPONSE",
        502,
        "RoboflowResponseError"
      );
    }

    const normalizedConfidence = clamp(confidence, 0, 1);
    const trimmedClass = rawClass.trim().slice(0, 100);

    const normalizedClass = trimmedClass.toLowerCase().replace(/[^a-z]/g, "");
    if (
      !normalizedClass.includes("pothole") ||
      normalizedConfidence < confidenceThreshold
    ) {
      continue;
    }

    // Store Roboflow's center x/y coordinates directly and enforce non-negative bounds.
    boundingBoxes.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.max(0, width),
      height: Math.max(0, height),
      confidence: normalizedConfidence,
      class: trimmedClass,
    });
  }

  const detected = boundingBoxes.length > 0;
  const maxConfidence = detected
    ? boundingBoxes.reduce(
        (highest, box) => (box.confidence > highest ? box.confidence : highest),
        0
      )
    : 0;

  return {
    detected,
    confidence: maxConfidence,
    boundingBoxes,
    modelName,
    rawResult: sanitizeRawResult(payload),
  };
}

/**
 * Runs real pothole detection via Roboflow Hosted Inference on a validated
 * Cloudinary complaint image URL.
 *
 * @param {string} imageUrl
 * @returns {Promise<{
 *   detected: boolean,
 *   confidence: number,
 *   boundingBoxes: Array<{
 *     x: number,
 *     y: number,
 *     width: number,
 *     height: number,
 *     confidence: number,
 *     class: string,
 *   }>,
 *   modelName: string,
 *   rawResult: unknown,
 * }>}
 */
export async function detectPotholesFromImageUrl(imageUrl) {
  const { apiKey, modelId, modelVersion, modelName, confidenceThreshold } =
    getRoboflowConfig();

  const validatedImageUrl = validateCloudinaryComplaintImageUrl(imageUrl);

  const queryParams = new URLSearchParams({
    confidence: String(confidenceThreshold),
    image: validatedImageUrl,
  });

  const endpointUrl = `${ROBOFLOW_INFERENCE_BASE_URL}/${encodeURIComponent(
    modelId
  )}/${encodeURIComponent(modelVersion)}?${queryParams.toString()}`;

  let response;
  try {
    response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(ROBOFLOW_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw createRoboflowError(
        "AI pothole detection request timed out.",
        "ROBOFLOW_TIMEOUT",
        504,
        "RoboflowTimeoutError"
      );
    }

    throw createRoboflowError(
      "Unable to reach AI pothole detection service.",
      "ROBOFLOW_UPSTREAM_ERROR",
      502,
      "RoboflowNetworkError"
    );
  }

  if (!response.ok) {
    throw createRoboflowError(
      "AI pothole detection service returned an error.",
      "ROBOFLOW_UPSTREAM_ERROR",
      502,
      "RoboflowUpstreamError"
    );
  }

  let parsedBody;
  try {
    parsedBody = await response.json();
  } catch {
    throw createRoboflowError(
      "AI pothole detection service returned malformed JSON.",
      "ROBOFLOW_INVALID_RESPONSE",
      502,
      "RoboflowResponseError"
    );
  }

  return normalizeRoboflowResponse(parsedBody, modelName, confidenceThreshold);
}
