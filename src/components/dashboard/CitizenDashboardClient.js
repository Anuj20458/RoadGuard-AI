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
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Eye,
} from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/components/LanguageProvider";
import {
  formatConfidencePercent,
  formatDate,
  formatDateTime,
  formatLocation,
  getExternalMapUrl,
} from "@/lib/formatters";
import ComplaintForm from "./ComplaintForm";
import DetectionSummaryBadge from "./DetectionSummaryBadge";
import { PriorityBadge, StatusBadge } from "./StatusBadge";
import {
  RoadGuardWordmark,
  RoadLineDivider,
  TopographicContours,
} from "./UrbanMotifs";

const NAV_ITEMS = [
  { id: "dashboard", index: "01", labelKey: "navDashboard", icon: LayoutDashboard },
  { id: "complaints", index: "02", labelKey: "navMyComplaints", icon: FileText },
  { id: "report", index: "03", labelKey: "navReportPothole", icon: Plus },
  { id: "profile", index: "04", labelKey: "navProfile", icon: UserIcon },
];

const STAT_METRICS = [
  {
    key: "total",
    code: "IDX-01",
    labelKey: "totalReports",
    noteKey: "statNoteTotal",
    numberColor: "text-[#292D2A]",
  },
  {
    key: "pending",
    code: "IDX-02",
    labelKey: "pendingReview",
    noteKey: "statNotePending",
    numberColor: "text-[#A65F45]",
  },
  {
    key: "in_progress",
    code: "IDX-03",
    labelKey: "inProgress",
    noteKey: "statNoteInProgress",
    numberColor: "text-[#292D2A]",
  },
  {
    key: "resolved",
    code: "IDX-04",
    labelKey: "resolved",
    noteKey: "statNoteResolved",
    numberColor: "text-[#233B32]",
  },
];

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
  const { t } = useLanguage();
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
  const [submissionNotice, setSubmissionNotice] = useState(null);

  const [complaints, setComplaints] = useState([]);
  const [complaintsPage, setComplaintsPage] = useState(1);
  const [complaintsReloadKey, setComplaintsReloadKey] = useState(0);
  const [complaintsPagination, setComplaintsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsError, setComplaintsError] = useState("");
  const [expandedComplaintId, setExpandedComplaintId] = useState(null);
  const [imageNaturalDims, setImageNaturalDims] = useState({});

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

  const handleUnauthorized = useCallback(() => {
    router.push("/login");
    router.refresh();
  }, [router]);

  const fetchComplaintsPage = useCallback(async (page) => {
    const res = await fetch(`/api/citizen/complaints?page=${page}&limit=10`, {
      cache: "no-store",
    });
    if (res.status === 401) {
      return { unauthorized: true };
    }
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || "Unable to load your complaints." };
    }
    return { data };
  }, []);

  useEffect(() => {
    if (activeTab !== "complaints") {
      return;
    }

    let active = true;

    async function loadMyComplaints() {
      setComplaintsLoading(true);
      setComplaintsError("");

      try {
        const result = await fetchComplaintsPage(complaintsPage);
        if (!active) return;

        if (result.unauthorized) {
          handleUnauthorized();
          return;
        }

        if (result.error) {
          setComplaintsError(result.error);
          return;
        }

        const { data } = result;
        setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
        setComplaintsPagination(
          data.pagination || {
            page: complaintsPage,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          }
        );
      } catch {
        if (active) {
          setComplaintsError(
            "Network error while loading your complaints. Please try again."
          );
        }
      } finally {
        if (active) {
          setComplaintsLoading(false);
        }
      }
    }

    loadMyComplaints();
    return () => {
      active = false;
    };
  }, [
    activeTab,
    complaintsPage,
    complaintsReloadKey,
    fetchComplaintsPage,
    handleUnauthorized,
  ]);

  function handleRefreshAll() {
    loadDashboard();
    if (activeTab === "complaints") {
      setComplaintsReloadKey((prev) => prev + 1);
    }
  }

  async function handleComplaintSubmitted(result) {
    setSubmissionNotice(result);
    setComplaintsPage(1);
    setExpandedComplaintId(result?.complaint?.id || null);
    setComplaintsReloadKey((prev) => prev + 1);
    setActiveTab("complaints");
    setMobileMenuOpen(false);
    await loadDashboard();
  }

  const activeNavItem =
    NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-[#DEDCCF] bg-[#EFECE1] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between border-b border-[#DEDCCF] px-5">
          <RoadGuardWordmark />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="border border-[#DEDCCF] p-1.5 text-[#292D2A] hover:border-[#233B32] lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>

        <div className="px-5 pt-5 pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
            {t("citizenPortalNav")}
          </p>
        </div>

        <nav
          className="flex flex-1 flex-col gap-1 px-3 py-2"
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
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "border-l-2 border-[#A65F45] bg-[#FAF8F2] font-medium text-[#233B32]"
                    : "border-l-2 border-transparent text-[#292D2A]/80 hover:bg-[#FAF8F2]/60 hover:text-[#233B32]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-[#A65F45]" : "text-[#777B70]"
                    }`}
                    strokeWidth={1.6}
                  />
                  <span>{t(item.labelKey)}</span>
                </span>
                <span className="font-mono text-[10px] text-[#777B70]">
                  {item.index}
                </span>
              </button>
            );
          })}
        </nav>


        {/* Citizen Identity Footer & Logout */}
        <div className="border-t border-[#DEDCCF] p-5">
          <div className="mb-4 border border-[#DEDCCF] bg-[#FAF8F2] p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#777B70]">
                {t("activeCitizen")}
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
              <span>{loggingOut ? t("signingOut") : t("logout")}</span>
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
                {t(activeNavItem.labelKey)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden font-mono text-[11px] uppercase tracking-wider text-[#777B70] md:inline">
              {todayLabel}
            </span>
            <LanguageSelector />
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={loading || complaintsLoading}
              className="inline-flex items-center gap-2 border border-[#DEDCCF] bg-[#FAF8F2] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32] hover:text-[#233B32] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading || complaintsLoading ? "animate-spin" : ""}`}
                strokeWidth={1.6}
              />
              <span className="hidden sm:inline">{t("refresh")}</span>
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
                      {t("citizenBriefTag")}
                    </p>
                    <h2 className="mt-3 text-3xl font-light tracking-tight text-[#292D2A] sm:text-4xl">
                      {t("welcome")},{" "}
                      <span className="font-semibold text-[#233B32]">
                        {user?.name}
                      </span>
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#777B70] sm:text-base">
                      {t("citizenBriefDesc")}
                    </p>

                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectTab("report")}
                        className="inline-flex items-center gap-2.5 bg-[#233B32] px-5 py-2.5 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27]"
                      >
                        <Plus className="h-4 w-4 text-[#DEDCCF]" strokeWidth={1.8} />
                        <span>{t("reportHazardBtn")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTab("complaints")}
                        className="inline-flex items-center gap-2 border border-[#DEDCCF] bg-[#F4F1E8] px-4 py-2.5 text-sm font-medium text-[#292D2A] transition-colors hover:border-[#233B32]"
                      >
                        <span>{t("inspectLedgerBtn")}</span>
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
                        {t("accountStatus")}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#233B32]">
                        {t("roleCitizen")}
                      </span>
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-xs text-[#777B70]">{t("memberSince")}</dt>
                        <dd className="font-mono text-xs text-[#292D2A]">
                          {formatDate(user?.createdAt)}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-xs text-[#777B70]">{t("activeQueue")}</dt>
                        <dd className="font-mono text-xs text-[#A65F45]">
                          {stats.pending + stats.in_progress}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-xs text-[#777B70]">{t("resolvedCases")}</dt>
                        <dd className="font-mono text-xs text-[#233B32]">
                          {stats.resolved}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Subtle road-grid footer mark */}
                  <div className="mt-6 border-t border-dashed border-[#DEDCCF] pt-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#777B70]">
                      RoadGuard · {t("brandSubtitle")}
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
                    <p className="font-medium">{t("unableToSyncDashboard")}</p>
                    <p className="text-xs text-[#777B70]">{error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loadDashboard}
                  className="shrink-0 border border-[#A65F45] bg-[#A65F45] px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-[#F4F1E8] transition-colors hover:bg-[#8E4F38]"
                >
                  {t("tryAgain")}
                </button>
              </div>
            )}

            {/* Submission Confirmation Notice */}
            {submissionNotice?.complaint && activeTab !== "report" && (
              <div
                role="status"
                className="flex flex-col items-start justify-between gap-4 border border-[#233B32]/40 bg-[#FAF8F2] p-5 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3 text-sm text-[#292D2A]">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#233B32]"
                    strokeWidth={1.8}
                  />
                  <div>
                    <p className="font-medium text-[#233B32]">
                      {t("complaintSubmittedPrefix")}: {submissionNotice.complaint.title}
                    </p>
                    <p className="mt-1 text-xs text-[#777B70]">
                      {t("referenceLabel")}{" "}
                      <span className="font-mono text-[#292D2A]">
                        #{submissionNotice.complaint.id.slice(-6).toUpperCase()}
                      </span>{" "}
                      · {t("statusLabel")}:{" "}
                      <span className="font-mono uppercase text-[#292D2A]">
                        {t(`status_${submissionNotice.complaint.status}`)}
                      </span>{" "}
                      ·{" "}
                      {submissionNotice.detectionStatus === "completed"
                        ? submissionNotice.complaint.detection?.detected
                          ? `${t("aiCompletedDetected")} (${Math.round(
                              (submissionNotice.complaint.detection.confidence ||
                                0) * 100
                            )}%, ${
                              submissionNotice.complaint.detection.boundingBoxes
                                ?.length || 0
                            } ${
                              (submissionNotice.complaint.detection
                                .boundingBoxes?.length || 0) === 1
                                ? t("aiBoxSingular")
                                : t("aiBoxPlural")
                            }).`
                          : t("aiCompletedNoPothole")
                        : submissionNotice.detectionStatus === "not_applicable"
                          ? t("aiManualReview")
                          : t("aiSavedManualReview")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmissionNotice(null)}
                  className="shrink-0 border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32]"
                >
                  {t("dismiss")}
                </button>
              </div>
            )}

            {/* Main View Switching */}
            {activeTab === "report" ? (
              <section className="space-y-6">
                <RoadLineDivider label={t("dividerNewHazard")} />
                <ComplaintForm
                  onSubmitted={handleComplaintSubmitted}
                  onUnauthorized={handleUnauthorized}
                />
              </section>
            ) : activeTab === "profile" ? (
              <section className="space-y-6">
                <RoadLineDivider label={t("dividerCitizenDossier")} />
                <div className="border border-[#DEDCCF] bg-[#FAF8F2]">
                  <div className="border-b border-[#DEDCCF] px-6 py-5 sm:px-8">
                    <h3 className="text-lg font-semibold tracking-tight text-[#292D2A]">
                      {t("verifiedAccountDetails")}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#777B70]">
                      {t("registeredCitizenNote")}
                    </p>
                  </div>
                  <dl className="grid grid-cols-1 divide-y divide-[#DEDCCF] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                    <div className="p-6 sm:border-b sm:border-[#DEDCCF] sm:px-8">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        {t("fullName")}
                      </dt>
                      <dd className="mt-2 text-base font-medium text-[#292D2A]">
                        {user?.name || "—"}
                      </dd>
                    </div>
                    <div className="p-6 sm:border-b sm:border-[#DEDCCF] sm:px-8">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        {t("emailAddress")}
                      </dt>
                      <dd className="mt-2 font-mono text-sm text-[#292D2A]">
                        {user?.email || "—"}
                      </dd>
                    </div>
                    <div className="p-6 sm:px-8">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        {t("phoneNumber")}
                      </dt>
                      <dd className="mt-2 font-mono text-sm text-[#292D2A]">
                        {user?.phone || t("notProvided")}
                      </dd>
                    </div>
                    <div className="p-6 sm:px-8">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        {t("roleAndRegistration")}
                      </dt>
                      <dd className="mt-2 text-sm text-[#292D2A]">
                        <span className="font-mono text-xs uppercase tracking-wider text-[#233B32]">
                          {user?.role === "admin"
                            ? t("roleAdmin")
                            : user?.role === "worker"
                              ? t("roleWorker")
                              : t("roleCitizen")}
                        </span>{" "}
                        <span className="text-[#777B70]">
                          · {t("joinedLabel")} {formatDate(user?.createdAt)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            ) : activeTab === "complaints" ? (
              <section className="space-y-4">
                <RoadLineDivider label={t("dividerComplaintDocket")} />

                {complaintsError && (
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
                        <p className="font-medium">
                          {t("unableToLoadDocket")}
                        </p>
                        <p className="text-xs text-[#777B70]">
                          {complaintsError}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setComplaintsReloadKey((prev) => prev + 1)
                      }
                      className="shrink-0 border border-[#A65F45] bg-[#A65F45] px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-[#F4F1E8] transition-colors hover:bg-[#8E4F38]"
                    >
                      {t("tryAgain")}
                    </button>
                  </div>
                )}

                {complaintsLoading ? (
                  <div
                    className="border border-[#DEDCCF] bg-[#FAF8F2] p-6"
                    aria-busy="true"
                    aria-label="Loading complaints"
                  >
                    <div className="mb-6 h-4 w-48 animate-pulse bg-[#E7E3D4]" />
                    <div className="space-y-4">
                      {[1, 2, 3].map((row) => (
                        <div
                          key={row}
                          className="h-16 animate-pulse border-b border-[#DEDCCF]/70 bg-[#EFECE1]/70"
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border border-[#DEDCCF] bg-[#FAF8F2]">
                    <div className="flex flex-col justify-between gap-2 border-b border-[#DEDCCF] px-6 py-5 sm:flex-row sm:items-center sm:px-8">
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight text-[#292D2A]">
                          {t("navMyComplaints")}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#777B70]">
                          {t("myComplaintsDesc")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-[#777B70]">
                          {complaintsPagination.total}{" "}
                          {complaintsPagination.total === 1
                            ? t("recordSingular")
                            : t("recordPlural")}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectTab("report")}
                          className="inline-flex items-center gap-1.5 bg-[#233B32] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#F4F1E8] transition-colors hover:bg-[#1B2E27]"
                        >
                          <Plus className="h-3 w-3" strokeWidth={1.8} />
                          <span>{t("newReport")}</span>
                        </button>
                      </div>
                    </div>

                    {complaints.length === 0 ? (
                      <div className="px-6 py-14 text-center sm:px-10">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[#DEDCCF] bg-[#F4F1E8] text-[#233B32]">
                          <MapPin className="h-5 w-5" strokeWidth={1.5} />
                        </div>
                        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
                          {t("emptyLedger")}
                        </p>
                        <h4 className="mt-1.5 text-lg font-medium text-[#292D2A]">
                          {t("noComplaintsYet")}
                        </h4>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#777B70]">
                          {t("noComplaintsDesc")}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleSelectTab("report")}
                          className="mt-6 inline-flex items-center gap-2 bg-[#233B32] px-5 py-2.5 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27]"
                        >
                          <Plus className="h-4 w-4" strokeWidth={1.8} />
                          <span>{t("reportHazardBtn")}</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="divide-y divide-[#DEDCCF]">
                          {complaints.map((complaint) => {
                            const isExpanded =
                              expandedComplaintId === complaint.id;
                            const dims = imageNaturalDims[complaint.id] || null;
                            const boxes = Array.isArray(
                              complaint.detection?.boundingBoxes
                            )
                              ? complaint.detection.boundingBoxes
                              : [];

                            return (
                              <article
                                key={complaint.id}
                                className="p-5 transition-colors hover:bg-[#F4F1E8]/45 sm:px-8 sm:py-6"
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="flex min-w-0 flex-1 items-start gap-4">
                                    {/* Evidence Thumbnail */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedComplaintId(
                                          isExpanded ? null : complaint.id
                                        )
                                      }
                                      className="group relative h-20 w-24 shrink-0 overflow-hidden border border-[#DEDCCF] bg-[#EFECE1] focus:outline-none focus:ring-1 focus:ring-[#233B32]"
                                      aria-label={`Inspect photo and AI boxes for ${complaint.title}`}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={complaint.imageUrl}
                                        alt={complaint.title}
                                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                      />
                                      <span className="absolute bottom-1 right-1 bg-[#292D2A]/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#F4F1E8]">
                                        {isExpanded ? t("hide") : t("view")}
                                      </span>
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-[11px] uppercase tracking-wider text-[#A65F45]">
                                          #{complaint.id.slice(-6).toUpperCase()}
                                        </span>
                                        <span className="font-mono text-[11px] text-[#777B70]">
                                          · {formatDate(complaint.createdAt)}
                                        </span>
                                      </div>

                                      <h4 className="mt-1 text-base font-medium text-[#292D2A]">
                                        {complaint.title}
                                      </h4>
                                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#777B70]">
                                        {complaint.description}
                                      </p>

                                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#292D2A]">
                                        <span className="inline-flex items-center gap-1.5">
                                          <MapPin
                                            className="h-3.5 w-3.5 shrink-0 text-[#A65F45]"
                                            strokeWidth={1.6}
                                          />
                                          <span className="max-w-xs truncate">
                                            {formatLocation(complaint.location)}
                                          </span>
                                        </span>
                                        {typeof complaint.location?.latitude ===
                                          "number" &&
                                          typeof complaint.location
                                            ?.longitude === "number" && (
                                            <span className="font-mono text-[11px] text-[#777B70]">
                                              {complaint.location.latitude.toFixed(
                                                4
                                              )}
                                              °,{" "}
                                              {complaint.location.longitude.toFixed(
                                                4
                                              )}
                                              °
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Status, Priority, and AI Result */}
                                  <div className="flex flex-wrap items-center gap-4 border-t border-dashed border-[#DEDCCF] pt-3 lg:shrink-0 lg:border-t-0 lg:pt-0">
                                    <div>
                                      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-[#777B70]">
                                        {t("statusLabel")}
                                      </span>
                                      <StatusBadge status={complaint.status} />
                                    </div>

                                    <div>
                                      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-[#777B70]">
                                        {t("priorityLabel")}
                                      </span>
                                      <PriorityBadge
                                        priority={complaint.priority}
                                      />
                                    </div>

                                    <div>
                                      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-[#777B70]">
                                        {t("aiResultLabel")}
                                      </span>
                                      <DetectionSummaryBadge
                                        detection={complaint.detection}
                                        reportCategory={complaint.reportCategory}
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedComplaintId(
                                          isExpanded ? null : complaint.id
                                        )
                                      }
                                      className="ml-auto inline-flex items-center gap-1.5 border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32] lg:ml-2"
                                      aria-expanded={isExpanded}
                                    >
                                      <Eye
                                        className="h-3.5 w-3.5"
                                        strokeWidth={1.6}
                                      />
                                      <span>
                                        {isExpanded ? t("close") : t("inspect")}
                                      </span>
                                      {isExpanded ? (
                                        <ChevronUp className="h-3 w-3" />
                                      ) : (
                                        <ChevronDown className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Expandable Evidence & AI Detection Inspector */}
                                {isExpanded && (
                                  <div className="mt-5 grid grid-cols-1 gap-5 border border-[#DEDCCF] bg-[#EFECE1]/55 p-4 sm:p-5 lg:grid-cols-12">
                                    <div className="lg:col-span-7">
                                      <div className="relative overflow-hidden border border-[#DEDCCF] bg-[#F4F1E8]">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={complaint.imageUrl}
                                          alt={`Road surface evidence for ${complaint.title}`}
                                          onLoad={(e) => {
                                            const img = e.currentTarget;
                                            if (
                                              img.naturalWidth > 0 &&
                                              img.naturalHeight > 0
                                            ) {
                                              setImageNaturalDims((prev) => ({
                                                ...prev,
                                                [complaint.id]: {
                                                  width: img.naturalWidth,
                                                  height: img.naturalHeight,
                                                },
                                              }));
                                            }
                                          }}
                                          className="block max-h-80 w-full object-contain"
                                        />

                                        {complaint.detection?.detected &&
                                          boxes.length > 0 &&
                                          dims && (
                                            <svg
                                              viewBox={`0 0 ${dims.width} ${dims.height}`}
                                              preserveAspectRatio="xMidYMid meet"
                                              aria-label="Stored AI pothole bounding boxes"
                                              className="pointer-events-none absolute inset-0 h-full w-full"
                                            >
                                              {boxes.map((box, idx) => {
                                                const left = Math.max(
                                                  0,
                                                  box.x - box.width / 2
                                                );
                                                const top = Math.max(
                                                  0,
                                                  box.y - box.height / 2
                                                );
                                                const strokeW = Math.max(
                                                  2,
                                                  Math.round(dims.width * 0.004)
                                                );
                                                return (
                                                  <rect
                                                    key={`${box.x}-${box.y}-${idx}`}
                                                    x={left}
                                                    y={top}
                                                    width={box.width}
                                                    height={box.height}
                                                    fill="rgba(166, 95, 69, 0.16)"
                                                    stroke="#A65F45"
                                                    strokeWidth={strokeW}
                                                  />
                                                );
                                              })}
                                            </svg>
                                          )}
                                      </div>
                                    </div>

                                     <div className="space-y-4 lg:col-span-5">
                                       <div>
                                         <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
                                           {t("aiLocationDossier")}
                                         </p>
                                         <dl className="mt-3 space-y-2.5 text-xs">
                                           <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                                             <dt className="text-[#777B70]">
                                               {t("reportCategoryLabel")}
                                             </dt>
                                             <dd className="font-mono font-medium text-[#292D2A]">
                                               {t(`reportCategory_${complaint.reportCategory || "pothole"}`)}
                                             </dd>
                                           </div>
                                           {complaint.roadType && (
                                             <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                                               <dt className="text-[#777B70]">
                                                 {t("roadTypeLabel")}
                                               </dt>
                                               <dd className="font-mono text-[#292D2A]">
                                                 {t(`roadType_${complaint.roadType}`)}
                                               </dd>
                                             </div>
                                           )}
                                           {complaint.authorityCategory && (
                                             <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                                               <dt className="text-[#777B70]">
                                                 {t("authorityCategoryLabel")}
                                               </dt>
                                               <dd className="font-mono text-[#292D2A]">
                                                 {t(`authority_${complaint.authorityCategory}`)}
                                               </dd>
                                             </div>
                                           )}
                                           <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                                             <dt className="text-[#777B70]">
                                               {t("aiOutcome")}
                                             </dt>
                                             <dd className="font-mono font-medium text-[#292D2A]">
                                               {complaint.detection
                                                 ? complaint.detection.detected
                                                   ? t("aiDetected")
                                                   : t("aiNoPothole")
                                                 : !complaint.reportCategory ||
                                                     complaint.reportCategory ===
                                                       "pothole"
                                                   ? t("aiUnavailable")
                                                   : t("aiManualReview")}
                                             </dd>
                                           </div>
                                           <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                                             <dt className="text-[#777B70]">
                                               {t("confidenceLabel")}
                                             </dt>
                                             <dd className="font-mono text-[#292D2A]">
                                               {complaint.detection
                                                 ? formatConfidencePercent(
                                                     complaint.detection
                                                       .confidence
                                                   )
                                                 : "—"}
                                             </dd>
                                           </div>
                                           <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                                             <dt className="text-[#777B70]">
                                               {t("boundingBoxesLabel")}
                                             </dt>
                                             <dd className="font-mono text-[#292D2A]">
                                               {complaint.detection
                                                 ? boxes.length
                                                 : "—"}
                                             </dd>
                                           </div>
                                           <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                                             <dt className="text-[#777B70]">
                                               {t("aiModelLabel")}
                                             </dt>
                                             <dd className="truncate font-mono text-[11px] text-[#292D2A]">
                                               {complaint.detection?.modelName ||
                                                 t("aiManualReview")}
                                             </dd>
                                           </div>
                                           <div className="flex items-baseline justify-between gap-2">
                                             <dt className="text-[#777B70]">
                                               {t("lastUpdated")}
                                             </dt>
                                             <dd className="font-mono text-[#292D2A]">
                                               {formatDate(
                                                 complaint.updatedAt ||
                                                   complaint.createdAt
                                               )}
                                             </dd>
                                           </div>
                                         </dl>
                                       </div>

                                       <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-3 text-xs leading-5 text-[#777B70]">
                                         <p>{complaint.description}</p>
                                         <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#DEDCCF] pt-2">
                                           <span className="inline-flex items-center gap-1 text-[11px] text-[#292D2A]">
                                             <MapPin className="h-3.5 w-3.5 shrink-0 text-[#A65F45]" />
                                             <span>{formatLocation(complaint.location)}</span>
                                           </span>
                                           {getExternalMapUrl(complaint.location) && (
                                             <a
                                               href={getExternalMapUrl(complaint.location)}
                                               target="_blank"
                                               rel="noopener noreferrer"
                                               className="inline-flex items-center gap-1 border border-[#DEDCCF] bg-[#F4F1E8] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#233B32] transition-colors hover:border-[#233B32]"
                                             >
                                               <span>{t("openMap")}</span>
                                               <ExternalLink className="h-3 w-3" />
                                             </a>
                                           )}
                                         </div>
                                       </div>

                                       {complaint.repairVerification && (
                                         <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-3 text-xs">
                                           <div className="flex items-center justify-between gap-2">
                                             <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#233B32]">
                                               {t("repairVerificationTitle")}
                                             </span>
                                             <span className="font-mono text-[10px] uppercase tracking-wider text-[#292D2A]">
                                               {["pending", "approved", "rejected"].includes(
                                                 complaint.repairVerification.verificationStatus
                                               )
                                                 ? t(`verification_${complaint.repairVerification.verificationStatus}`)
                                                 : complaint.repairVerification.verificationStatus}
                                             </span>
                                           </div>
                                           {complaint.repairVerification.afterImage && (
                                             <div className="mt-2 overflow-hidden border border-[#DEDCCF] bg-[#F4F1E8]">
                                               {/* eslint-disable-next-line @next/next/no-img-element */}
                                               <img
                                                 src={complaint.repairVerification.afterImage}
                                                 alt={`After-repair photo for ${complaint.title}`}
                                                 className="block max-h-40 w-full object-contain"
                                               />
                                             </div>
                                           )}
                                           {complaint.repairVerification.repairNotes && (
                                             <p className="mt-2 text-xs leading-5 text-[#63675D]">
                                               {complaint.repairVerification.repairNotes}
                                             </p>
                                           )}
                                         </div>
                                       )}

                                       {Array.isArray(complaint.statusHistory) &&
                                         complaint.statusHistory.length > 0 && (
                                           <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-3">
                                             <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]">
                                               {t("statusTimeline")}
                                             </p>
                                             <ul className="mt-2 space-y-2 border-l border-[#DEDCCF] pl-3 text-xs">
                                               {complaint.statusHistory.map((entry) => (
                                                 <li key={entry.id} className="space-y-0.5">
                                                   <div className="flex flex-wrap items-center justify-between gap-2">
                                                     <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[#233B32]">
                                                       {entry.previousStatus
                                                         ? `${t(`status_${entry.previousStatus}`)} → ${t(`status_${entry.newStatus}`)}`
                                                         : t(`status_${entry.newStatus}`)}
                                                     </span>
                                                     <span className="font-mono text-[10px] text-[#777B70]">
                                                       {formatDateTime(entry.timestamp)}
                                                     </span>
                                                   </div>
                                                   {entry.note && (
                                                     <p className="text-[11px] leading-4 text-[#63675D]">
                                                       {entry.note}
                                                     </p>
                                                   )}
                                                 </li>
                                               ))}
                                             </ul>
                                           </div>
                                         )}
                                     </div>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>

                        {/* Pagination Bar */}
                        {complaintsPagination.totalPages > 1 && (
                          <div className="flex flex-col items-center justify-between gap-3 border-t border-[#DEDCCF] bg-[#EFECE1]/50 px-6 py-4 sm:flex-row sm:px-8">
                            <p className="font-mono text-[11px] text-[#777B70]">
                              {t("pageLabel")} {complaintsPagination.page}{" "}
                              {t("ofLabel")} {complaintsPagination.totalPages} ·{" "}
                              {complaintsPagination.total} {t("totalLabel")}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setComplaintsPage((prev) =>
                                    Math.max(1, prev - 1)
                                  )
                                }
                                disabled={!complaintsPagination.hasPrevPage}
                                className="inline-flex items-center gap-1 border border-[#DEDCCF] bg-[#FAF8F2] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32] disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                <span>{t("previous")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setComplaintsPage((prev) => prev + 1)
                                }
                                disabled={!complaintsPagination.hasNextPage}
                                className="inline-flex items-center gap-1 border border-[#DEDCCF] bg-[#FAF8F2] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32] disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <span>{t("next")}</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            ) : loading ? (
              <DashboardSkeleton />
            ) : (
              <>
                {/* Minimal Typography-Led Statistics */}
                <section aria-label="Complaint statistics" className="space-y-4">
                  <RoadLineDivider label={t("dividerMetrics")} />

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
                            {t(metric.labelKey)}
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
                          {t(metric.noteKey)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Refined Complaint Tracking Interface */}
                <section className="space-y-4">
                  <RoadLineDivider label={t("dividerRecent")} />

                  <div className="border border-[#DEDCCF] bg-[#FAF8F2]">
                    <div className="flex flex-col justify-between gap-2 border-b border-[#DEDCCF] px-6 py-5 sm:flex-row sm:items-center sm:px-8">
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight text-[#292D2A]">
                          {t("recentComplaints")}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#777B70]">
                          {t("recentDesc")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-[#777B70]">
                          {recentComplaints.length}{" "}
                          {recentComplaints.length === 1
                            ? t("entrySingular")
                            : t("entryPlural")}
                        </span>
                        {stats.total > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSelectTab("complaints")}
                            className="inline-flex items-center gap-1 border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32]"
                          >
                            <span>{t("viewAll")}</span>
                            <ArrowUpRight className="h-3 w-3 text-[#777B70]" />
                          </button>
                        )}
                      </div>
                    </div>

                    {recentComplaints.length === 0 ? (
                      <div className="px-6 py-14 text-center sm:px-10">
                        {/* Subtle surveyor empty-state mark */}
                        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[#DEDCCF] bg-[#F4F1E8] text-[#233B32]">
                          <MapPin className="h-5 w-5" strokeWidth={1.5} />
                        </div>
                        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
                          {t("emptyLedger")}
                        </p>
                        <h4 className="mt-1.5 text-lg font-medium text-[#292D2A]">
                          {t("noComplaintsYet")}
                        </h4>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#777B70]">
                          {t("noComplaintsDesc")}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleSelectTab("report")}
                          className="mt-6 inline-flex items-center gap-2 bg-[#233B32] px-5 py-2.5 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27]"
                        >
                          <Plus className="h-4 w-4" strokeWidth={1.8} />
                          <span>{t("reportHazardBtn")}</span>
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
                                  {t("incidentCol")}
                                </th>
                                <th className="px-6 py-3.5 font-medium">
                                  {t("locationCol")}
                                </th>
                                <th className="px-6 py-3.5 font-medium">
                                  {t("priorityLabel")}
                                </th>
                                <th className="px-6 py-3.5 font-medium">
                                  {t("statusLabel")}
                                </th>
                                <th className="px-6 py-3.5 text-right font-medium sm:px-8">
                                  {t("loggedLabel")}
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
