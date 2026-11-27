import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DEFAULT_IMAGE_URL =
  "https://res.cloudinary.com/hqzepc8d/image/upload/v1795650754/roadguard/complaints/f14ogekinv0uyphkbd25.webp";
const ROBOFLOW_BASE_URL = "https://serverless.roboflow.com";
const MODEL_ID = "data_training_pothole_detection";
const MODEL_VERSION = "1";
const CONFIDENCE_THRESHOLD = 0.1;
const REQUEST_TIMEOUT_MS = 20_000;
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "scripts",
  "pothole-predictions-visualized.jpg"
);

const BOX_COLORS = [
  "#FF3B30",
  "#00E5FF",
  "#FFD60A",
  "#34C759",
  "#FF9F0A",
  "#BF5AF2",
  "#FF2D55",
  "#30D158",
];

/**
 * Loads environment variables from `.env.local` if present without printing values.
 */
function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Escapes XML special characters for safe SVG text rendering.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Validates that the target image URL is an HTTPS Cloudinary URL.
 *
 * @param {string} rawUrl
 * @returns {string}
 */
function validateImageUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  const parsed = new URL(trimmed);

  if (parsed.protocol !== "https:") {
    throw new Error("Image URL must use HTTPS.");
  }
  if (parsed.hostname.toLowerCase() !== "res.cloudinary.com") {
    throw new Error("Image URL host must be res.cloudinary.com.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Image URL must not contain credentials.");
  }

  return parsed.toString();
}

/**
 * Calls Roboflow Serverless API for real predictions at the configured threshold.
 *
 * @param {string} apiKey
 * @param {string} imageUrl
 */
