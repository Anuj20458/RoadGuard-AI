/**
 * India-specific geographic, administrative, and road-classification reference data
 * for RoadGuard AI. All administrative and road categories are configurable local
 * metadata and do not imply live integration with any government portal.
 */

export const DEFAULT_COUNTRY = "India";

export const DEFAULT_INDIA_MAP_CENTER = {
  latitude: 31.326,
  longitude: 75.5762,
  label: "Jalandhar, Punjab",
  zoom: 13,
};

export const INDIAN_PIN_CODE_REGEX = /^\d{6}$/;
export const INDIAN_PHONE_REGEX = /^(?:\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/;
export const INDIAN_PHONE_ERROR_MESSAGE =
  "Please enter a valid 10-digit Indian mobile number (with optional +91).";
export const INDIAN_PIN_ERROR_MESSAGE = "PIN code must be a 6-digit number.";

/**
 * Validates Indian mobile numbers (10 digits starting with 6-9, optional +91 or 0 prefix).
 *
 * @param {string | null | undefined} value
 * @returns {boolean}
 */
export function isValidIndianPhone(value) {
  if (typeof value !== "string") return false;
  const compact = value.trim().replace(/[\s()-]/g, "");
  return /^(?:\+91|0)?[6-9]\d{9}$/.test(compact);
}

/**
 * Validates an optional 6-digit Indian PIN code.
 *
 * @param {string | null | undefined} value
 * @returns {boolean}
 */
export function isValidIndianPinCode(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed === "" || INDIAN_PIN_CODE_REGEX.test(trimmed);
}

export const INDIAN_STATES_AND_UTS = [
  // 28 States
  { code: "AP", name: "Andhra Pradesh", type: "state" },
  { code: "AR", name: "Arunachal Pradesh", type: "state" },
  { code: "AS", name: "Assam", type: "state" },
  { code: "BR", name: "Bihar", type: "state" },
  { code: "CG", name: "Chhattisgarh", type: "state" },
  { code: "GA", name: "Goa", type: "state" },
  { code: "GJ", name: "Gujarat", type: "state" },
  { code: "HR", name: "Haryana", type: "state" },
  { code: "HP", name: "Himachal Pradesh", type: "state" },
  { code: "JH", name: "Jharkhand", type: "state" },
  { code: "KA", name: "Karnataka", type: "state" },
  { code: "KL", name: "Kerala", type: "state" },
  { code: "MP", name: "Madhya Pradesh", type: "state" },
  { code: "MH", name: "Maharashtra", type: "state" },
  { code: "MN", name: "Manipur", type: "state" },
  { code: "ML", name: "Meghalaya", type: "state" },
  { code: "MZ", name: "Mizoram", type: "state" },
  { code: "NL", name: "Nagaland", type: "state" },
  { code: "OD", name: "Odisha", type: "state" },
  { code: "PB", name: "Punjab", type: "state" },
  { code: "RJ", name: "Rajasthan", type: "state" },
  { code: "SK", name: "Sikkim", type: "state" },
  { code: "TN", name: "Tamil Nadu", type: "state" },
  { code: "TS", name: "Telangana", type: "state" },
  { code: "TR", name: "Tripura", type: "state" },
  { code: "UP", name: "Uttar Pradesh", type: "state" },
  { code: "UK", name: "Uttarakhand", type: "state" },
  { code: "WB", name: "West Bengal", type: "state" },
  // 8 Union Territories
  { code: "AN", name: "Andaman and Nicobar Islands", type: "ut" },
  { code: "CH", name: "Chandigarh", type: "ut" },
  {
    code: "DN",
    name: "Dadra and Nagar Haveli and Daman and Diu",
    type: "ut",
  },
  { code: "DL", name: "Delhi (NCT)", type: "ut" },
  { code: "JK", name: "Jammu and Kashmir", type: "ut" },
  { code: "LA", name: "Ladakh", type: "ut" },
  { code: "LD", name: "Lakshadweep", type: "ut" },
  { code: "PY", name: "Puducherry", type: "ut" },
];

export const AUTHORITY_CATEGORY_VALUES = [
  "municipal_corporation",
  "municipal_council",
  "nagar_panchayat",
  "state_pwd",
  "nhai",
];

export const AUTHORITY_CATEGORIES = [
  { value: "municipal_corporation", label: "Municipal Corporation" },
  { value: "municipal_council", label: "Municipal Council" },
  { value: "nagar_panchayat", label: "Nagar Panchayat" },
  { value: "state_pwd", label: "State PWD" },
  { value: "nhai", label: "NHAI" },
];

export const ROAD_TYPE_VALUES = [
  "municipal_road",
  "state_highway",
  "national_highway",
  "village_road",
  "other",
];

export const ROAD_TYPES = [
  { value: "municipal_road", label: "Municipal Road" },
  { value: "state_highway", label: "State Highway" },
  { value: "national_highway", label: "National Highway" },
  { value: "village_road", label: "Village Road" },
  { value: "other", label: "Other" },
];

export const REPORT_CATEGORY_VALUES = [
  "pothole",
  "damaged_road",
  "waterlogging",
  "other",
];

export const REPORT_CATEGORIES = [
  { value: "pothole", label: "Pothole" },
  { value: "damaged_road", label: "Damaged Road Surface" },
  { value: "waterlogging", label: "Waterlogging" },
  { value: "other", label: "Other Road Hazard" },
];

export function getOptionLabel(options, value) {
  if (!value) return "";
  return options.find((item) => item.value === value)?.label || value;
}
