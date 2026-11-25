import { connection, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireApiAuth } from "@/lib/auth";
import Complaint from "@/models/Complaint";

/**
 * GET /api/citizen/dashboard
 * Returns complaint statistics and the 5 most recent complaints
 * belonging strictly to the currently authenticated citizen.
 */
export async function GET() {
  await connection();

  try {
    const auth = await requireApiAuth("citizen");
    if (auth.response) {
      return auth.response;
    }

    const citizenObjectId = new mongoose.Types.ObjectId(auth.user.id);

    const [statusCounts, recentDocs] = await Promise.all([
      Complaint.aggregate([
        { $match: { citizenId: citizenObjectId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Complaint.find({ citizenId: citizenObjectId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          "title description imageUrl location priority status createdAt updatedAt"
        )
        .lean(),
    ]);

    const countsByStatus = Object.fromEntries(
      statusCounts.map((entry) => [entry._id, entry.count])
    );

    const total = statusCounts.reduce((sum, entry) => sum + entry.count, 0);
    const stats = {
      total,
      pending: countsByStatus.pending || 0,
      in_progress: countsByStatus.in_progress || 0,
      resolved: countsByStatus.resolved || 0,
    };

    const recentComplaints = recentDocs.map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      description: doc.description,
      imageUrl: doc.imageUrl,
      location: {
        latitude: doc.location?.latitude ?? null,
        longitude: doc.location?.longitude ?? null,
        address: doc.location?.address || "",
      },
      priority: doc.priority,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    return NextResponse.json(
      {
        user: auth.user,
        stats,
        recentComplaints,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[CitizenDashboard] Failed to load dashboard:",
      error?.name || "Error"
    );

    return NextResponse.json(
      { error: "Unable to load citizen dashboard data." },
      { status: 500 }
    );
  }
}