async function fetchRoboflowPredictions(apiKey, imageUrl) {
  const params = new URLSearchParams({
    confidence: CONFIDENCE_THRESHOLD.toFixed(2),
    image: imageUrl,
  });

  const endpoint = `${ROBOFLOW_BASE_URL}/${MODEL_ID}/${MODEL_VERSION}?${params.toString()}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody && typeof errBody.message === "string") {
        message = `HTTP ${response.status}: ${errBody.message}`;
      }
    } catch {
      // Ignore unparseable error body.
    }
    throw new Error(`Roboflow inference failed (${message}).`);
  }

  return response.json();
}

/**
 * Downloads the original image buffer from Cloudinary.
 *
 * @param {string} imageUrl
 * @returns {Promise<Buffer>}
 */
async function downloadOriginalImage(imageUrl) {
  const response = await fetch(imageUrl, {
    method: "GET",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to download image (HTTP ${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Builds an SVG overlay matching exact image dimensions with center-to-top-left
 * bounding boxes and confidence percentage labels.
 *
 * @param {number} imgWidth
 * @param {number} imgHeight
 * @param {Array<Record<string, any>>} predictions
 * @param {number} scaleX
 * @param {number} scaleY
 * @returns {string}
 */
function buildOverlaySvg(imgWidth, imgHeight, predictions, scaleX, scaleY) {
  const strokeWidth = Math.max(3, Math.round(Math.min(imgWidth, imgHeight) / 300));
  const fontSize = Math.max(16, Math.round(Math.min(imgWidth, imgHeight) / 48));
  const labelPaddingX = Math.round(fontSize * 0.45);
  const labelHeight = Math.round(fontSize * 1.45);

  const elements = predictions.map((pred, index) => {
    const color = BOX_COLORS[index % BOX_COLORS.length];

    const centerX = Number(pred.x) * scaleX;
    const centerY = Number(pred.y) * scaleY;
    const boxWidth = Math.max(1, Number(pred.width) * scaleX);
    const boxHeight = Math.max(1, Number(pred.height) * scaleY);

    // Convert Roboflow center (x, y) to top-left corner for SVG rendering.
    const rawLeft = centerX - boxWidth / 2;
    const rawTop = centerY - boxHeight / 2;
    const left = Math.max(0, Math.min(imgWidth - 1, rawLeft));
    const top = Math.max(0, Math.min(imgHeight - 1, rawTop));
    const clampedWidth = Math.max(1, Math.min(imgWidth - left, rawLeft + boxWidth - left));
    const clampedHeight = Math.max(1, Math.min(imgHeight - top, rawTop + boxHeight - top));

    const pct = `${(Number(pred.confidence) * 100).toFixed(1)}%`;
    const className = pred.class ? String(pred.class).trim() : "Pothole";
    const labelText = `#${index + 1} ${className} ${pct}`;

    const estimatedTextWidth = Math.round(labelText.length * fontSize * 0.62);
    const badgeWidth = Math.min(
      imgWidth,
      estimatedTextWidth + labelPaddingX * 2
    );
    const badgeLeft = Math.max(0, Math.min(imgWidth - badgeWidth, left));
    const badgeTop =
      top >= labelHeight + 4
        ? top - labelHeight - 2
        : Math.min(imgHeight - labelHeight, top + 2);
    const textY = badgeTop + Math.round(labelHeight * 0.73);

    return `
      <rect
        x="${left.toFixed(1)}"
        y="${top.toFixed(1)}"
        width="${clampedWidth.toFixed(1)}"
        height="${clampedHeight.toFixed(1)}"
        fill="none"
        stroke="${color}"
        stroke-width="${strokeWidth}"
      />
      <rect
        x="${badgeLeft.toFixed(1)}"
        y="${badgeTop.toFixed(1)}"
        width="${badgeWidth}"
        height="${labelHeight}"
        rx="3"
        fill="${color}"
      />
      <text
        x="${(badgeLeft + labelPaddingX).toFixed(1)}"
        y="${textY}"
        fill="#111111"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
      >${escapeXml(labelText)}</text>
    `;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="${imgHeight}" viewBox="0 0 ${imgWidth} ${imgHeight}">${elements.join(
    "\n"
  )}</svg>`;
}

async function main() {
  loadLocalEnv();

  const apiKey = process.env.ROBOFLOW_API_KEY?.trim();
  if (!apiKey) {
    console.error("Error: ROBOFLOW_API_KEY is not set in environment or .env.local.");
    process.exitCode = 1;
    return;
  }

  let imageUrl;
  try {
    imageUrl = validateImageUrl(process.argv[2] || DEFAULT_IMAGE_URL);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Model: ${MODEL_ID}/${MODEL_VERSION}`);
  console.log(`Confidence threshold: ${CONFIDENCE_THRESHOLD.toFixed(2)}`);
  console.log(`Image URL: ${imageUrl}`);

  const [inferenceResult, originalImageBuffer] = await Promise.all([
    fetchRoboflowPredictions(apiKey, imageUrl),
    downloadOriginalImage(imageUrl),
  ]);

  const predictions = Array.isArray(inferenceResult?.predictions)
    ? inferenceResult.predictions
    : [];

  const imagePipeline = sharp(originalImageBuffer);
  const metadata = await imagePipeline.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read original image dimensions.");
  }

  const imgWidth = metadata.width;
  const imgHeight = metadata.height;

  const rfWidth = Number(inferenceResult?.image?.width) || imgWidth;
  const rfHeight = Number(inferenceResult?.image?.height) || imgHeight;
  const scaleX = imgWidth / rfWidth;
  const scaleY = imgHeight / rfHeight;

  console.log(`Original image dimensions: ${imgWidth} x ${imgHeight}`);
  console.log(`Roboflow image dimensions: ${rfWidth} x ${rfHeight}`);
  console.log(`Predictions returned: ${predictions.length}`);

  predictions.forEach((pred, index) => {
    const color = BOX_COLORS[index % BOX_COLORS.length];
    const pct = (Number(pred.confidence) * 100).toFixed(1);
    console.log(
      `  #${index + 1} [${color}] class=${pred.class} confidence=${pct}% center=(${pred.x}, ${pred.y}) size=(${pred.width}x${pred.height})`
    );
  });

  const overlaySvg = buildOverlaySvg(
    imgWidth,
    imgHeight,
    predictions,
    scaleX,
    scaleY
  );

  await imagePipeline
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(OUTPUT_PATH);

  console.log(`Saved visualization to: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Visualization failed:", error?.message || "Unknown error");
  process.exitCode = 1;
});
