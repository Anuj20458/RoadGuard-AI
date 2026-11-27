import { NextResponse } from "next/server";
import Assignment from "@/models/Assignment";
import Complaint from "@/models/Complaint";
import Detection from "@/models/Detection";
import RepairVerification from "@/models/RepairVerification";
import StatusHistory from "@/models/StatusHistory";
import User from "@/models/User";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export const COMPLAINT_PUBLIC_FIELDS =
  "citizenId title description imageUrl location priority reportCategory roadType authorityCategory status detectionId createdAt updatedAt";

/**
 * Serializes a Complaint location subdocument, preserving legacy records
 * without fabricating missing address fields.
 *
 * @param {Record<string, any> | null | undefined} location
 */
export function serializeLocation(location) {
  return {
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    address: location?.address || "",
    country: location?.country || "",
    state: location?.state || "",
    district: location?.district || "",
    city: location?.city || "",
    ward: location?.ward || "",
    pinCode: location?.pinCode || "",
  };
}

/**
 * Serializes a Detection document into a consistent client-facing summary,
 * returning `null` when AI detection was unavailable.
 *
 * @param {Record<string, any> | null | undefined} detectionDoc
 */
export function serializeDetection(detectionDoc) {
  if (!detectionDoc) {
    return null;
  }

  return {
    id: String(detectionDoc._id),
    modelName: detectionDoc.modelName || "",
    detected: Boolean(detectionDoc.detected),
    confidence:
      typeof detectionDoc.confidence === "number" &&
      Number.isFinite(detectionDoc.confidence)
        ? detectionDoc.confidence
        : 0,
    boundingBoxes: Array.isArray(detectionDoc.boundingBoxes)
      ? detectionDoc.boundingBoxes
      : [],
    createdAt: detectionDoc.createdAt ?? null,
  };
}

/**
 * Computes authoritative MongoDB status counts and pending repair verification
 * count for the admin operations dashboard.
 */
export async function getAdminDashboardStats() {
  const [statusCounts, pendingRepairCount] = await Promise.all([
    Complaint.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    RepairVerification.countDocuments({ verificationStatus: "pending" }),
  ]);

  const countsByStatus = Object.fromEntries(
    statusCounts.map((entry) => [entry._id, entry.count || 0])
  );
  const totalAll = statusCounts.reduce(
    (sum, entry) => sum + (entry.count || 0),
    0
  );
  const pending = countsByStatus.pending || 0;
  const verified = countsByStatus.verified || 0;
  const assigned = countsByStatus.assigned || 0;
  const inProgress = countsByStatus.in_progress || 0;
  const resolved = countsByStatus.resolved || 0;
  const rejected = countsByStatus.rejected || 0;

  return {
    total: totalAll,
    pending,
    verified,
    assigned,
    in_progress: inProgress,
    verifiedActive: verified + assigned + inProgress,
    resolved,
    rejected,
    pendingRepairs: pendingRepairCount || 0,
  };
}

/**
 * Safely parses JSON request body, returning `{ data, errorResponse }`.
 *
 * @param {Request} request
 */
export async function parseJsonBody(request) {
  try {
    const data = await request.json();
    return { data, errorResponse: null };
  } catch {
    return {
      data: null,
      errorResponse: NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      ),
    };
  }
}

/**
 * Maps unexpected operational route errors to safe HTTP responses without
 * leaking stack traces, connection strings, or environment secrets.
 *
 * @param {unknown} error
 * @param {string} contextLabel
 */
export function handleOperationsRouteError(error, contextLabel) {
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
      { error: err.message || "Invalid Cloudinary image URL." },
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

  if (err?.code === 11000) {
    return NextResponse.json(
      { error: "A conflicting record already exists." },
      { status: 409 }
    );
  }

  if (err?.name === "ValidationError" || err?.name === "CastError") {
    return NextResponse.json(
      { error: "Invalid request data provided." },
      { status: 400 }
    );
  }

  console.error(
    `[${contextLabel}] Unexpected error:`,
    err?.name || "OperationError"
  );
  return NextResponse.json(
    { error: "Unable to process request right now. Please try again later." },
    { status: 500 }
  );
}

/**
 * Returns the most recent Assignment record for a given complaintId.
 *
 * @param {import("mongoose").Types.ObjectId | string} complaintId
 */
