"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Plus,
  User as UserIcon,
  LogOut,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { PriorityBadge, StatusBadge } from "./StatusBadge";
import {
  RoadGuardWordmark,
  RoadLineDivider,
  TopographicContours,
} from "./UrbanMotifs";

const NAV_ITEMS = [
  { id: "dashboard", index: "01", label: "Dashboard", icon: LayoutDashboard },
  { id: "complaints", index: "02", label: "My Complaints", icon: FileText },
  { id: "report", index: "03", label: "Report a Pothole", icon: Plus },
  { id: "profile", index: "04", label: "Profile", icon: UserIcon },
];

const STAT_METRICS = [
  {
    key: "total",
    code: "IDX-01",
    label: "Total Reports",
    note: "Logged under your record",
    numberColor: "text-[#292D2A]",
  },
  {
    key: "pending",
    code: "IDX-02",
    label: "Pending Review",
    note: "Awaiting municipal triage",
    numberColor: "text-[#A65F45]",
  },
  {
    key: "in_progress",
    code: "IDX-03",
    label: "In Progress",
    note: "Assigned to field crews",
    numberColor: "text-[#292D2A]",
  },
  {
    key: "resolved",
    code: "IDX-04",
    label: "Resolved",
    note: "Completed road repairs",
    numberColor: "text-[#233B32]",
  },
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLocation(location) {
  if (location?.address) {
    return location.address;
  }
  if (
    typeof location?.latitude === "number" &&
    typeof location?.longitude === "number"
  ) {
    return `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`;
  }
  return "Coordinates pending";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 border border-[#DEDCCF] bg-[#FAF8F2] lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="border-b rounded-lg bg-[#FAF8F2] border border-[#DEDCCF]/30 p-4 sm:p-5"
          >
            <div className="h-3 w-20 animate-pulse bg-[#E7E3D4]" />
            <div className="mt-5 h-10 w-16 animate-pulse bg-[#E7E3D4]" />
            <div className="mt-3 h-3 w-28 animate-pulse bg-[#E7E3D4]" />
          </div>
        ))}
      </div>

      <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-6">
        <div className="mb-6 h-4 w-48 animate-pulse bg-[#E7E3D4]" />
        <div className="space-y-4">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-14 animate-pulse border-b border-[#DEDCCF]/70 bg-[#EFECE1]/70"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Editorial civic-tech Citizen Dashboard client view.
 * Preserves existing auth, GET /api/citizen/dashboard fetching,
 * real statistics/complaints, and logout behavior.
 *
 * @param {{ initialUser: { id: string, name: string, email: string, role: string, phone?: string, createdAt?: string } }} props
 */
export default function CitizenDashboardClient({ initialUser }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(initialUser);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
  });
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    const res = await fetch("/api/citizen/dashboard", { cache: "no-store" });
    if (res.status === 401) {
      return { unauthorized: true };
    }
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || "Unable to load your dashboard data." };
    }
    return { data };
  }, []);

  const applyDashboardResult = useCallback(
    (result) => {
      if (result.unauthorized) {
        router.push("/login");
        router.refresh();
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      const { data } = result;
      if (data.user) {
        setUser(data.user);
      }
      if (data.stats) {
        setStats(data.stats);
      }
      setRecentComplaints(
        Array.isArray(data.recentComplaints) ? data.recentComplaints : []
      );
    },
    [router]
  );

  useEffect(() => {
    let active = true;

    async function initDashboard() {
      try {
        const result = await fetchDashboardData();
        if (active) {
          applyDashboardResult(result);
        }
      } catch {
        if (active) {
          setError("Network error while loading your dashboard. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initDashboard();
    return () => {
      active = false;
    };
  }, [fetchDashboardData, applyDashboardResult]);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const result = await fetchDashboardData();
      applyDashboardResult(result);
    } catch {
      setError("Network error while loading your dashboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  function handleSelectTab(tabId) {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  }

  const activeNavItem =
    NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen bg-[#F4F1E8] font-sans text-[#292D2A]">
      {/* Mobile drawer backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#292D2A]/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Architectural Navigation Rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-[#DEDCCF] bg-[#EFECE1] transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between border-b border-[#DEDCCF] px-6">
          <RoadGuardWordmark compact />
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-[#A65F45] sm:inline">
              {activeNavItem.index} /
            </span>
            <h1 className="text-base font-semibold tracking-tight text-[#292D2A] sm:text-lg">
              {activeNavItem.label}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="border border-[#DEDCCF] p-1.5 text-[#292D2A] hover:border-[#233B32] lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>

        {/* Navigation Links */}
        <div >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
            
          </p>
        </div>

        <nav
  className="flex flex-1 flex-col items-center gap-2 px-2 py-4"
  aria-label="Citizen navigation"
>
  {NAV_ITEMS.map((item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleSelectTab(item.id)}
        className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
          isActive
            ? "bg-[#F4F1E8] text-[#233B32]"
            : "text-[#889286] hover:bg-[#F4F1E8] hover:text-[#292D2A]"
        }`}
        aria-label={`Navigate to ${item.label}`}
        title={item.label}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </button>
    );
  })}
</nav>


        {/* Citizen Identity Footer & Logout */}
        <div className="border-t border-[#DEDCCF] p-5">
          <div className="mb-4 border border-[#DEDCCF] bg-[#FAF8F2] p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#777B70]">
                Active Citizen
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#233B32]"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1.5 truncate text-sm font-medium text-[#292D2A]">
              {user?.name}
            </p>
            <p className="truncate font-mono text-[11px] text-[#777B70]">
              {user?.email}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-between border border-[#DEDCCF] bg-[#F4F1E8] px-3.5 py-2.5 text-sm font-medium text-[#292D2A] transition-colors hover:border-[#A65F45] hover:text-[#864832] disabled:opacity-50"
          >
            <span className="flex items-center gap-2.5">
              <LogOut className="h-4 w-4" strokeWidth={1.6} />
              <span>{loggingOut ? "Signing out..." : "Logout"}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[#777B70]" strokeWidth={1.6} />
          </button>
        </div>
      </aside>

      {/* Main Editorial Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#DEDCCF] bg-[#F4F1E8]/95 px-4 backdrop-blur-xs sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="border border-[#DEDCCF] bg-[#FAF8F2] p-2 text-[#292D2A] hover:border-[#233B32] lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.6} />
            </button>
            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-[#A65F45] sm:inline">
                {activeNavItem.index} /
              </span>
              <h1 className="text-base font-semibold tracking-tight text-[#292D2A] sm:text-lg">
                {activeNavItem.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[11px] uppercase tracking-wider text-[#777B70] md:inline">
              {todayLabel}
            </span>
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="inline-flex items-center gap-2 border border-[#DEDCCF] bg-[#FAF8F2] px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32] hover:text-[#233B32] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                strokeWidth={1.6}
              />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto max-w-6xl space-y-10">
            {/* Asymmetrical Editorial Welcome Section */}
            <section className="relative overflow-hidden border border-[#DEDCCF] bg-[#FAF8F2]">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left Column: Editorial Greeting & Primary Action */}
                <div className="relative z-10 p-6 sm:p-8 lg:col-span-8 lg:border-r lg:border-[#DEDCCF] lg:p-10">
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-3/4 opacity-80">
                    <TopographicContours />
                  </div>

                  <div className="relative z-10 max-w-2xl">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#A65F45]">
                      Municipal Infrastructure Brief
                    </p>
                    <h2 className="mt-3 text-3xl font-light tracking-tight text-[#292D2A] sm:text-4xl">
                      Welcome,{" "}
                      <span className="font-semibold text-[#233B32]">
                        {user?.name}
                      </span>
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#777B70] sm:text-base">
                      Your civic ledger tracks road surface hazards reported to
                      city maintenance teams—from initial triage through field
                      verification.
                    </p>

                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectTab("report")}
                        className="inline-flex items-center gap-2.5 bg-[#233B32] px-5 py-2.5 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27]"
                      >
                        <Plus className="h-4 w-4 text-[#DEDCCF]" strokeWidth={1.8} />
                        <span>Report a Pothole</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTab("complaints")}
                        className="inline-flex items-center gap-2 border border-[#DEDCCF] bg-[#F4F1E8] px-4 py-2.5 text-sm font-medium text-[#292D2A] transition-colors hover:border-[#233B32]"
                      >
                        <span>Inspect Ledger</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#777B70]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Asymmetrical Civic Summary Strip */}
                <div className="flex flex-col justify-between bg-[#EFECE1]/75 p-6 sm:p-8 lg:col-span-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#DEDCCF] pb-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        Account Status
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#233B32]">
                        Citizen
                      </span>
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-xs text-[#777B70]">Member Since</dt>
                        <dd className="font-mono text-xs text-[#292D2A]">
                          {formatDate(user?.createdAt)}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-xs text-[#777B70]">Active Queue</dt>
                        <dd className="font-mono text-xs text-[#A65F45]">
                          {stats.pending + stats.in_progress} open
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-xs text-[#777B70]">Resolved Cases</dt>
                        <dd className="font-mono text-xs text-[#233B32]">
                          {stats.resolved} closed
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Subtle road-grid footer mark */}
                  <div className="mt-6 border-t border-dashed border-[#DEDCCF] pt-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#777B70]">
                      RoadGuard · Citizen Maintenance Channel
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Error State */}
            {error && (
              <div
                role="alert"
                className="flex flex-col items-start justify-between gap-4 border border-[#A65F45]/50 bg-[#FAF8F2] p-5 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3 text-sm text-[#292D2A]">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#A65F45]"
                    strokeWidth={1.8}
                  />
                  <div>
                    <p className="font-medium">Unable to sync dashboard data</p>
                    <p className="text-xs text-[#777B70]">{error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loadDashboard}
                  className="shrink-0 border border-[#A65F45] bg-[#A65F45] px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-[#F4F1E8] transition-colors hover:bg-[#8E4F38]"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Main View Switching */}
            {activeTab === "report" ? (
              <section className="space-y-6">
                <RoadLineDivider label="03 / New Hazard Submission" />
                <div className="grid grid-cols-1 border border-[#DEDCCF] bg-[#FAF8F2] lg:grid-cols-12">
                  <div className="p-6 sm:p-10 lg:col-span-8 lg:border-r lg:border-[#DEDCCF]">
                    <span className="inline-block border border-[#A65F45]/40 bg-[#A65F45]/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#864832]">
                      Upcoming Module
                    </span>
                    <h3 className="mt-4 text-2xl font-light tracking-tight text-[#292D2A]">
                      Report a Road Pothole
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#777B70]">
                      In the next development stage, this workspace will connect
                      Cloudinary photo uploads, Roboflow AI pothole detection,
                      and an interactive OpenStreetMap pin selector so your
                      reports are verified automatically.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSelectTab("dashboard")}
                      className="mt-7 inline-flex items-center gap-2 bg-[#233B32] px-5 py-2.5 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27]"
                    >
                      Return to Overview
                    </button>
                  </div>
                  <div className="flex flex-col justify-between bg-[#EFECE1]/60 p-6 sm:p-8 lg:col-span-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        Pipeline Checklist
                      </p>
                      <ul className="mt-4 space-y-3 text-xs text-[#292D2A]">
                        <li className="flex items-center justify-between border-b border-[#DEDCCF] pb-2">
                          <span>1. Photo Capture</span>
                          <span className="font-mono text-[#777B70]">Cloudinary</span>
                        </li>
                        <li className="flex items-center justify-between border-b border-[#DEDCCF] pb-2">
                          <span>2. AI Inspection</span>
                          <span className="font-mono text-[#777B70]">Roboflow</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>3. Geolocation Pin</span>
                          <span className="font-mono text-[#777B70]">Leaflet / OSM</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            ) : activeTab === "profile" ? (
              <section className="space-y-6">
                <RoadLineDivider label="04 / Citizen Dossier" />
                <div className="border border-[#DEDCCF] bg-[#FAF8F2]">
                  <div className="border-b border-[#DEDCCF] px-6 py-5 sm:px-8">
                    <h3 className="text-lg font-semibold tracking-tight text-[#292D2A]">
                      Verified Account Details
                    </h3>
                    <p className="mt-0.5 text-xs text-[#777B70]">
                      Registered citizen information stored in RoadGuard AI.
                    </p>
                  </div>
                  <dl className="grid grid-cols-1 divide-y divide-[#DEDCCF] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                    <div className="p-6 sm:border-b sm:border-[#DEDCCF] sm:px-8">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        Full Name
                      </dt>
                      <dd className="mt-2 text-base font-medium text-[#292D2A]">
                        {user?.name || "—"}
                      </dd>
                    </div>
                    <div className="p-6 sm:border-b sm:border-[#DEDCCF] sm:px-8">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        Email Address
                      </dt>
                      <dd className="mt-2 font-mono text-sm text-[#292D2A]">
                        {user?.email || "—"}
                      </dd>
                    </div>
                    <div className="p-6 sm:px-8">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        Phone Number
                      </dt>
                      <dd className="mt-2 font-mono text-sm text-[#292D2A]">
                        {user?.phone || "Not provided"}
                      </dd>
                    </div>
                    <div className="p-6 sm:px-8">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        Role & Registration
                      </dt>
                      <dd className="mt-2 text-sm text-[#292D2A]">
                        <span className="font-mono text-xs uppercase tracking-wider text-[#233B32]">
                          {user?.role}
                        </span>{" "}
                        <span className="text-[#777B70]">
                          · Joined {formatDate(user?.createdAt)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            ) : loading ? (
              <DashboardSkeleton />
            ) : (
              <>
                {/* Minimal Typography-Led Statistics */}
                {activeTab === "dashboard" && (
                  <section aria-label="Complaint statistics" className="space-y-4">
                    <RoadLineDivider label="01 / Status Metrics" />

                    <div className="grid grid-cols-2 border border-[#DEDCCF] bg-[#FAF8F2] lg:grid-cols-4">
                      {STAT_METRICS.map((metric, idx) => (
                        <div
                          key={metric.key}
                          className={`p-6 sm:p-7 ${
                            idx % 2 === 0 ? "border-r border-[#DEDCCF]" : ""
                          } ${
                            idx < 2 ? "border-b border-[#DEDCCF] lg:border-b-0" : ""
                          } ${
                            idx < 3 ? "lg:border-r lg:border-[#DEDCCF]" : "lg:border-r-0"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                              {metric.label}
                            </span>
                            <span className="font-mono text-[10px] text-[#777B70]/70">
                              {metric.code}
                            </span>
                          </div>
                          <p
                            className={`mt-4 text-4xl font-light tracking-tight tabular-nums sm:text-5xl ${metric.numberColor}`}
                          >
                            {stats[metric.key] ?? 0}
                          </p>
                          <p className="mt-2 text-xs text-[#777B70]">
                            {metric.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Refined Complaint Tracking Interface */}
                <section className="space-y-4">
                  <RoadLineDivider
                    label={
                      activeTab === "complaints"
                        ? "02 / Complaint Docket"
                        : "02 / Recent Submissions"
                    }
                  />

                  <div className="border border-[#DEDCCF] bg-[#FAF8F2]">
                    <div className="flex flex-col justify-between gap-2 border-b border-[#DEDCCF] px-6 py-5 sm:flex-row sm:items-center sm:px-8">
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight text-[#292D2A]">
                          {activeTab === "complaints"
                            ? "My Recent Complaints"
                            : "Recent Complaints"}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#777B70]">
                          Tracking up to your 5 latest municipal submissions.
                        </p>
                      </div>
                      <span className="font-mono text-[11px] uppercase tracking-wider text-[#777B70]">
                        {recentComplaints.length}{" "}
                        {recentComplaints.length === 1 ? "entry" : "entries"}
                      </span>
                    </div>

                    {recentComplaints.length === 0 ? (
                      <div className="px-6 py-14 text-center sm:px-10">
                        {/* Subtle surveyor empty-state mark */}
                        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[#DEDCCF] bg-[#F4F1E8] text-[#233B32]">
                          <MapPin className="h-5 w-5" strokeWidth={1.5} />
                        </div>
                        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
                          Empty Ledger
                        </p>
                        <h4 className="mt-1.5 text-lg font-medium text-[#292D2A]">
                          No pothole complaints logged yet
                        </h4>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#777B70]">
                          Your citizen record is clean. When you report a road
                          surface hazard, its coordinates, priority, and repair
                          status will be tracked here.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleSelectTab("report")}
                          className="mt-6 inline-flex items-center gap-2 bg-[#233B32] px-5 py-2.5 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27]"
                        >
                          <Plus className="h-4 w-4" strokeWidth={1.8} />
                          <span>Report a Pothole</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Desktop & Tablet Editorial Ledger Table */}
                        <div className="hidden overflow-x-auto md:block">
                          <table className="w-full border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-[#DEDCCF] bg-[#EFECE1]/60 font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]">
                                <th className="px-6 py-3.5 font-medium sm:px-8">
                                  Incident
                                </th>
                                <th className="px-6 py-3.5 font-medium">
                                  Location
                                </th>
                                <th className="px-6 py-3.5 font-medium">
                                  Priority
                                </th>
                                <th className="px-6 py-3.5 font-medium">
                                  Status
                                </th>
                                <th className="px-6 py-3.5 text-right font-medium sm:px-8">
                                  Logged
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#DEDCCF]">
                              {recentComplaints.map((complaint, index) => (
                                <tr
                                  key={complaint.id}
                                  className="transition-colors hover:bg-[#F4F1E8]/80"
                                >
                                  <td className="px-6 py-4.5 sm:px-8">
                                    <div className="flex items-start gap-3">
                                      <span className="mt-0.5 font-mono text-[11px] text-[#777B70]">
                                        0{index + 1}
                                      </span>
                                      <div>
                                        <p className="font-medium text-[#292D2A]">
                                          {complaint.title}
                                        </p>
                                        <p className="mt-0.5 line-clamp-1 max-w-sm text-xs text-[#777B70]">
                                          {complaint.description}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4.5">
                                    <span className="inline-flex items-center gap-1.5 text-xs text-[#292D2A]">
                                      <MapPin
                                        className="h-3.5 w-3.5 shrink-0 text-[#A65F45]"
                                        strokeWidth={1.6}
                                      />
                                      <span className="max-w-[210px] truncate">
                                        {formatLocation(complaint.location)}
                                      </span>
                                    </span>
                                  </td>
                                  <td className="px-6 py-4.5">
                                    <PriorityBadge priority={complaint.priority} />
                                  </td>
                                  <td className="px-6 py-4.5">
                                    <StatusBadge status={complaint.status} />
                                  </td>
                                  <td className="px-6 py-4.5 text-right font-mono text-xs text-[#777B70] sm:px-8">
                                    {formatDate(complaint.createdAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Ledger List */}
                        <div className="divide-y divide-[#DEDCCF] md:hidden">
                          {recentComplaints.map((complaint, index) => (
                            <div key={complaint.id} className="space-y-3 p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-mono text-[11px] text-[#777B70]">
                                    0{index + 1}
                                  </span>
                                  <p className="font-medium text-[#292D2A]">
                                    {complaint.title}
                                  </p>
                                </div>
                                <StatusBadge status={complaint.status} />
                              </div>
                              <p className="line-clamp-2 text-xs leading-5 text-[#777B70]">
                                {complaint.description}
                              </p>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#DEDCCF] pt-2.5 text-xs text-[#777B70]">
                                <span className="inline-flex items-center gap-1 text-[#292D2A]">
                                  <MapPin
                                    className="h-3.5 w-3.5 text-[#A65F45]"
                                    strokeWidth={1.6}
                                  />
                                  <span className="max-w-[180px] truncate">
                                    {formatLocation(complaint.location)}
                                  </span>
                                </span>
                                <div className="flex items-center gap-2.5">
                                  <PriorityBadge priority={complaint.priority} />
                                  <span className="font-mono text-[11px]">
                                    {formatDate(complaint.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
