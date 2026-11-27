"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { LocateFixed, MapPin, AlertTriangle, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  DEFAULT_COUNTRY,
  INDIAN_STATES_AND_UTS,
} from "@/lib/india-data";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-72 w-full flex-col items-center justify-center gap-2 border border-[#DEDCCF] bg-[#EFECE1] text-center sm:h-80"
      aria-busy="true"
      aria-label="Loading interactive map"
    >
      <Loader2
        className="h-5 w-5 animate-spin text-[#233B32]"
        strokeWidth={1.6}
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
        Initializing OpenStreetMap Canvas
      </p>
    </div>
  ),
});

const EMPTY_ADDRESS_FIELDS = {
  country: DEFAULT_COUNTRY,
  state: "",
  district: "",
  city: "",
  ward: "",
  pinCode: "",
  address: "",
};

function hasValidCoordinates(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

function getGeolocationErrorMessage(error) {
  if (!error) {
    return "Unable to determine your location. Click on the map to pin the road hazard manually.";
  }

  switch (error.code) {
    case 1:
      return "Location access was denied. Enable browser location permission or click on the map to place the pin manually.";
    case 2:
      return "Your current location is unavailable right now. Please click on the map to pin the road hazard location.";
    case 3:
      return "Location lookup timed out. Please try again or click on the map to select the spot manually.";
    default:
      return "Unable to retrieve your current location. Click on the map to place the pin manually.";
  }
}

/**
 * Reusable client-side Leaflet/OpenStreetMap location picker for Indian road
 * complaint submissions. Coordinates are authoritative; the default Jalandhar
 * map view is never treated as the citizen's selected location, and addresses
 * are never fabricated via reverse-geocoding.
 *
 * @param {{
 *   value: {
 *     latitude: number | null,
 *     longitude: number | null,
 *     country?: string,
 *     state?: string,
 *     district?: string,
 *     city?: string,
 *     ward?: string,
 *     pinCode?: string,
 *     address?: string,
 *   } | null,
 *   onChange: (location: Record<string, any>) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function LocationPicker({
  value = null,
  onChange,
  disabled = false,
}) {
  const { t } = useLanguage();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [centerTarget, setCenterTarget] = useState(null);

  const selected = hasValidCoordinates(value);
  const coordinates = selected
    ? { latitude: value.latitude, longitude: value.longitude }
    : null;

  const addressFields = {
    country:
      typeof value?.country === "string" && value.country
        ? value.country
        : DEFAULT_COUNTRY,
    state: typeof value?.state === "string" ? value.state : "",
    district: typeof value?.district === "string" ? value.district : "",
    city: typeof value?.city === "string" ? value.city : "",
    ward: typeof value?.ward === "string" ? value.ward : "",
    pinCode: typeof value?.pinCode === "string" ? value.pinCode : "",
    address: typeof value?.address === "string" ? value.address : "",
  };

  const emitLocation = useCallback(
    (latitude, longitude, fields) => {
      if (typeof onChange !== "function") return;
      onChange({
        latitude,
        longitude,
        ...EMPTY_ADDRESS_FIELDS,
        ...fields,
      });
    },
    [onChange]
  );

  const handleMapSelect = useCallback(
    (latitude, longitude) => {
      if (disabled) return;
      setGeoError("");
      emitLocation(latitude, longitude, addressFields);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, emitLocation, value]
  );

  function handleUseCurrentLocation() {
    if (disabled || locating) return;
    setGeoError("");

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoError(
        "Browser geolocation is not supported on this device. Click on the map to pin the location manually."
      );
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));

        setLocating(false);
        setCenterTarget((prev) => ({
          latitude,
          longitude,
          seq: (prev?.seq ?? 0) + 1,
        }));
        emitLocation(latitude, longitude, addressFields);
      },
      (error) => {
        setLocating(false);
        setGeoError(getGeolocationErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  function handleFieldChange(field, nextValue) {
    if (disabled) return;
    const sanitizedValue =
      field === "pinCode"
        ? nextValue.replace(/[^\d]/g, "").slice(0, 6)
        : nextValue;
    emitLocation(
      selected ? value.latitude : null,
      selected ? value.longitude : null,
      {
        ...addressFields,
        [field]: sanitizedValue,
      }
    );
  }

  return (
    <div className="space-y-4 border border-[#DEDCCF] bg-[#FAF8F2] p-4 sm:p-5">
      {/* Header & Geolocation Trigger */}
      <div className="flex flex-col justify-between gap-3 border-b border-[#DEDCCF] pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
            {t("geolocationPin")}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#777B70]">
            {t("locationHint")}
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={disabled || locating}
          className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#233B32] bg-[#233B32] px-3.5 py-2 text-xs font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {locating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
          ) : (
            <LocateFixed className="h-3.5 w-3.5" strokeWidth={1.8} />
          )}
          <span>
            {locating ? t("locating") : t("useCurrentLocation")}
          </span>
        </button>
      </div>

      {/* Geolocation Error Alert */}
      {geoError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border border-[#A65F45]/50 bg-[#A65F45]/10 px-3.5 py-2.5 text-xs text-[#864832]"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A65F45]"
            strokeWidth={1.8}
          />
          <span>{geoError}</span>
        </div>
      )}

      {/* Interactive Leaflet Map */}
      <LocationPickerMap
        coordinates={coordinates}
        centerTarget={centerTarget}
        disabled={disabled}
        onSelectCoordinates={handleMapSelect}
      />

      {/* Coordinate Readout Strip */}
      <div className="grid grid-cols-1 gap-3 border border-[#DEDCCF] bg-[#EFECE1]/65 p-3.5 sm:grid-cols-2">
        <div>
          <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]">
            {t("selectedLatitude")}
          </span>
          <span className="mt-1 flex items-center gap-1.5 font-mono text-xs font-medium text-[#292D2A]">
            <MapPin
              className={`h-3.5 w-3.5 ${selected ? "text-[#A65F45]" : "text-[#777B70]"}`}
              strokeWidth={1.6}
            />
            {selected ? `${value.latitude.toFixed(6)}°` : t("notSelected")}
          </span>
        </div>

        <div>
          <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]">
            {t("selectedLongitude")}
          </span>
          <span className="mt-1 block font-mono text-xs font-medium text-[#292D2A]">
            {selected ? `${value.longitude.toFixed(6)}°` : t("notSelected")}
          </span>
        </div>
      </div>

      {/* Indian Address Fields (Optional, Preserved Alongside GPS) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="complaint-location-country"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
          >
            {t("countryLabel")}
          </label>
          <input
            id="complaint-location-country"
            type="text"
            value={addressFields.country}
            onChange={(e) => handleFieldChange("country", e.target.value)}
            maxLength={80}
            disabled={disabled}
            className="mt-1.5 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-2 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="complaint-location-state"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
          >
            {t("stateLabel")}
          </label>
          <select
            id="complaint-location-state"
            value={addressFields.state}
            onChange={(e) => handleFieldChange("state", e.target.value)}
            disabled={disabled}
            className="mt-1.5 h-[38px] w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">{t("selectStatePlaceholder")}</option>
            {INDIAN_STATES_AND_UTS.map((item) => (
              <option key={item.code} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="complaint-location-district"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
          >
            {t("districtLabel")}
          </label>
          <input
            id="complaint-location-district"
            type="text"
            value={addressFields.district}
            onChange={(e) => handleFieldChange("district", e.target.value)}
            maxLength={100}
            disabled={disabled}
            placeholder={t("districtPlaceholder")}
            className="mt-1.5 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-2 text-sm text-[#292D2A] placeholder:text-[#777B70]/70 focus:border-[#233B32] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="complaint-location-city"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
          >
            {t("cityLabel")}
          </label>
          <input
            id="complaint-location-city"
            type="text"
            value={addressFields.city}
            onChange={(e) => handleFieldChange("city", e.target.value)}
            maxLength={100}
            disabled={disabled}
            placeholder={t("cityPlaceholder")}
            className="mt-1.5 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-2 text-sm text-[#292D2A] placeholder:text-[#777B70]/70 focus:border-[#233B32] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="complaint-location-ward"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
          >
            {t("wardLabel")}
          </label>
          <input
            id="complaint-location-ward"
            type="text"
            value={addressFields.ward}
            onChange={(e) => handleFieldChange("ward", e.target.value)}
            maxLength={120}
            disabled={disabled}
            placeholder={t("wardPlaceholder")}
            className="mt-1.5 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-2 text-sm text-[#292D2A] placeholder:text-[#777B70]/70 focus:border-[#233B32] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="complaint-location-pincode"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
          >
            {t("pinCodeLabel")}
          </label>
          <input
            id="complaint-location-pincode"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            value={addressFields.pinCode}
            onChange={(e) => handleFieldChange("pinCode", e.target.value)}
            maxLength={6}
            disabled={disabled}
            placeholder={t("pinCodePlaceholder")}
            className="mt-1.5 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-2 font-mono text-sm text-[#292D2A] placeholder:font-sans placeholder:text-[#777B70]/70 focus:border-[#233B32] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      {/* Optional Manual Landmark / Street Address */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label
            htmlFor="complaint-location-address"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
          >
            {t("streetLandmarkLabel")}
          </label>
          <span className="font-mono text-[10px] text-[#777B70]">
            {addressFields.address.length}/300
          </span>
        </div>
        <input
          id="complaint-location-address"
          type="text"
          value={addressFields.address}
          onChange={(e) => handleFieldChange("address", e.target.value)}
          maxLength={300}
          disabled={disabled}
          placeholder={t("streetLandmarkPlaceholder")}
          className="mt-1.5 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3.5 py-2.5 text-sm text-[#292D2A] placeholder:text-[#777B70]/70 focus:border-[#233B32] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-1.5 text-[11px] text-[#777B70]">
          {selected ? t("pinSavedAuthoritative") : t("pinPromptHint")}
        </p>
      </div>
    </div>
  );
}