export async function getLatestAssignmentForComplaint(complaintId) {
  return Assignment.findOne({ complaintId })
    .sort({ assignedAt: -1, _id: -1 })
    .lean();
}

/**
 * Lists all real worker accounts from MongoDB along with each worker's count
 * of currently active assignments (`assigned` or `in_progress`).
 */
export async function listWorkersWithLoad() {
  const [workers, activeLatestAssignments] = await Promise.all([
    User.find({ role: "worker" })
      .sort({ createdAt: -1, _id: -1 })
      .select("name email phone role createdAt")
      .lean(),
    Assignment.aggregate([
      { $sort: { assignedAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$complaintId",
          workerId: { $first: "$workerId" },
        },
      },
      {
        $lookup: {
          from: Complaint.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "complaint",
        },
      },
      { $unwind: "$complaint" },
      {
        $match: {
          "complaint.status": { $in: ["assigned", "in_progress"] },
        },
      },
      {
        $group: {
          _id: "$workerId",
          activeAssignments: { $sum: 1 },
        },
      },
    ]),
  ]);

  const activeCountByWorker = new Map(
    activeLatestAssignments.map((entry) => [
      String(entry._id),
      entry.activeAssignments || 0,
    ])
  );

  return workers.map((worker) => ({
    id: String(worker._id),
    name: worker.name,
    email: worker.email,
    phone: worker.phone || "",
    createdAt: worker.createdAt,
    activeAssignments: activeCountByWorker.get(String(worker._id)) || 0,
  }));
}

/**
 * Hydrates and serializes an array of Complaint lean documents with citizen info,
 * AI detection results, latest worker assignment, latest repair verification,
 * and chronological status history.
 *
 * @param {Array<Record<string, any>>} complaintDocs
 */
