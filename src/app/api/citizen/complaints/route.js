import { connection, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireApiAuth } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  COMPLAINT_PUBLIC_FIELDS,
  NO_STORE_HEADERS,
  serializeDetection,
  serializeLocation,
} from "@/lib/operations-data";
import { detectPotholesFromImageUrl } from "@/lib/roboflow";
import { formatZodErrors } from "@/lib/validators/auth";
import {
  createComplaintSchema,
  listComplaintsQuerySchema,
} from "@/lib/validators/complaint";
import Complaint from "@/models/Complaint";
import Detection from "@/models/Detection";
import RepairVerification from "@/models/RepairVerification";
import StatusHistory from "@/models/StatusHistory";
import User from "@/models/User";

const ROBOFLOW_UNAVAILABLE_CODES = new Set([
  "MISSING_ROBOFLOW_CONFIG",
  "ROBOFLOW_TIMEOUT",
  "ROBOFLOW_UPSTREAM_ERROR",
  "ROBOFLOW_INVALID_RESPONSE",
]);

/**
 * Checks whether a Mongoose/MongoDB error indicates that multi-document
 * transactions are unsupported by the connected topology (e.g. standalone node).
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function isTransactionUnsupportedError(error) {
  const err = /** @type {{ code?: number, codeName?: string, message?: string }} */ (
    error
  );
  if (err?.code === 20 || err?.codeName === "IllegalOperation") {
    return true;
  }
  const message = typeof err?.message === "string" ? err.message : "";
  return /Transaction numbers are only allowed|replica set/i.test(message);
}

/**
 * Serializes a Complaint document with optional associated Detection summary,
 * latest RepairVerification, and chronological StatusHistory.
 *
 * @param {Record<string, any>} complaintDoc
 * @param {Record<string, any> | null} [detectionDoc]
 * @param {Array<Record<string, any>>} [statusHistory]
 * @param {Record<string, any> | null} [repairVerification]
 */
function serializeComplaint(
  complaintDoc,
  detectionDoc = null,
  statusHistory = [],
  repairVerification = null
) {
  return {
    id: String(complaintDoc._id),
    citizenId: String(complaintDoc.citizenId),
    title: complaintDoc.title,
    description: complaintDoc.description,
    imageUrl: complaintDoc.imageUrl,
    location: serializeLocation(complaintDoc.location),
    priority: complaintDoc.priority,
    reportCategory: complaintDoc.reportCategory || "pothole",
    roadType: complaintDoc.roadType || "",
    authorityCategory: complaintDoc.authorityCategory || "",
    status: complaintDoc.status,
    detectionId: complaintDoc.detectionId
      ? String(complaintDoc.detectionId)
      : null,
    detection: serializeDetection(detectionDoc),
    repairVerification: repairVerification
      ? {
          id: String(repairVerification._id),
          afterImage: repairVerification.afterImage,
          repairNotes: repairVerification.repairNotes || "",
          verificationStatus: repairVerification.verificationStatus,
          createdAt: repairVerification.createdAt,
        }
      : null,
    statusHistory,
    createdAt: complaintDoc.createdAt,
    updatedAt: complaintDoc.updatedAt,
  };
}

/**
 * Runs authoritative Roboflow pothole detection without holding a database
 * transaction open, falling back to `unavailable` if Roboflow is down.
 *
 * @param {string} imageUrl
 */
async function runAuthoritativeDetection(imageUrl) {
  try {
    const result = await detectPotholesFromImageUrl(imageUrl);
    return {
      detectionStatus: "completed",
      detectionResult: result,
    };
  } catch (error) {
    if (
      error?.code === "INVALID_IMAGE_URL" ||
      error?.code === "MISSING_CLOUDINARY_CONFIG"
    ) {
      throw error;
    }

    if (ROBOFLOW_UNAVAILABLE_CODES.has(error?.code)) {
      console.warn(
        "[CitizenComplaints] Detection unavailable, saving complaint without detection:",
        error.code
      );
      return {
        detectionStatus: "unavailable",
        detectionResult: null,
      };
    }

    console.warn(
      "[CitizenComplaints] Unexpected detection failure, saving complaint without detection:",
      error?.name || "DetectError"
    );
    return {
      detectionStatus: "unavailable",
      detectionResult: null,
    };
  }
}

/**
 * Persists Complaint, optional Detection, and initial StatusHistory inside a
 * MongoDB transaction when supported, falling back to sequential writes with
 * compensating rollback cleanup if transactions are unavailable.
 */
