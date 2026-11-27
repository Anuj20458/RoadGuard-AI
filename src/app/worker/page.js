import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import RoleAccessNotice from "@/components/dashboard/RoleAccessNotice";
import WorkerDashboardClient from "@/components/dashboard/WorkerDashboardClient";

export const metadata = {
  title: "Worker Portal | RoadGuard AI",
  description:
    "View assigned pothole complaints, update work status, and submit after-repair evidence.",
};

function WorkerLoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F1E8] font-sans text-[#292D2A]">
      <div className="flex flex-col items-center gap-3 border border-[#DEDCCF] bg-[#FAF8F2] px-8 py-6 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#233B32] border-t-transparent" />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#777B70]">
          Loading Worker Portal
        </p>
      </div>
    </div>
  );
}

async function WorkerDashboardGate() {
  const auth = await requireAuth();

  if (!auth.user) {
    redirect("/login");
  }

  if (auth.user.role !== "worker") {
    return (
      <RoleAccessNotice
        role={auth.user.role}
        portalName="Field Worker Portal"
        requiredRole="worker"
      />
    );
  }

  return <WorkerDashboardClient initialUser={auth.user} />;
}

export default function WorkerDashboardPage() {
  return (
    <Suspense fallback={<WorkerLoadingShell />}>
      <WorkerDashboardGate />
    </Suspense>
  );
}