export async function hydrateComplaints(complaintDocs) {
  if (!Array.isArray(complaintDocs) || complaintDocs.length === 0) {
    return [];
  }

  const complaintIds = complaintDocs.map((doc) => doc._id);
  const detectionIds = complaintDocs.map((doc) => doc.detectionId).filter(Boolean);

  const [
    detectionDocs,
    latestAssignmentRows,
    latestVerificationRows,
    historyDocs,
  ] = await Promise.all([
    detectionIds.length > 0 || complaintIds.length > 0
      ? Detection.find({
          $or: [
            ...(detectionIds.length > 0 ? [{ _id: { $in: detectionIds } }] : []),
            { complaintId: { $in: complaintIds } },
          ],
        })
          .select("complaintId modelName detected confidence boundingBoxes createdAt")
          .lean()
      : [],
    Assignment.aggregate([
      { $match: { complaintId: { $in: complaintIds } } },
      { $sort: { assignedAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$complaintId",
          assignmentId: { $first: "$_id" },
          workerId: { $first: "$workerId" },
          assignedBy: { $first: "$assignedBy" },
          assignedAt: { $first: "$assignedAt" },
        },
      },
    ]),
    RepairVerification.aggregate([
      { $match: { complaintId: { $in: complaintIds } } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$complaintId",
          verificationId: { $first: "$_id" },
          workerId: { $first: "$workerId" },
          beforeImage: { $first: "$beforeImage" },
          afterImage: { $first: "$afterImage" },
          repairNotes: { $first: "$repairNotes" },
          verificationStatus: { $first: "$verificationStatus" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$updatedAt" },
        },
      },
    ]),
    StatusHistory.find({ complaintId: { $in: complaintIds } })
      .sort({ timestamp: -1, _id: -1 })
      .select("complaintId changedBy previousStatus newStatus note timestamp")
      .lean(),
  ]);

  // Gather all referenced User IDs across citizens, workers, admins, and history actors.
  const userIdSet = new Set();
  for (const doc of complaintDocs) {
    if (doc.citizenId) userIdSet.add(String(doc.citizenId));
  }
  for (const row of latestAssignmentRows) {
    if (row.workerId) userIdSet.add(String(row.workerId));
    if (row.assignedBy) userIdSet.add(String(row.assignedBy));
  }
  for (const row of latestVerificationRows) {
    if (row.workerId) userIdSet.add(String(row.workerId));
  }
  for (const hist of historyDocs) {
    if (hist.changedBy) userIdSet.add(String(hist.changedBy));
  }

  const userIds = Array.from(userIdSet);
  const userDocs =
    userIds.length > 0
      ? await User.find({ _id: { $in: userIds } })
          .select("name email phone role")
          .lean()
      : [];

  const usersById = new Map(userDocs.map((u) => [String(u._id), u]));
  const detectionsById = new Map(
    detectionDocs.map((d) => [String(d._id), d])
  );
  const detectionsByComplaintId = new Map(
    detectionDocs
      .filter((d) => d.complaintId)
      .map((d) => [String(d.complaintId), d])
  );
  const assignmentsByComplaintId = new Map(
    latestAssignmentRows.map((a) => [String(a._id), a])
  );
  const verificationsByComplaintId = new Map(
    latestVerificationRows.map((v) => [String(v._id), v])
  );

  const historyByComplaintId = new Map();
  for (const hist of historyDocs) {
    const key = String(hist.complaintId);
    if (!historyByComplaintId.has(key)) {
      historyByComplaintId.set(key, []);
    }
    const actor = hist.changedBy ? usersById.get(String(hist.changedBy)) : null;
    historyByComplaintId.get(key).push({
      id: String(hist._id),
      previousStatus: hist.previousStatus ?? null,
      newStatus: hist.newStatus,
      note: hist.note || "",
      timestamp: hist.timestamp,
      changedBy: hist.changedBy ? String(hist.changedBy) : null,
      changedByName: actor?.name || "System User",
      changedByRole: actor?.role || null,
    });
  }

  return complaintDocs.map((doc) => {
    const complaintIdStr = String(doc._id);
    const citizen = doc.citizenId
      ? usersById.get(String(doc.citizenId)) || null
      : null;
    const detection =
      (doc.detectionId
        ? detectionsById.get(String(doc.detectionId)) || null
        : null) ||
      detectionsByComplaintId.get(complaintIdStr) ||
      null;
    const assignmentRow = assignmentsByComplaintId.get(complaintIdStr) || null;
    const assignedWorker = assignmentRow?.workerId
      ? usersById.get(String(assignmentRow.workerId)) || null
      : null;
    const assignedAdmin = assignmentRow?.assignedBy
      ? usersById.get(String(assignmentRow.assignedBy)) || null
      : null;
    const verificationRow =
      verificationsByComplaintId.get(complaintIdStr) || null;
    const verificationWorker = verificationRow?.workerId
      ? usersById.get(String(verificationRow.workerId)) || null
      : null;

    return {
      id: complaintIdStr,
      title: doc.title,
      description: doc.description,
      imageUrl: doc.imageUrl,
      location: serializeLocation(doc.location),
      priority: doc.priority,
      reportCategory: doc.reportCategory || "pothole",
      roadType: doc.roadType || "",
      authorityCategory: doc.authorityCategory || "",
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      citizen: citizen
        ? {
            id: String(citizen._id),
            name: citizen.name,
            email: citizen.email,
            phone: citizen.phone || "",
          }
        : null,
      detection: serializeDetection(detection),
      assignment: assignmentRow
        ? {
            id: String(assignmentRow.assignmentId),
            workerId: String(assignmentRow.workerId),
            workerName: assignedWorker?.name || "Worker Account",
            workerEmail: assignedWorker?.email || "",
            workerPhone: assignedWorker?.phone || "",
            assignedBy: String(assignmentRow.assignedBy),
            assignedByName: assignedAdmin?.name || "Admin",
            assignedAt: assignmentRow.assignedAt,
          }
        : null,
      repairVerification: verificationRow
        ? {
            id: String(verificationRow.verificationId),
            workerId: String(verificationRow.workerId),
            workerName: verificationWorker?.name || "Worker Account",
            beforeImage: verificationRow.beforeImage,
            afterImage: verificationRow.afterImage,
            repairNotes: verificationRow.repairNotes || "",
            verificationStatus: verificationRow.verificationStatus,
            createdAt: verificationRow.createdAt,
            updatedAt: verificationRow.updatedAt,
          }
        : null,
      statusHistory: historyByComplaintId.get(complaintIdStr) || [],
    };
  });
}
