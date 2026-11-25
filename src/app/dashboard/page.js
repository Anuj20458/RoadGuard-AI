import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import CitizenDashboardClient from "@/components/dashboard/CitizenDashboardClient";
import NonCitizenAccessView from "@/components/dashboard/NonCitizenAccessView";

export const metadata = {
  title: "Citizen Dashboard | RoadGuard AI",
  description:
    "View your submitted pothole complaints and municipal repair progress.",
};

function DashboardLoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F1E8] font-sans text-[#292D2A]">
      <div className="flex flex-col items-center gap-3 border border-[#DEDCCF] bg-[#FAF8F2] px-8 py-6 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#233B32] border-t-transparent" />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#777B70]">
          Loading Citizen Observatory
        </p>
      </div>
    </div>
  );
}

async function CitizenDashboardGate() {
  const auth = await requireAuth();

  if (!auth.user) {
    redirect("/login");
  }

  if (auth.user.role !== "citizen") {
    return <NonCitizenAccessView role={auth.user.role} />;
  }

  return <CitizenDashboardClient initialUser={auth.user} />;
}

export default function CitizenDashboardPage() {
  return (
    <Suspense fallback={<DashboardLoadingShell />}>
      <CitizenDashboardGate />
    </Suspense>
  );
}
