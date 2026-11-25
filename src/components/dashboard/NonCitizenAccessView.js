"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert, LogOut } from "lucide-react";
import { RoadGuardWordmark } from "./UrbanMotifs";

/**
 * Shown when an authenticated admin or worker tries to open /dashboard.
 *
 * @param {{ role: string }} props
 */
export default function NonCitizenAccessView({ role }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F1E8] px-4 py-12 font-sans text-[#292D2A]">
      <div className="mb-8">
        <RoadGuardWordmark />
      </div>

      <div className="w-full max-w-md border border-[#DEDCCF] bg-[#FAF8F2] p-8">
        <div className="flex items-center gap-3 border-b border-[#DEDCCF] pb-4">
          <div className="flex h-10 w-10 items-center justify-center border border-[#A65F45]/40 bg-[#A65F45]/10 text-[#A65F45]">
            <ShieldAlert className="h-5 w-5" strokeWidth={1.6} />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
              Access Notice · 403
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-[#292D2A]">
              Citizen Portal Restricted
            </h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-[#777B70]">
          You are signed in under the{" "}
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#233B32]">
            {role}
          </span>{" "}
          role. This civic workspace is reserved strictly for citizen accounts.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="flex h-10 flex-1 items-center justify-center border border-[#DEDCCF] bg-[#F4F1E8] px-4 text-sm font-medium text-[#292D2A] transition-colors hover:border-[#233B32]"
          >
            Return Home
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="flex h-10 flex-1 items-center justify-center gap-2 bg-[#233B32] px-4 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.6} />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
