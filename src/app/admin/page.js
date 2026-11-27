import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import AdminDashboardClient from "@/components/dashboard/AdminDashboardClient";
import RoleAccessNotice from "@/components/dashboard/RoleAccessNotice";

export const metadata = {
  title: "Admin Operations | RoadGuard AI",
  description:
    "Verify pothole complaints, assign field workers, and approve repair verifications.",
};

function AdminLoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F1E8] font-sans text-[#292D2A]">
      <div className="flex flex-col items-center gap-3 border border-[#DEDCCF] bg-[#FAF8F2] px-8 py-6 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#233B32] border-t-transparent" />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#777B70]">
          Loading Admin Console
        </p>
      </div>
    </div>
  );
}

async function AdminDashboardGate() {
  const auth = await requireAuth();

  if (!auth.user) {
    redirect("/login");
  }

  if (auth.user.role !== "admin") {
    return (
      <RoleAccessNotice
        role={auth.user.role}
        portalName="Admin Operations Console"
        requiredRole="admin"
      />
    );
  }

  return <AdminDashboardClient initialUser={auth.user} />;
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminLoadingShell />}>
      <AdminDashboardGate />
    </Suspense>
  );
}
