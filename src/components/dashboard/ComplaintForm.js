"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatConfidencePercent } from "@/lib/formatters";
import {
  AUTHORITY_CATEGORIES,
  DEFAULT_COUNTRY,
  isValidIndianPinCode,
  REPORT_CATEGORIES,
  ROAD_TYPES,
} from "@/lib/india-data";
import LocationPicker from "./LocationPicker";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PRIORITY_VALUES = ["low", "medium", "high", "critical"];

function getSafeErrorMessage(data, fallback) {
  if (data && typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  return fallback;
}

/**
 * Citizen Pothole Complaint Submission Form.
 * Orchestrates image upload (/api/citizen/upload), optional real-time AI preview
 * (/api/citizen/detect), Leaflet pin selection (LocationPicker), and
 * authoritative complaint submission (/api/citizen/complaints).
 *
 * @param {{
 *   onSubmitted?: (result: { complaint: Record<string, any>, detectionStatus: string }) => void | Promise<void>,
 *   onUnauthorized?: () => void,
 * }} props
 */
export default function ComplaintForm({ onSubmitted, onUnauthorized }) {
  const { t } = useLanguage();
  const titleId = useId();
  const descriptionId = useId();
  const imageInputId = useId();

  const fileInputRef = useRef(null);
  const uploadRunRef = useRef(0);
  const detectRunRef = useRef(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [reportCategory, setReportCategory] = useState("pothole");
  const [roadType, setRoadType] = useState("");
  const [authorityCategory, setAuthorityCategory] = useState("");
  const [location, setLocation] = useState(null);

  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [imageDimensions, setImageDimensions] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [publicId, setPublicId] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState("");
  const [detectionPreview, setDetectionPreview] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submittedSummary, setSubmittedSummary] = useState(null);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  function clearFieldError(field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function resetImageState() {
    uploadRunRef.current += 1;
    detectRunRef.current += 1;
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl("");
    setSelectedFileName("");
    setImageDimensions(null);
    setImageUrl("");
    setPublicId("");
    setUploading(false);
    setUploadError("");
    setDetecting(false);
    setDetectError("");
    setDetectionPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function runPreviewDetection(uploadedUrl, runId) {
    const detectId = detectRunRef.current + 1;
    detectRunRef.current = detectId;
    setDetecting(true);
    setDetectError("");
    setDetectionPreview(null);

    const isStale = () =>
      uploadRunRef.current !== runId || detectRunRef.current !== detectId;

    try {
      const res = await fetch("/api/citizen/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadedUrl }),
      });

      if (isStale()) return;

      if (res.status === 401) {
        onUnauthorized?.();
        setDetectError("Your session expired. Please sign in again.");
        return;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        setDetectError(
          getSafeErrorMessage(
            data,
            "Automated preview scan is temporarily unavailable. You can still submit your complaint."
          )
        );
        return;
      }

      setDetectionPreview({
        detected: Boolean(data?.detected),
        confidence:
          typeof data?.confidence === "number" ? data.confidence : 0,
        boundingBoxes: Array.isArray(data?.boundingBoxes)
          ? data.boundingBoxes
          : [],
        modelName: typeof data?.modelName === "string" ? data.modelName : "",
        rawImage:
          data?.rawResult?.image &&
          typeof data.rawResult.image.width === "number" &&
          typeof data.rawResult.image.height === "number"
            ? data.rawResult.image
            : null,
      });
    } catch {
      if (isStale()) return;
      setDetectError(
        "Unable to reach the AI preview scanner right now. You can still submit your complaint."
      );
    } finally {
      if (!isStale()) {
        setDetecting(false);
      }
    }
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSubmitError("");
    setSubmittedSummary(null);
    clearFieldError("imageUrl");

    const fileType = (file.type || "").toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(fileType)) {
      setUploadError("Only JPEG, PNG, and WebP images are supported.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size <= 0) {
      setUploadError("The selected image file is empty.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("Image file size cannot exceed 5 MB.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const runId = uploadRunRef.current + 1;
    uploadRunRef.current = runId;

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
    setSelectedFileName(file.name);
    setImageDimensions(null);
    setImageUrl("");
    setPublicId("");
    setUploadError("");
    setDetectError("");
    setDetectionPreview(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/citizen/upload", {
        method: "POST",
        body: formData,
      });

      if (uploadRunRef.current !== runId) return;

      if (res.status === 401) {
        onUnauthorized?.();
        setUploadError("Your session expired. Please sign in again.");
        return;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data?.imageUrl) {
        setUploadError(
          getSafeErrorMessage(
            data,
            "Unable to upload the image. Please try another photo."
          )
        );
        return;
      }

      setImageUrl(data.imageUrl);
      setPublicId(typeof data.publicId === "string" ? data.publicId : "");
      setUploading(false);

      if (reportCategory === "pothole") {
        await runPreviewDetection(data.imageUrl, runId);
      }
    } catch {
      if (uploadRunRef.current !== runId) return;
      setUploadError("Network error during upload. Please try again.");
    } finally {
      if (uploadRunRef.current === runId) {
        setUploading(false);
      }
    }
  }

  function validateClientFields() {
    const errors = {};
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle.length < 3) {
      errors.title = "Title must be at least 3 characters.";
    } else if (trimmedTitle.length > 150) {
      errors.title = "Title cannot exceed 150 characters.";
    }

    if (trimmedDescription.length < 5) {
      errors.description = "Description must be at least 5 characters.";
    } else if (trimmedDescription.length > 2000) {
      errors.description = "Description cannot exceed 2000 characters.";
    }

    if (uploading) {
      errors.imageUrl = "Please wait for the photo upload to finish.";
    } else if (!imageUrl) {
      errors.imageUrl = "Please upload a road hazard photo first.";
    }

    if (
      !location ||
      typeof location.latitude !== "number" ||
      !Number.isFinite(location.latitude) ||
      typeof location.longitude !== "number" ||
      !Number.isFinite(location.longitude)
    ) {
      errors.location =
        "Please pin the road hazard on the map or use your current location.";
    } else if (location.address && location.address.trim().length > 300) {
      errors.location = "Address cannot exceed 300 characters.";
    } else if (location.pinCode && !isValidIndianPinCode(location.pinCode)) {
      errors.location = "PIN code must be a 6-digit number.";
    }

    return errors;
  }

  function mapServerFieldErrors(details) {
    if (!details || typeof details !== "object") {
      return {};
    }

    const mapped = {};
    for (const [key, message] of Object.entries(details)) {
      if (typeof message !== "string") continue;
      if (key.startsWith("location")) {
        if (!mapped.location) {
          mapped.location = message;
        }
      } else {
        mapped[key] = message;
      }
    }
    return mapped;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting || uploading) return;

    setSubmitError("");
    setSubmittedSummary(null);

    const clientErrors = validateClientFields();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setSubmitError("Please review the highlighted fields before submitting.");
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        imageUrl,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: (location.address || "").trim(),
          country: (location.country || DEFAULT_COUNTRY).trim(),
          state: (location.state || "").trim(),
          district: (location.district || "").trim(),
          city: (location.city || "").trim(),
          ward: (location.ward || "").trim(),
          pinCode: (location.pinCode || "").trim(),
        },
        priority,
        reportCategory,
        roadType,
        authorityCategory,
      };

      const res = await fetch("/api/citizen/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        onUnauthorized?.();
        setSubmitError("Your session has expired. Please sign in again.");
        return;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (res.status === 400 && data?.details) {
          setFieldErrors(mapServerFieldErrors(data.details));
          setSubmitError(
            getSafeErrorMessage(data, "Please check your complaint details.")
          );
          return;
        }

        if (res.status === 403) {
          setSubmitError(
            getSafeErrorMessage(
              data,
              "Only citizen accounts may submit pothole complaints."
            )
          );
          return;
        }

        if (res.status === 503) {
          setSubmitError(
            getSafeErrorMessage(
              data,
              "Submission service is temporarily unavailable. Your inputs are preserved—please try again shortly."
            )
          );
          return;
        }

        setSubmitError(
          getSafeErrorMessage(
            data,
            "Unable to submit complaint right now. Your inputs have been preserved."
          )
        );
        return;
      }

      setSubmittedSummary(data);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setReportCategory("pothole");
      setRoadType("");
      setAuthorityCategory("");
      setLocation(null);
      resetImageState();

      if (typeof onSubmitted === "function") {
        await onSubmitted(data);
      }
    } catch {
      setSubmitError(
        "Network error while submitting complaint. Your inputs have been preserved."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const previewSource = imageUrl || localPreviewUrl;
  const overlayDimensions =
    detectionPreview?.rawImage || imageDimensions || null;
  const boxCount = detectionPreview?.boundingBoxes?.length || 0;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid grid-cols-1 border border-[#DEDCCF] bg-[#FAF8F2] lg:grid-cols-12"
    >
      {/* Left Main Form Column */}
      <div className="space-y-6 p-6 sm:p-8 lg:col-span-8 lg:border-r lg:border-[#DEDCCF]">
        <div className="border-b border-[#DEDCCF] pb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
            {t("citizenHazardIntake")}
          </p>
          <h3 className="mt-2 text-2xl font-light tracking-tight text-[#292D2A]">
            {t("reportFormTitle")}
          </h3>
          <p className="mt-1.5 text-sm leading-6 text-[#777B70]">
            {t("reportFormDesc")}
          </p>
        </div>

        {/* Form-level Error Alert */}
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-3 border border-[#A65F45]/60 bg-[#A65F45]/10 px-4 py-3 text-sm text-[#864832]"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[#A65F45]"
              strokeWidth={1.8}
            />
            <span>{submitError}</span>
          </div>
        )}

        {/* Fallback Inline Success Banner (when used standalone without tab redirect) */}
        {submittedSummary?.complaint && (
          <div
            role="status"
            className="flex items-start gap-3 border border-[#233B32]/40 bg-[#233B32]/8 px-4 py-3.5 text-sm text-[#233B32]"
          >
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[#233B32]"
              strokeWidth={1.8}
            />
            <div>
              <p className="font-medium">
                {t("complaintLoggedPrefix")}: {submittedSummary.complaint.title}
              </p>
              <p className="mt-1 text-xs text-[#292D2A]">
                {submittedSummary.detectionStatus === "completed"
                  ? submittedSummary.complaint.detection?.detected
                    ? `${t("aiCompletedDetected")} (${formatConfidencePercent(
                        submittedSummary.complaint.detection.confidence
                      )}).`
                    : t("aiCompletedNoPothole")
                  : submittedSummary.detectionStatus === "not_applicable"
                    ? t("aiManualReview")
                    : t("aiSavedManualReview")}
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Road Photo Upload */}
        <fieldset className="space-y-3" disabled={submitting}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label
              htmlFor={imageInputId}
              className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]"
            >
              {t("roadPhotoLabel")}
            </label>
            <span className="font-mono text-[10px] text-[#777B70]">
              JPEG, PNG, WebP · Max 5 MB
            </span>
          </div>

          {!previewSource ? (
            <label
              htmlFor={imageInputId}
              className={`flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-10 text-center transition-colors ${
                fieldErrors.imageUrl || uploadError
                  ? "border-[#A65F45] bg-[#A65F45]/5"
                  : "border-[#DEDCCF] bg-[#F4F1E8] hover:border-[#233B32]"
              }`}
            >
              <div className="flex h-11 w-11 items-center justify-center border border-[#DEDCCF] bg-[#FAF8F2] text-[#233B32]">
                <ImagePlus className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <p className="mt-4 text-sm font-medium text-[#292D2A]">
                {t("selectPhotoTitle")}
              </p>
              <p className="mt-1 text-xs text-[#777B70]">
                {t("selectPhotoHint")}
              </p>
              <span className="mt-4 inline-flex items-center border border-[#233B32] bg-[#233B32] px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#F4F1E8]">
                {t("chooseImage")}
              </span>
            </label>
          ) : (
            <div className="space-y-3 border border-[#DEDCCF] bg-[#F4F1E8] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DEDCCF] pb-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-medium text-[#292D2A]">
                    {selectedFileName || "Uploaded complaint photo"}
                  </p>
                  <p className="font-mono text-[10px] text-[#777B70]">
                    {uploading
                      ? t("uploadingToCloudinary")
                      : imageUrl
                        ? `${t("uploadedLabel")}${publicId ? ` · ${publicId}` : ""}`
                        : t("uploadIncomplete")}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor={imageInputId}
                    className="cursor-pointer border border-[#DEDCCF] bg-[#FAF8F2] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32]"
                  >
                    {t("replaceLabel")}
                  </label>
                  <button
                    type="button"
                    onClick={resetImageState}
                    disabled={submitting}
                    className="inline-flex items-center gap-1 border border-[#DEDCCF] bg-[#FAF8F2] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#864832] transition-colors hover:border-[#A65F45] disabled:opacity-50"
                    aria-label="Remove uploaded image"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.6} />
                    <span>{t("clearLabel")}</span>
                  </button>
                </div>
              </div>

              {/* Image & Bounding Box Preview */}
              <div className="relative overflow-hidden border border-[#DEDCCF] bg-[#EFECE1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSource}
                  alt="Uploaded road surface preview"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setImageDimensions({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                      });
                    }
                  }}
                  className="block max-h-80 w-full object-contain"
                />

                {detectionPreview?.detected &&
                  boxCount > 0 &&
                  overlayDimensions && (
                    <svg
                      viewBox={`0 0 ${overlayDimensions.width} ${overlayDimensions.height}`}
                      preserveAspectRatio="xMidYMid meet"
                      aria-label="AI pothole detection bounding boxes"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    >
                      {detectionPreview.boundingBoxes.map((box, index) => {
                        const left = Math.max(0, box.x - box.width / 2);
                        const top = Math.max(0, box.y - box.height / 2);
                        const strokeW = Math.max(
                          2,
                          Math.round(overlayDimensions.width * 0.004)
                        );
                        return (
                          <g key={`${box.x}-${box.y}-${index}`}>
                            <rect
                              x={left}
                              y={top}
                              width={box.width}
                              height={box.height}
                              fill="rgba(166, 95, 69, 0.16)"
                              stroke="#A65F45"
                              strokeWidth={strokeW}
                            />
                          </g>
                        );
                      })}
                    </svg>
                  )}

                {uploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#F4F1E8]/85">
                    <Loader2
                      className="h-5 w-5 animate-spin text-[#233B32]"
                      strokeWidth={1.8}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#233B32]">
                      {t("uploadingPhoto")}
                    </span>
                  </div>
                )}
              </div>

              {/* Real-time AI Detection Status Readout */}
              {imageUrl && (
                <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-3.5">
                  {detecting ? (
                    <div className="flex items-center gap-2.5 text-xs text-[#292D2A]">
                      <Loader2
                        className="h-4 w-4 animate-spin text-[#233B32]"
                        strokeWidth={1.8}
                      />
                      <span>{t("runningAiPreview")}</span>
                    </div>
                  ) : detectError ? (
                    <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-2 text-xs text-[#864832]">
                        <ShieldAlert
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#A65F45]"
                          strokeWidth={1.8}
                        />
                        <span>{detectError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          runPreviewDetection(imageUrl, uploadRunRef.current)
                        }
                        disabled={submitting}
                        className="inline-flex shrink-0 items-center gap-1.5 border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] hover:border-[#233B32]"
                      >
                        <RefreshCw className="h-3 w-3" strokeWidth={1.6} />
                        <span>{t("retryScan")}</span>
                      </button>
                    </div>
                  ) : detectionPreview ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Eye
                          className={`h-4 w-4 ${
                            detectionPreview.detected
                              ? "text-[#233B32]"
                              : "text-[#A65F45]"
                          }`}
                          strokeWidth={1.8}
                        />
                        <span className="text-xs font-medium text-[#292D2A]">
                          {detectionPreview.detected
                            ? t("previewDetected")
                            : t("previewNoPothole")}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-[#777B70]">
                        <span>
                          {t("confidenceLabel")}:{" "}
                          <strong className="font-semibold text-[#292D2A]">
                            {formatConfidencePercent(detectionPreview.confidence)}
                          </strong>
                        </span>
                        <span>
                          {t("boundingBoxesLabel")}:{" "}
                          <strong className="font-semibold text-[#292D2A]">
                            {boxCount}
                          </strong>
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            id={imageInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelection}
            disabled={submitting || uploading}
            className="sr-only"
          />

          {(uploadError || fieldErrors.imageUrl) && (
            <p role="alert" className="text-xs text-[#864832]">
              {uploadError || fieldErrors.imageUrl}
            </p>
          )}
        </fieldset>

        {/* Step 2: Title, Description & Priority */}
        <div className="space-y-5 border-t border-[#DEDCCF] pt-6">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor={titleId}
                className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]"
              >
                {t("complaintTitleLabel")}
              </label>
              <span className="font-mono text-[10px] text-[#777B70]">
                {title.trim().length}/150
              </span>
            </div>
            <input
              id={titleId}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearFieldError("title");
              }}
              maxLength={150}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={
                fieldErrors.title ? `${titleId}-error` : undefined
              }
              placeholder={t("titlePlaceholder")}
              className={`mt-1.5 w-full border bg-[#F4F1E8] px-3.5 py-2.5 text-sm text-[#292D2A] placeholder:text-[#777B70]/70 focus:outline-none disabled:opacity-60 ${
                fieldErrors.title
                  ? "border-[#A65F45]"
                  : "border-[#DEDCCF] focus:border-[#233B32]"
              }`}
            />
            {fieldErrors.title && (
              <p
                id={`${titleId}-error`}
                role="alert"
                className="mt-1.5 text-xs text-[#864832]"
              >
                {fieldErrors.title}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor={descriptionId}
                className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]"
              >
                {t("complaintDescLabel")}
              </label>
              <span className="font-mono text-[10px] text-[#777B70]">
                {description.trim().length}/2000
              </span>
            </div>
            <textarea
              id={descriptionId}
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearFieldError("description");
              }}
              maxLength={2000}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={
                fieldErrors.description ? `${descriptionId}-error` : undefined
              }
              placeholder={t("descPlaceholder")}
              className={`mt-1.5 w-full border bg-[#F4F1E8] px-3.5 py-2.5 text-sm text-[#292D2A] placeholder:text-[#777B70]/70 focus:outline-none disabled:opacity-60 ${
                fieldErrors.description
                  ? "border-[#A65F45]"
                  : "border-[#DEDCCF] focus:border-[#233B32]"
              }`}
            />
            {fieldErrors.description && (
              <p
                id={`${descriptionId}-error`}
                role="alert"
                className="mt-1.5 text-xs text-[#864832]"
              >
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div>
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
              {t("severityLabel")}
            </span>
            <div
              role="radiogroup"
              aria-label="Complaint priority"
              className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
            >
              {PRIORITY_VALUES.map((optionValue) => {
                const isSelected = priority === optionValue;
                return (
                  <button
                    key={optionValue}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={submitting}
                    onClick={() => {
                      setPriority(optionValue);
                      clearFieldError("priority");
                    }}
                    className={`border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                      isSelected
                        ? "border-[#233B32] bg-[#233B32] text-[#F4F1E8]"
                        : "border-[#DEDCCF] bg-[#F4F1E8] text-[#292D2A] hover:border-[#233B32]"
                    }`}
                  >
                    <span className="block font-mono text-[11px] font-medium uppercase tracking-wider">
                      {t(`priority_${optionValue}`)}
                    </span>
                    <span
                      className={`mt-0.5 block text-[11px] ${
                        isSelected ? "text-[#DEDCCF]" : "text-[#777B70]"
                      }`}
                    >
                      {t(`priorityHint_${optionValue}`)}
                    </span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.priority && (
              <p role="alert" className="mt-1.5 text-xs text-[#864832]">
                {fieldErrors.priority}
              </p>
            )}
          </div>
        </div>

        {/* Step 5: Indian Road & Authority Context */}
        <div className="space-y-4 border-t border-[#DEDCCF] pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
            {t("roadContextLabel")}
          </p>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="complaint-report-category"
                className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
              >
                {t("reportCategoryLabel")}
              </label>
              <select
                id="complaint-report-category"
                value={reportCategory}
                disabled={submitting}
                onChange={(e) => {
                  const nextCategory = e.target.value;
                  setReportCategory(nextCategory);
                  if (nextCategory !== "pothole") {
                    detectRunRef.current += 1;
                    setDetecting(false);
                    setDetectionPreview(null);
                    setDetectError("");
                  } else if (imageUrl && !detectionPreview && !detecting) {
                    runPreviewDetection(imageUrl, uploadRunRef.current);
                  }
                }}
                className="mt-1.5 h-10 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none disabled:opacity-60"
              >
                {REPORT_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(`reportCategory_${item.value}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="complaint-road-type"
                className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
              >
                {t("roadTypeLabel")}
              </label>
              <select
                id="complaint-road-type"
                value={roadType}
                disabled={submitting}
                onChange={(e) => setRoadType(e.target.value)}
                className="mt-1.5 h-10 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none disabled:opacity-60"
              >
                <option value="">{t("selectOptional")}</option>
                {ROAD_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(`roadType_${item.value}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="complaint-authority-category"
                className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]"
              >
                {t("authorityCategoryLabel")}
              </label>
              <select
                id="complaint-authority-category"
                value={authorityCategory}
                disabled={submitting}
                onChange={(e) => setAuthorityCategory(e.target.value)}
                className="mt-1.5 h-10 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none disabled:opacity-60"
              >
                <option value="">{t("selectOptional")}</option>
                {AUTHORITY_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(`authority_${item.value}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5 border border-[#DEDCCF] bg-[#EFECE1]/65 p-3 text-xs leading-5 text-[#63675D]">
            <p>{t("authorityNote")}</p>
            <p className="text-[#233B32]">{t("aiScopeNote")}</p>
          </div>
        </div>

        {/* Step 6: Location Picker */}
        <div className="space-y-2 border-t border-[#DEDCCF] pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
            {t("locationStepLabel")}
          </p>
          <LocationPicker
            value={location}
            onChange={(nextLocation) => {
              setLocation(nextLocation);
              clearFieldError("location");
            }}
            disabled={submitting}
          />
          {fieldErrors.location && (
            <p role="alert" className="text-xs text-[#864832]">
              {fieldErrors.location}
            </p>
          )}
        </div>

        {/* Submit Action */}
        <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[#DEDCCF] pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-[#777B70]">
            {reportCategory === "pothole"
              ? t("serverAiNote")
              : t("aiScopeNote")}
          </p>
          <button
            type="submit"
            disabled={submitting || uploading}
            className="inline-flex shrink-0 items-center justify-center gap-2 bg-[#233B32] px-6 py-3 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin"
                  strokeWidth={1.8}
                />
                <span>{t("submittingReportBtn")}</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" strokeWidth={1.8} />
                <span>{t("submitReportBtn")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Pipeline Checklist Sidebar */}
      <aside className="flex flex-col justify-between bg-[#EFECE1]/65 p-6 sm:p-8 lg:col-span-4">
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
              {t("submissionChecklist")}
            </p>
            <ul className="mt-4 space-y-3 text-xs text-[#292D2A]">
              <li className="flex items-center justify-between border-b border-[#DEDCCF] pb-2.5">
                <span>{t("checkPhotoUploaded")}</span>
                <span
                  className={`font-mono ${
                    imageUrl
                      ? "text-[#233B32]"
                      : uploading
                        ? "text-[#A65F45]"
                        : "text-[#777B70]"
                  }`}
                >
                  {imageUrl
                    ? t("readyLabel")
                    : uploading
                      ? t("uploadingLabel")
                      : t("pendingLabel")}
                </span>
              </li>
              <li className="flex items-center justify-between border-b border-[#DEDCCF] pb-2.5">
                <span>{t("checkAiPreview")}</span>
                <span
                  className={`font-mono ${
                    detectionPreview
                      ? "text-[#233B32]"
                      : detecting
                        ? "text-[#A65F45]"
                        : "text-[#777B70]"
                  }`}
                >
                  {reportCategory !== "pothole"
                    ? t("aiManualReview")
                    : detecting
                      ? t("scanningLabel")
                      : detectionPreview
                        ? detectionPreview.detected
                          ? t("detectedLabel")
                          : t("checkedLabel")
                        : detectError
                          ? t("optional")
                          : t("waitingLabel")}
                </span>
              </li>
              <li className="flex items-center justify-between border-b border-[#DEDCCF] pb-2.5">
                <span>{t("checkCoordinates")}</span>
                <span
                  className={`font-mono ${
                    typeof location?.latitude === "number" &&
                    typeof location?.longitude === "number"
                      ? "text-[#233B32]"
                      : "text-[#777B70]"
                  }`}
                >
                  {typeof location?.latitude === "number" &&
                  typeof location?.longitude === "number"
                    ? t("selectedLabel")
                    : t("requiredLabel")}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>{t("checkIncidentDetails")}</span>
                <span
                  className={`font-mono ${
                    title.trim().length >= 3 && description.trim().length >= 5
                      ? "text-[#233B32]"
                      : "text-[#777B70]"
                  }`}
                >
                  {title.trim().length >= 3 && description.trim().length >= 5
                    ? t("completeLabel")
                    : t("requiredLabel")}
                </span>
              </li>
            </ul>
          </div>

          <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
              {t("verificationPolicy")}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#777B70]">
              {t("verificationPolicyDesc")}
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-dashed border-[#DEDCCF] pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#777B70]">
            Cloudinary · Roboflow · OpenStreetMap
          </p>
        </div>
      </aside>
    </form>
  );
}