async function persistComplaintRecords({
  citizenObjectId,
  validatedInput,
  detectionResult,
}) {
  const complaintPayload = {
    citizenId: citizenObjectId,
    title: validatedInput.title,
    description: validatedInput.description,
    imageUrl: validatedInput.imageUrl,
    location: validatedInput.location,
    priority: validatedInput.priority,
    reportCategory: validatedInput.reportCategory || "pothole",
    roadType: validatedInput.roadType || "",
    authorityCategory: validatedInput.authorityCategory || "",
    status: "pending",
    detectionId: null,
  };

  const statusNote =
    complaintPayload.reportCategory !== "pothole"
      ? "Complaint submitted for manual review (automated AI detection applies to potholes only)."
      : detectionResult
        ? "Complaint submitted with automated AI pothole detection."
        : "Complaint submitted; automated AI pothole detection was temporarily unavailable.";

  const session = await mongoose.startSession();
  try {
    let savedComplaint = null;
    let savedDetection = null;

    await session.withTransaction(async () => {
      const complaintId = new mongoose.Types.ObjectId();
      const detectionId = detectionResult
        ? new mongoose.Types.ObjectId()
        : null;

      const [createdComplaint] = await Complaint.create(
        [
          {
            ...complaintPayload,
            _id: complaintId,
            detectionId,
          },
        ],
        { session }
      );
      savedComplaint = createdComplaint;

      if (detectionResult && detectionId) {
        const [createdDetection] = await Detection.create(
          [
            {
              _id: detectionId,
              complaintId,
              modelName: detectionResult.modelName,
              detected: detectionResult.detected,
              confidence: detectionResult.confidence,
              boundingBoxes: detectionResult.boundingBoxes,
              rawResult: detectionResult.rawResult,
            },
          ],
          { session }
        );
        savedDetection = createdDetection;
      }

      await StatusHistory.create(
        [
          {
            complaintId,
            changedBy: citizenObjectId,
            previousStatus: null,
            newStatus: "pending",
            note: statusNote,
          },
        ],
        { session }
      );
    });

    return {
      complaint: savedComplaint.toObject(),
      detection: savedDetection ? savedDetection.toObject() : null,
    };
  } catch (error) {
    if (!isTransactionUnsupportedError(error)) {
      throw error;
    }

    // Fallback for standalone MongoDB deployments without replica set support.
    return persistWithCompensatingRollback({
      citizenObjectId,
      complaintPayload,
      detectionResult,
      statusNote,
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Sequential persistence with best-effort compensating deletes if any step fails.
 */
async function persistWithCompensatingRollback({
  citizenObjectId,
  complaintPayload,
  detectionResult,
  statusNote,
}) {
  let createdComplaint = null;
  let createdDetection = null;
  let createdHistory = null;

  try {
    createdComplaint = await Complaint.create(complaintPayload);

    if (detectionResult) {
      createdDetection = await Detection.create({
        complaintId: createdComplaint._id,
        modelName: detectionResult.modelName,
        detected: detectionResult.detected,
        confidence: detectionResult.confidence,
        boundingBoxes: detectionResult.boundingBoxes,
        rawResult: detectionResult.rawResult,
      });

      createdComplaint.detectionId = createdDetection._id;
      await createdComplaint.save();
    }

    createdHistory = await StatusHistory.create({
      complaintId: createdComplaint._id,
      changedBy: citizenObjectId,
      previousStatus: null,
      newStatus: "pending",
      note: statusNote,
    });

    return {
      complaint: createdComplaint.toObject(),
      detection: createdDetection ? createdDetection.toObject() : null,
    };
  } catch (error) {
    if (createdHistory?._id) {
      await StatusHistory.deleteOne({ _id: createdHistory._id }).catch(
        () => {}
      );
    }
    if (createdDetection?._id) {
      await Detection.deleteOne({ _id: createdDetection._id }).catch(() => {});
    }
    if (createdComplaint?._id) {
      await Complaint.deleteOne({ _id: createdComplaint._id }).catch(() => {});
    }
    throw error;
  }
}

/**
 * Handles errors safely without leaking stack traces, connection strings, or secrets.
 *
 * @param {unknown} error
 * @param {string} contextLabel
 */
function handleComplaintsRouteError(error, contextLabel) {
  const err = /** @type {{ code?: string | number, name?: string, message?: string }} */ (
    error
  );

  if (err?.code === "MISSING_CLOUDINARY_CONFIG") {
    return NextResponse.json(
      { error: "Image storage service is not configured." },
      { status: 503 }
    );
  }

  if (err?.code === "INVALID_IMAGE_URL") {
    return NextResponse.json(
      { error: err.message || "Invalid Cloudinary complaint image URL." },
      { status: 400 }
    );
  }

  if (err?.code === "MISSING_AUTH_SECRET" || err?.code === "MISSING_MONGODB_URI") {
    console.error(`[${contextLabel}] Configuration error:`, err.code);
    return NextResponse.json(
      { error: "Service configuration is incomplete." },
      { status: 500 }
    );
  }

  if (err?.name === "ValidationError" || err?.name === "CastError") {
    return NextResponse.json(
      { error: "Invalid complaint data provided." },
      { status: 400 }
    );
  }

  console.error(
    `[${contextLabel}] Unexpected error:`,
    err?.name || "ComplaintError"
  );
  return NextResponse.json(
    { error: "Unable to process complaint request right now. Please try again later." },
    { status: 500 }
  );
}

/**
 * POST /api/citizen/complaints
 * Creates a citizen pothole complaint, runs authoritative server-side AI
 * pothole detection, and records initial status history.
 */
export async function POST(request) {
  await connection();

  try {
    const auth = await requireApiAuth("citizen");
    if (auth.response) {
      return auth.response;
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsed = createComplaintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: formatZodErrors(parsed.error),
        },
        { status: 400 }
      );
    }

    await connectDB();

    const isPotholeReport = (parsed.data.reportCategory || "pothole") === "pothole";
    const { detectionStatus, detectionResult } = isPotholeReport
      ? await runAuthoritativeDetection(parsed.data.imageUrl)
      : { detectionStatus: "not_applicable", detectionResult: null };

    const citizenObjectId = new mongoose.Types.ObjectId(auth.user.id);
    const { complaint, detection } = await persistComplaintRecords({
      citizenObjectId,
      validatedInput: parsed.data,
      detectionResult,
    });

    return NextResponse.json(
      {
        complaint: serializeComplaint(complaint, detection),
        detectionStatus,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleComplaintsRouteError(error, "CitizenComplaints:POST");
  }
}

/**
 * GET /api/citizen/complaints
 * Returns paginated complaints belonging strictly to the authenticated citizen,
 * sorted newest first, with associated detection details when available.
 */
export async function GET(request) {
  await connection();

  try {
    const auth = await requireApiAuth("citizen");
    if (auth.response) {
      return auth.response;
    }

    const rawParams = {};
    const searchParams = request.nextUrl.searchParams;
    if (searchParams.has("page")) {
      rawParams.page = searchParams.get("page");
    }
    if (searchParams.has("limit")) {
      rawParams.limit = searchParams.get("limit");
    }

    const parsedQuery = listComplaintsQuerySchema.safeParse(rawParams);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters.",
          details: formatZodErrors(parsedQuery.error),
        },
        { status: 400 }
      );
    }

    const { page, limit } = parsedQuery.data;
    const skip = (page - 1) * limit;

    await connectDB();

    const citizenObjectId = new mongoose.Types.ObjectId(auth.user.id);
    const filter = { citizenId: citizenObjectId };

    const [total, complaintDocs] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .select(COMPLAINT_PUBLIC_FIELDS)
        .lean(),
    ]);

    const complaintIds = complaintDocs.map((doc) => doc._id);
    const detectionIds = complaintDocs
      .map((doc) => doc.detectionId)
      .filter(Boolean);

    const [detectionDocs, historyDocs, latestRepairDocs] = await Promise.all([
      detectionIds.length > 0
        ? Detection.find({ _id: { $in: detectionIds } })
            .select("modelName detected confidence boundingBoxes createdAt")
            .lean()
        : [],
      complaintIds.length > 0
        ? StatusHistory.find({ complaintId: { $in: complaintIds } })
            .sort({ timestamp: -1, _id: -1 })
            .select("complaintId changedBy previousStatus newStatus note timestamp")
            .lean()
        : [],
      complaintIds.length > 0
        ? RepairVerification.aggregate([
            { $match: { complaintId: { $in: complaintIds } } },
            { $sort: { createdAt: -1, _id: -1 } },
            {
              $group: {
                _id: "$complaintId",
                verificationId: { $first: "$_id" },
                afterImage: { $first: "$afterImage" },
                repairNotes: { $first: "$repairNotes" },
                verificationStatus: { $first: "$verificationStatus" },
                createdAt: { $first: "$createdAt" },
              },
            },
          ])
        : [],
    ]);

    const actorIds = Array.from(
      new Set(historyDocs.map((h) => h.changedBy).filter(Boolean).map(String))
    );
    const actorDocs =
      actorIds.length > 0
        ? await User.find({ _id: { $in: actorIds } })
            .select("role")
            .lean()
        : [];
    const actorRoleById = new Map(
      actorDocs.map((u) => [String(u._id), u.role])
    );

    const historyByComplaintId = new Map();
    for (const hist of historyDocs) {
      const key = String(hist.complaintId);
      if (!historyByComplaintId.has(key)) {
        historyByComplaintId.set(key, []);
      }
      historyByComplaintId.get(key).push({
        id: String(hist._id),
        previousStatus: hist.previousStatus ?? null,
        newStatus: hist.newStatus,
        note: hist.note || "",
        timestamp: hist.timestamp,
        changedByRole: hist.changedBy
          ? actorRoleById.get(String(hist.changedBy)) || null
          : null,
      });
    }

    const repairByComplaintId = new Map(
      latestRepairDocs.map((row) => [
        String(row._id),
        {
          _id: row.verificationId,
          afterImage: row.afterImage,
          repairNotes: row.repairNotes,
          verificationStatus: row.verificationStatus,
          createdAt: row.createdAt,
        },
      ])
    );

    const detectionsById = new Map(
      detectionDocs.map((doc) => [String(doc._id), doc])
    );

    const complaints = complaintDocs.map((doc) => {
      const idStr = String(doc._id);
      const detectionDoc = doc.detectionId
        ? detectionsById.get(String(doc.detectionId)) || null
        : null;
      return serializeComplaint(
        doc,
        detectionDoc,
        historyByComplaintId.get(idStr) || [],
        repairByComplaintId.get(idStr) || null
      );
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return NextResponse.json(
      {
        complaints,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleComplaintsRouteError(error, "CitizenComplaints:GET");
  }
}
