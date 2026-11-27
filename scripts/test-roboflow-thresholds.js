import fs from "node:fs";
import path from "node:path";

const ROBOFLOW_BASE_URL = "https://serverless.roboflow.com";
const MODEL_ID = "data_training_pothole_detection";
const MODEL_VERSION = "1";
const THRESHOLDS = [0.4, 0.25, 0.1];
const REQUEST_TIMEOUT_MS = 20_000;

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
 * Validates the CLI Cloudinary image URL argument.
 *
 * @param {string | undefined} rawUrl
 * @returns {string}
 */
function validateInputUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error(
      "Missing image URL argument. Usage: node scripts/test-roboflow-thresholds.js <cloudinary-image-url>"
    );
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Provided image URL is not a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Provided image URL must use HTTPS.");
  }

  if (parsed.hostname.toLowerCase() !== "res.cloudinary.com") {
    throw new Error("Provided image URL host must be res.cloudinary.com.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Provided image URL must not contain credentials.");
  }

  return parsed.toString();
}

/**
 * Calls Roboflow Serverless API for a single confidence threshold.
 *
 * @param {string} apiKey
 * @param {string} imageUrl
 * @param {number} threshold
 */
async function runInferenceAtThreshold(apiKey, imageUrl, threshold) {
  const params = new URLSearchParams({
    confidence: threshold.toFixed(2),
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
      // Ignore unparseable upstream error payloads.
    }
    throw new Error(`Roboflow request failed (${message}).`);
  }

  return response.json();
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
    imageUrl = validateInputUrl(process.argv[2]);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Model: ${MODEL_ID}/${MODEL_VERSION}`);
  console.log(`Image URL: ${imageUrl}`);
  console.log(`Thresholds: ${THRESHOLDS.map((t) => t.toFixed(2)).join(", ")}`);
  console.log("---");

  for (const threshold of THRESHOLDS) {
    const label = threshold.toFixed(2);
    console.log(`\n[Confidence Threshold: ${label}]`);

    try {
      const result = await runInferenceAtThreshold(apiKey, imageUrl, threshold);
      const predictions = Array.isArray(result?.predictions)
        ? result.predictions
        : [];
      const width = result?.image?.width ?? "?";
      const height = result?.image?.height ?? "?";

      console.log(`Image dimensions: ${width} x ${height}`);
      console.log(`Prediction count: ${predictions.length}`);

      if (predictions.length === 0) {
        console.log("  (no predictions)");
        continue;
      }

      predictions.forEach((pred, index) => {
        console.log(
          `  #${index + 1} class=${pred?.class ?? "unknown"} confidence=${
            pred?.confidence ?? "N/A"
          } x=${pred?.x ?? "N/A"} y=${pred?.y ?? "N/A"} width=${
            pred?.width ?? "N/A"
          } height=${pred?.height ?? "N/A"}`
        );
      });
    } catch (error) {
      const reason =
        error?.name === "TimeoutError" || error?.name === "AbortError"
          ? "Request timed out after 20s."
          : error?.message || "Unknown error.";
      console.error(`  Failed at threshold ${label}: ${reason}`);
      process.exitCode = 1;
    }
  }
}

main();
