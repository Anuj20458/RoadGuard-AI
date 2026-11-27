const INDIA_TIMEZONE = "Asia/Kolkata";

/**
 * Formats an ISO date or Date value as DD MMM YYYY in Asia/Kolkata (IST).
 *
 * @param {string | Date | null | undefined} value
 */
export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: INDIA_TIMEZONE,
  });
}

/**
 * Formats an ISO date or Date value with date and IST time in Asia/Kolkata.
 *
 * @param {string | Date | null | undefined} value
 */
export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const formatted = date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: INDIA_TIMEZONE,
  });
  return `${formatted} IST`;
}

/**
 * Formats a complaint location into an Indian address string or coordinate label,
 * preserving legacy records that only have `address` or GPS coordinates.
 *
 * @param {{
 *   address?: string,
 *   ward?: string,
 *   city?: string,
 *   district?: string,
 *   state?: string,
 *   pinCode?: string,
 *   country?: string,
 *   latitude?: number | null,
 *   longitude?: number | null,
 * } | null | undefined} location
 */
export function formatLocation(location) {
  if (!location) return "Coordinates pending";

  const localityParts = [
    location.address,
    location.ward,
    location.city,
    location.district,
    location.state,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);

  const pin = typeof location.pinCode === "string" ? location.pinCode.trim() : "";
  if (localityParts.length > 0) {
    const base = localityParts.join(", ");
    return pin ? `${base} - ${pin}` : base;
  }

  if (pin) {
    return `PIN ${pin}`;
  }

  if (
    typeof location.latitude === "number" &&
    typeof location.longitude === "number"
  ) {
    return `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`;
  }

  return "Coordinates pending";
}

/**
 * Formats an Indian Rupee (INR) monetary amount when provided.
 *
 * @param {number | null | undefined} amount
 */
export function formatINR(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "₹0";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/**
 * Formats a [0, 1] confidence score as a whole percentage string.
 *
 * @param {number | null | undefined} confidence
 */
export function formatConfidencePercent(confidence) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return "0%";
  }
  return `${Math.round(Math.min(1, Math.max(0, confidence)) * 100)}%`;
}

/**
 * Builds a safe external OpenStreetMap URL for complaint coordinates, or null.
 *
 * @param {{ latitude?: number | null, longitude?: number | null } | null | undefined} location
 */
export function getExternalMapUrl(location) {
  if (
    typeof location?.latitude !== "number" ||
    typeof location?.longitude !== "number" ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return null;
  }

  const lat = location.latitude.toFixed(6);
  const lng = location.longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/**
 * Returns the default home route path for an authenticated user role.
 *
 * @param {string | null | undefined} role
 */
export function getRoleHomePath(role) {
  if (role === "admin") return "/admin";
  if (role === "worker") return "/worker";
  return "/dashboard";
}
