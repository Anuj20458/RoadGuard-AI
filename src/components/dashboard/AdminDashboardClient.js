"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Eye,
  Filter,
  HardHat,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/components/LanguageProvider";
import {
  formatDate,
  formatDateTime,
  formatLocation,
} from "@/lib/formatters";
import ComplaintEvidencePanel from "./ComplaintEvidencePanel";
import DetectionSummaryBadge from "./DetectionSummaryBadge";
import { PriorityBadge, StatusBadge } from "./StatusBadge";
import {
  RoadGuardWordmark,
  RoadLineDivider,
  TopographicContours,
} from "./UrbanMotifs";

const NAV_ITEMS = [
  { id: "triage", index: "01", labelKey: "navTriage", icon: ClipboardCheck },
  { id: "workers", index: "02", labelKey: "navWorkers", icon: HardHat },
  { id: "profile", index: "03", labelKey: "navProfile", icon: UserIcon },
];

const STATUS_OPTIONS = [
  { value: "", labelKey: "allStatuses" },
  { value: "pending", labelKey: "status_pending" },
  { value: "verified", labelKey: "status_verified" },
  { value: "assigned", labelKey: "status_assigned" },
  { value: "in_progress", labelKey: "status_in_progress" },
  { value: "resolved", labelKey: "status_resolved" },
  { value: "rejected", labelKey: "status_rejected" },
];

const PRIORITY_OPTIONS = [
  { value: "", labelKey: "allPriorities" },
  { value: "critical", labelKey: "priority_critical" },
  { value: "high", labelKey: "priority_high" },
  { value: "medium", labelKey: "priority_medium" },
  { value: "low", labelKey: "priority_low" },
];

const INITIAL_STATS = {
  total: 0,
  pending: 0,
  verified: 0,
  assigned: 0,
  in_progress: 0,
  verifiedActive: 0,
  resolved: 0,
  rejected: 0,
  pendingRepairs: 0,
};

const INITIAL_WORKER_FORM = {
  name: "",
  email: "",
  phone: "",
  password: "",
};

/**
 * Protected Admin Operations Console for reviewing complaints,
 * verifying/rejecting pending reports, assigning field workers,
 * approving repair verifications, and creating worker accounts.
 *
 * @param {{ initialUser: { id: string, name: string, email: string, role: string, phone?: string, createdAt?: string } }} props
 */
export default function AdminDashboardClient({ initialUser }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [user] = useState(initialUser);
  const [activeTab, setActiveTab] = useState("triage");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Complaint list & filter state
  const [stats, setStats] = useState(INITIAL_STATS);
  const [complaints, setComplaints] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  // Per-complaint action form states
  const [reviewNotes, setReviewNotes] = useState({});
  const [assignWorkerIds, setAssignWorkerIds] = useState({});
  const [assignNotes, setAssignNotes] = useState({});
  const [repairReviewNotes, setRepairReviewNotes] = useState({});
  const [actionLoadingKey, setActionLoadingKey] = useState("");
  const [actionBanner, setActionBanner] = useState(null);

  // Admin-only create worker form state
  const [workerForm, setWorkerForm] = useState(INITIAL_WORKER_FORM);
  const [workerFieldErrors, setWorkerFieldErrors] = useState({});
  const [workerSubmitting, setWorkerSubmitting] = useState(false);
  const [workerFormMessage, setWorkerFormMessage] = useState(null);

  useEffect(() => {
    let active = true;

    async function syncAdminData() {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "10",
        });
        if (statusFilter) params.set("status", statusFilter);
        if (priorityFilter) params.set("priority", priorityFilter);

        const [complaintsRes, workersRes] = await Promise.all([
          fetch(`/api/admin/complaints?${params.toString()}`, {
            cache: "no-store",
          }),
          fetch("/api/admin/workers", {
            cache: "no-store",
          }),
        ]);

        if (
          complaintsRes.status === 401 ||
          complaintsRes.status === 403 ||
          workersRes.status === 401 ||
          workersRes.status === 403
        ) {
          if (active) {
            router.push("/login");
            router.refresh();
          }
          return;
        }

        const [complaintsData, workersData] = await Promise.all([
          complaintsRes.json(),
          workersRes.json(),
        ]);

        if (!complaintsRes.ok) {
          throw new Error(
            complaintsData?.error || "Unable to load admin operations data."
          );
        }

        if (!workersRes.ok) {
          throw new Error(
            workersData?.error || "Unable to load field worker roster."
          );
        }

        if (active) {
          const nextWorkers = Array.isArray(workersData.workers)
            ? workersData.workers
            : Array.isArray(complaintsData.workers)
              ? complaintsData.workers
              : [];
          const nextPagination = complaintsData.pagination || {
            page,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          };

          setStats(complaintsData.stats || INITIAL_STATS);
          setComplaints(
            Array.isArray(complaintsData.complaints)
              ? complaintsData.complaints
              : []
          );
          setWorkers(nextWorkers);
          setPagination(nextPagination);
          setHasLoadedOnce(true);
          setError("");

          if (
            nextPagination.totalPages > 0 &&
            page > nextPagination.totalPages
          ) {
            setPage(nextPagination.totalPages);
          }
        }
      } catch (err) {
        if (active) {
          setError(err?.message || "Unable to sync admin ledger.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    syncAdminData();
    return () => {
      active = false;
    };
  }, [page, priorityFilter, reloadKey, router, statusFilter]);

  const triggerReload = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((prev) => prev + 1);
  }, []);

  const triggerSilentReload = useCallback(() => {
    setError("");
    setReloadKey((prev) => prev + 1);
  }, []);

  const refreshWorkers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/workers", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        router.refresh();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load field worker roster.");
      }
      if (Array.isArray(data.workers)) {
        setWorkers(data.workers);
      }
    } catch (err) {
      setError(err?.message || "Unable to sync field worker roster.");
    }
  }, [router]);

  function applyUpdatedComplaint(updatedComplaint) {
    if (!updatedComplaint) return;
    setComplaints((prev) =>
      prev.map((item) =>
        item.id === updatedComplaint.id ? updatedComplaint : item
      )
    );
  }

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

  function handleSelectTab(tabId) {
    setActiveTab(tabId);
    setMobileNavOpen(false);
    if (tabId === "workers") {
      refreshWorkers();
    }
  }

  function handleFilterChange(setter, value) {
    setter(value);
    setPage(1);
    setExpandedId(null);
  }

  async function handleReviewComplaint(complaintId, action) {
    const key = `review-${complaintId}`;
    setActionLoadingKey(key);
    setActionBanner(null);

    try {
      const res = await fetch(`/api/admin/complaints/${complaintId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: (reviewNotes[complaintId] || "").trim(),
        }),
      });

      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        router.refresh();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        const detailMsg = data?.details?.note || data?.error;
        setActionBanner({
          type: "error",
          message: detailMsg || "Unable to update complaint review.",
        });
        return;
      }

      applyUpdatedComplaint(data.complaint);
      if (data.stats) {
        setStats(data.stats);
      }
      setReviewNotes((prev) => ({ ...prev, [complaintId]: "" }));
      setActionBanner({
        type: "success",
        message:
          action === "verify"
            ? `Complaint #${complaintId.slice(-6).toUpperCase()} verified and ready for worker assignment.`
            : `Complaint #${complaintId.slice(-6).toUpperCase()} rejected.`,
      });
      triggerSilentReload();
    } catch {
      setActionBanner({
        type: "error",
        message: "Network error while reviewing complaint.",
      });
    } finally {
      setActionLoadingKey("");
    }
  }

  async function handleAssignWorker(complaintId, selectedWorkerId) {
    if (!selectedWorkerId) {
      setActionBanner({
        type: "error",
        message: "Please select a field worker to assign.",
      });
      return;
    }

    const key = `assign-${complaintId}`;
    setActionLoadingKey(key);
    setActionBanner(null);

    try {
      const res = await fetch(`/api/admin/complaints/${complaintId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: selectedWorkerId,
          note: (assignNotes[complaintId] || "").trim(),
        }),
      });

      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        router.refresh();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setActionBanner({
          type: "error",
          message: data?.error || "Unable to assign complaint to worker.",
        });
        return;
      }

      applyUpdatedComplaint(data.complaint);
      if (data.stats) {
        setStats(data.stats);
      }
      if (Array.isArray(data.workers)) {
        setWorkers(data.workers);
      }
      setAssignNotes((prev) => ({ ...prev, [complaintId]: "" }));
      setActionBanner({
        type: "success",
        message: `Complaint #${complaintId.slice(-6).toUpperCase()} assigned to ${data.complaint?.assignment?.workerName || "field worker"}.`,
      });
      triggerSilentReload();
    } catch {
      setActionBanner({
        type: "error",
        message: "Network error while assigning complaint.",
      });
    } finally {
      setActionLoadingKey("");
    }
  }

  async function handleRepairVerification(complaintId, action) {
    const key = `repair-${complaintId}`;
    setActionLoadingKey(key);
    setActionBanner(null);

    try {
      const res = await fetch(
        `/api/admin/complaints/${complaintId}/repair-verification`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: (repairReviewNotes[complaintId] || "").trim(),
          }),
        }
      );

      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        router.refresh();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        const detailMsg = data?.details?.note || data?.error;
        setActionBanner({
          type: "error",
          message: detailMsg || "Unable to process repair verification.",
        });
        return;
      }

      applyUpdatedComplaint(data.complaint);
      if (data.stats) {
        setStats(data.stats);
      }
      if (Array.isArray(data.workers)) {
        setWorkers(data.workers);
      }
      setRepairReviewNotes((prev) => ({ ...prev, [complaintId]: "" }));
      setActionBanner({
        type: "success",
        message:
          action === "approve"
            ? `Repair approved. Complaint #${complaintId.slice(-6).toUpperCase()} is now resolved.`
            : `Repair rejected. Complaint #${complaintId.slice(-6).toUpperCase()} returned to worker for rework.`,
      });
      triggerSilentReload();
    } catch {
      setActionBanner({
        type: "error",
        message: "Network error while updating repair verification.",
      });
    } finally {
      setActionLoadingKey("");
    }
  }

  async function handleCreateWorker(event) {
    event.preventDefault();
    setWorkerSubmitting(true);
    setWorkerFieldErrors({});
    setWorkerFormMessage(null);

    try {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workerForm),
      });

      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        router.refresh();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        if (data?.details) {
          setWorkerFieldErrors(data.details);
        }
        setWorkerFormMessage({
          type: "error",
          message: data?.error || "Unable to create worker account.",
        });
        return;
      }

      setWorkerForm(INITIAL_WORKER_FORM);
      if (Array.isArray(data.workers)) {
        setWorkers(data.workers);
      } else if (data.worker) {
        setWorkers((prev) => [
          data.worker,
          ...prev.filter((w) => w.id !== data.worker.id),
        ]);
      }
      setWorkerFormMessage({
        type: "success",
        message: `Worker account created for ${data.worker.name} (${data.worker.email}).`,
      });
      triggerSilentReload();
    } catch {
      setWorkerFormMessage({
        type: "error",
        message: "Network error while creating worker account.",
      });
    } finally {
      setWorkerSubmitting(false);
    }
  }

  const verifiedActiveCount =
    typeof stats.verifiedActive === "number"
      ? stats.verifiedActive
      : stats.verified + stats.assigned + stats.in_progress;

  const metricCards = [
    {
      label: t("totalLogged"),
      code: "ADM-01",
      value: stats.total,
      note: t("adminStatNoteTotal"),
      color: "text-[#292D2A]",
    },
    {
      label: t("pendingReview"),
      code: "ADM-02",
      value: stats.pending,
      note: t("adminStatNotePending"),
      color: "text-[#A65F45]",
    },
    {
      label: t("verifiedActive"),
      code: "ADM-03",
      value: verifiedActiveCount,
      note: `${stats.verified} ${t("status_verified").toLowerCase()} · ${stats.assigned + stats.in_progress}`,
      color: "text-[#292D2A]",
    },
    {
      label: t("repairsToVerify"),
      code: "ADM-04",
      value: stats.pendingRepairs,
      note: `${stats.resolved} ${t("adminStatNoteResolvedSuffix")}`,
      color: "text-[#233B32]",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F1E8] font-sans text-[#292D2A] lg:flex">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-[#DEDCCF] bg-[#F4F1E8]/95 px-4 py-3.5 backdrop-blur-xs lg:hidden">
        <RoadGuardWordmark compact />
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNavOpen}
            className="flex h-9 w-9 items-center justify-center border border-[#DEDCCF] bg-[#FAF8F2] text-[#292D2A]"
          >
            {mobileNavOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#292D2A]/25 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col justify-between border-r border-[#DEDCCF] bg-[#EFECE1] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="hidden border-b border-[#DEDCCF] px-6 py-6 lg:block">
            <RoadGuardWordmark />
          </div>

          <div className="px-4 pt-6 pb-2">
            <p className="px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
              {t("adminOperations")}
            </p>
          </div>

          <nav aria-label="Admin portal navigation" className="space-y-1 px-3">
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
        </div>

        <div className="border-t border-[#DEDCCF] bg-[#EAE6D8]/70 p-4">
          <div className="mb-3 px-1">
            <p className="truncate text-sm font-medium text-[#292D2A]">
              {user?.name}
            </p>
            <p className="truncate font-mono text-[11px] text-[#777B70]">
              {user?.email}
            </p>
            <span className="mt-1.5 inline-block rounded-xs border border-[#233B32]/30 bg-[#FAF8F2] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#233B32]">
              {t("rolePrefix")}: {t("roleAdmin")}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="flex h-9 w-full items-center justify-center gap-2 border border-[#DEDCCF] bg-[#FAF8F2] text-xs font-medium text-[#292D2A] transition-colors hover:border-[#A65F45] hover:text-[#A65F45] disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span>{signingOut ? t("signingOut") : t("signOut")}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[#DEDCCF] bg-[#FAF8F2]/80 px-5 py-4 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#777B70]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#233B32]" />
              <span>{t("adminCommand")}</span>
              <span className="text-[#DEDCCF]">/</span>
              <span className="text-[#292D2A]">
                {t(
                  NAV_ITEMS.find((item) => item.id === activeTab)?.labelKey ||
                    "navTriage"
                )}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden lg:block">
                <LanguageSelector />
              </div>
              <button
                type="button"
                onClick={triggerReload}
                disabled={loading}
                className="inline-flex items-center gap-1.5 border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
                  strokeWidth={1.7}
                />
                <span>{t("sync")}</span>
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto max-w-6xl space-y-8">
            {/* Editorial Banner */}
            <section className="relative overflow-hidden border border-[#DEDCCF] bg-[#FAF8F2]">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="relative p-6 sm:p-8 lg:col-span-8 lg:border-r lg:border-[#DEDCCF]">
                  <div className="pointer-events-none absolute right-0 bottom-0 h-44 w-72 opacity-80">
                    <TopographicContours />
                  </div>
                  <div className="relative z-10">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#A65F45]">
                      {t("adminCommand")}
                    </p>
                    <h1 className="mt-2 text-2xl font-light tracking-tight text-[#292D2A] sm:text-3xl">
                      {t("welcome")},{" "}
                      <span className="font-semibold text-[#233B32]">
                        {user?.name}
                      </span>
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[#777B70]">
                      {t("adminWelcomeDesc")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col justify-between bg-[#EFECE1]/75 p-6 sm:p-8 lg:col-span-4">
                  <div className="flex items-center justify-between border-b border-[#DEDCCF] pb-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                      {t("fieldRoster")}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#233B32]">
                      {loading && !hasLoadedOnce
                        ? t("syncing")
                        : `${workers.length} ${workers.length === 1 ? t("workerSingular") : t("workerPlural")}`}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#63675D]">
                    {loading && !hasLoadedOnce
                      ? t("loadingWorkersMsg")
                      : workers.length === 0
                        ? t("noWorkersMsg")
                        : `${workers.length} ${
                            workers.length === 1
                              ? t("verifiedWorkersAccountSingular")
                              : t("verifiedWorkersAccountPlural")
                          } · ${t("availableWorkersPrefix")}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectTab("workers")}
                    className="mt-4 inline-flex items-center justify-center gap-2 border border-[#233B32] bg-[#FAF8F2] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[#233B32] transition-colors hover:bg-[#233B32] hover:text-[#F4F1E8]"
                  >
                    <HardHat className="h-3.5 w-3.5" />
                    <span>
                      {workers.length === 0
                        ? t("createFirstWorker")
                        : t("manageFieldWorkers")}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            {/* Error & Action Banners */}
            {error && (
              <div
                role="alert"
                className="flex flex-col items-start justify-between gap-3 border border-[#A65F45]/50 bg-[#FAF8F2] p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-2.5 text-sm text-[#864832]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={triggerReload}
                  className="border border-[#A65F45] bg-[#A65F45] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#F4F1E8]"
                >
                  {t("retry")}
                </button>
              </div>
            )}

            {actionBanner && (
              <div
                role={actionBanner.type === "error" ? "alert" : "status"}
                className={`flex items-start justify-between gap-3 border bg-[#FAF8F2] p-4 text-sm ${
                  actionBanner.type === "error"
                    ? "border-[#864832]/50 text-[#864832]"
                    : "border-[#233B32]/40 text-[#233B32]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {actionBanner.type === "error" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{actionBanner.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionBanner(null)}
                  className="font-mono text-[10px] uppercase tracking-wider text-[#777B70] hover:text-[#292D2A]"
                >
                  {t("dismiss")}
                </button>
              </div>
            )}

            {/* Tab Views */}
            {activeTab === "workers" ? (
              <section className="space-y-6">
                <RoadLineDivider label={t("dividerAdminWorkers")} />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Worker Roster */}
                  <div className="border border-[#DEDCCF] bg-[#FAF8F2] lg:col-span-7">
                    <div className="border-b border-[#DEDCCF] px-6 py-4">
                      <h2 className="text-base font-semibold text-[#292D2A]">
                        {t("registeredWorkers")}
                      </h2>
                      <p className="mt-0.5 text-xs text-[#777B70]">
                        {t("realWorkerAccountsDesc")}
                      </p>
                    </div>

                    {loading && workers.length === 0 ? (
                      <div className="space-y-3 p-6">
                        {[1, 2].map((row) => (
                          <div
                            key={row}
                            className="h-14 animate-pulse border border-[#DEDCCF]/60 bg-[#EFECE1]/70"
                          />
                        ))}
                      </div>
                    ) : workers.length === 0 ? (
                      <div className="px-6 py-12 text-center">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center border border-[#DEDCCF] bg-[#F4F1E8] text-[#A65F45]">
                          <HardHat className="h-5 w-5" />
                        </div>
                        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
                          {t("noWorkerAccountsFound")}
                        </p>
                        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#777B70]">
                          {t("workerProvisioningNote")}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#DEDCCF]">
                        {workers.map((worker) => (
                          <div
                            key={worker.id}
                            className="flex flex-col justify-between gap-3 px-6 py-4 sm:flex-row sm:items-center"
                          >
                            <div>
                              <p className="font-medium text-[#292D2A]">
                                {worker.name}
                              </p>
                              <p className="font-mono text-xs text-[#777B70]">
                                {worker.email}
                                {worker.phone ? ` · ${worker.phone}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="border border-[#DEDCCF] bg-[#F4F1E8] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#233B32]">
                                {worker.activeAssignments}{" "}
                                {worker.activeAssignments === 1
                                  ? t("activeJobSingular")
                                  : t("activeJobPlural")}
                              </span>
                              <span className="font-mono text-[10px] text-[#777B70]">
                                {t("joinedLabel")} {formatDate(worker.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Admin-Only Create Worker Account Form */}
                  <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-6 lg:col-span-5">
                    <div className="flex items-center gap-2 border-b border-[#DEDCCF] pb-3">
                      <UserPlus className="h-4 w-4 text-[#233B32]" />
                      <h2 className="text-base font-semibold text-[#292D2A]">
                        {t("createWorkerAccount")}
                      </h2>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#777B70]">
                      {t("adminProvisioningDesc")}
                    </p>

                    {workerFormMessage && (
                      <div
                        role={
                          workerFormMessage.type === "error"
                            ? "alert"
                            : "status"
                        }
                        className={`mt-4 border p-3 text-xs ${
                          workerFormMessage.type === "error"
                            ? "border-[#864832]/50 bg-[#F4F1E8] text-[#864832]"
                            : "border-[#233B32]/40 bg-[#F4F1E8] text-[#233B32]"
                        }`}
                      >
                        {workerFormMessage.message}
                      </div>
                    )}

                    <form
                      onSubmit={handleCreateWorker}
                      className="mt-4 space-y-3.5"
                      noValidate
                    >
                      <div>
                        <label
                          htmlFor="worker-name"
                          className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#292D2A]"
                        >
                          {t("fullName")}
                        </label>
                        <input
                          id="worker-name"
                          type="text"
                          required
                          value={workerForm.name}
                          onChange={(e) =>
                            setWorkerForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="e.g., Harpreet Singh"
                          className="h-10 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:bg-[#FAF8F2] focus:outline-none"
                        />
                        {workerFieldErrors.name && (
                          <p className="mt-1 text-xs text-[#864832]">
                            {workerFieldErrors.name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="worker-email"
                          className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#292D2A]"
                        >
                          {t("emailAddress")}
                        </label>
                        <input
                          id="worker-email"
                          type="email"
                          required
                          value={workerForm.email}
                          onChange={(e) =>
                            setWorkerForm((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="harpreet.singh@example.in"
                          className="h-10 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:bg-[#FAF8F2] focus:outline-none"
                        />
                        {workerFieldErrors.email && (
                          <p className="mt-1 text-xs text-[#864832]">
                            {workerFieldErrors.email}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="worker-phone"
                          className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#292D2A]"
                        >
                          {t("phoneNumber")} ({t("indianPhoneHint")} · {t("optional")})
                        </label>
                        <input
                          id="worker-phone"
                          type="tel"
                          value={workerForm.phone}
                          onChange={(e) =>
                            setWorkerForm((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="+91 98765 43210"
                          className="h-10 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:bg-[#FAF8F2] focus:outline-none"
                        />
                        {workerFieldErrors.phone && (
                          <p className="mt-1 text-xs text-[#864832]">
                            {workerFieldErrors.phone}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="worker-password"
                          className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#292D2A]"
                        >
                          {t("initialPassword")}
                        </label>
                        <input
                          id="worker-password"
                          type="password"
                          required
                          value={workerForm.password}
                          onChange={(e) =>
                            setWorkerForm((prev) => ({
                              ...prev,
                              password: e.target.value,
                            }))
                          }
                          placeholder={t("passwordPlaceholderRegister")}
                          className="h-10 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:bg-[#FAF8F2] focus:outline-none"
                        />
                        {workerFieldErrors.password && (
                          <p className="mt-1 text-xs text-[#864832]">
                            {workerFieldErrors.password}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={workerSubmitting}
                        className="mt-2 flex h-10 w-full items-center justify-center gap-2 bg-[#233B32] px-4 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:opacity-50"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>
                          {workerSubmitting
                            ? t("creatingWorker")
                            : t("createWorkerBtn")}
                        </span>
                      </button>
                    </form>
                  </div>
                </div>
              </section>
            ) : activeTab === "profile" ? (
              <section className="space-y-6">
                <RoadLineDivider label={t("dividerAdminDossier")} />
                <div className="border border-[#DEDCCF] bg-[#FAF8F2]">
                  <div className="border-b border-[#DEDCCF] px-6 py-5 sm:px-8">
                    <h2 className="text-lg font-semibold text-[#292D2A]">
                      {t("verifiedAdminDetails")}
                    </h2>
                  </div>
                  <dl className="grid grid-cols-1 divide-y divide-[#DEDCCF] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                    <div className="p-6 sm:border-b sm:border-[#DEDCCF]">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        {t("fullName")}
                      </dt>
                      <dd className="mt-2 text-base font-medium text-[#292D2A]">
                        {user?.name}
                      </dd>
                    </div>
                    <div className="p-6 sm:border-b sm:border-[#DEDCCF]">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        {t("emailAddress")}
                      </dt>
                      <dd className="mt-2 font-mono text-sm text-[#292D2A]">
                        {user?.email}
                      </dd>
                    </div>
                    <div className="p-6">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        {t("roleLabel")}
                      </dt>
                      <dd className="mt-2 font-mono text-xs uppercase tracking-wider text-[#233B32]">
                        {user?.role === "admin"
                          ? t("roleAdmin")
                          : user?.role === "worker"
                            ? t("roleWorker")
                            : t("roleCitizen")}
                      </dd>
                    </div>
                    <div className="p-6">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        {t("registeredLabel")}
                      </dt>
                      <dd className="mt-2 font-mono text-xs text-[#292D2A]">
                        {formatDate(user?.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            ) : (
              <>
                {/* Status Metrics */}
                <section aria-label="Admin complaint metrics" className="space-y-4">
                  <RoadLineDivider label={t("dividerAdminMetrics")} />
                  <div className="grid grid-cols-2 border border-[#DEDCCF] bg-[#FAF8F2] lg:grid-cols-4">
                    {metricCards.map((metric, idx) => (
                      <div
                        key={metric.code}
                        className={`p-5 sm:p-6 ${
                          idx % 2 === 0 ? "border-r border-[#DEDCCF]" : ""
                        } ${
                          idx < 2 ? "border-b border-[#DEDCCF] lg:border-b-0" : ""
                        } ${
                          idx < 3 ? "lg:border-r lg:border-[#DEDCCF]" : "lg:border-r-0"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]">
                            {metric.label}
                          </span>
                          <span className="font-mono text-[10px] text-[#777B70]/70">
                            {metric.code}
                          </span>
                        </div>
                        <p
                          className={`mt-3 text-3xl font-light tracking-tight tabular-nums sm:text-4xl ${metric.color}`}
                        >
                          {metric.value}
                        </p>
                        <p className="mt-1.5 text-xs text-[#777B70]">
                          {metric.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Filter & Complaint Docket */}
                <section className="space-y-4">
                  <RoadLineDivider label={t("dividerAdminTriage")} />

                  <div className="border border-[#DEDCCF] bg-[#FAF8F2]">
                    {/* Filter Bar */}
                    <div className="flex flex-col justify-between gap-4 border-b border-[#DEDCCF] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]">
                          <Filter className="h-3.5 w-3.5 text-[#A65F45]" />
                          {t("filtersLabel")}
                        </span>

                        <select
                          aria-label="Filter by complaint status"
                          value={statusFilter}
                          onChange={(e) =>
                            handleFilterChange(setStatusFilter, e.target.value)
                          }
                          className="h-9 border border-[#DEDCCF] bg-[#F4F1E8] px-3 font-mono text-xs text-[#292D2A] focus:border-[#233B32] focus:outline-none"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {t(opt.labelKey)}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label="Filter by complaint priority"
                          value={priorityFilter}
                          onChange={(e) =>
                            handleFilterChange(
                              setPriorityFilter,
                              e.target.value
                            )
                          }
                          className="h-9 border border-[#DEDCCF] bg-[#F4F1E8] px-3 font-mono text-xs text-[#292D2A] focus:border-[#233B32] focus:outline-none"
                        >
                          {PRIORITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {t(opt.labelKey)}
                            </option>
                          ))}
                        </select>

                        {(statusFilter || priorityFilter) && (
                          <button
                            type="button"
                            onClick={() => {
                              setStatusFilter("");
                              setPriorityFilter("");
                              setPage(1);
                            }}
                            className="font-mono text-[10px] uppercase tracking-wider text-[#A65F45] underline underline-offset-4 hover:text-[#864832]"
                          >
                            {t("reset")}
                          </button>
                        )}
                      </div>

                      <span className="font-mono text-[11px] uppercase tracking-wider text-[#777B70]">
                        {pagination.total}{" "}
                        {pagination.total === 1
                          ? t("complaintSingular")
                          : t("complaintPlural")}
                      </span>
                    </div>

                    {loading ? (
                      <div className="space-y-3 p-6">
                        {[1, 2, 3].map((row) => (
                          <div
                            key={row}
                            className="h-16 animate-pulse border border-[#DEDCCF]/60 bg-[#EFECE1]/70"
                          />
                        ))}
                      </div>
                    ) : complaints.length === 0 ? (
                      <div className="px-6 py-14 text-center">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
                          {t("noMatchingRecords")}
                        </p>
                        <h3 className="mt-2 text-base font-medium text-[#292D2A]">
                          {t("noMatchingFilterDesc")}
                        </h3>
                      </div>
                    ) : (
                      <>
                        <div className="divide-y divide-[#DEDCCF]">
                          {complaints.map((complaint) => {
                            const isExpanded = expandedId === complaint.id;
                            const defaultWorkerId =
                              complaint.assignment?.workerId ||
                              workers[0]?.id ||
                              "";
                            const selectedAssignWorkerId =
                              assignWorkerIds[complaint.id];
                            const activeDropdownWorkerId =
                              selectedAssignWorkerId &&
                              workers.some(
                                (w) => w.id === selectedAssignWorkerId
                              )
                                ? selectedAssignWorkerId
                                : defaultWorkerId;

                            return (
                              <article
                                key={complaint.id}
                                className="p-5 transition-colors hover:bg-[#F4F1E8]/45 sm:px-6 sm:py-5"
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="flex min-w-0 flex-1 items-start gap-4">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedId(
                                          isExpanded ? null : complaint.id
                                        )
                                      }
                                      className="relative h-20 w-24 shrink-0 overflow-hidden border border-[#DEDCCF] bg-[#EFECE1]"
                                      aria-label={`Inspect ${complaint.title}`}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={complaint.imageUrl}
                                        alt={complaint.title}
                                        className="h-full w-full object-cover"
                                      />
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-[11px] uppercase tracking-wider text-[#A65F45]">
                                          #{complaint.id.slice(-6).toUpperCase()}
                                        </span>
                                        <span className="font-mono text-[11px] text-[#777B70]">
                                          · {formatDate(complaint.createdAt)}
                                        </span>
                                        {complaint.citizen && (
                                          <span className="font-mono text-[11px] text-[#777B70]">
                                            · {complaint.citizen.name}
                                          </span>
                                        )}
                                      </div>

                                      <h3 className="mt-1 text-base font-medium text-[#292D2A]">
                                        {complaint.title}
                                      </h3>

                                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#63675D]">
                                        <span className="inline-flex items-center gap-1">
                                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#A65F45]" />
                                          <span className="max-w-xs truncate">
                                            {formatLocation(complaint.location)}
                                          </span>
                                        </span>
                                        {complaint.assignment && (
                                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#233B32]">
                                            <HardHat className="h-3 w-3" />
                                            {complaint.assignment.workerName}
                                          </span>
                                        )}
                                        {complaint.repairVerification
                                          ?.verificationStatus === "pending" && (
                                          <span className="border border-[#9A6A32]/40 bg-[#9A6A32]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#724E24]">
                                            {t("repairPendingVerification")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
                                    <PriorityBadge
                                      priority={complaint.priority}
                                    />
                                    <StatusBadge status={complaint.status} />
                                    <DetectionSummaryBadge
                                      detection={complaint.detection}
                                      reportCategory={complaint.reportCategory}
                                      compact
                                    />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedId(
                                          isExpanded ? null : complaint.id
                                        )
                                      }
                                      aria-expanded={isExpanded}
                                      className="inline-flex items-center gap-1.5 border border-[#DEDCCF] bg-[#F4F1E8] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] transition-colors hover:border-[#233B32]"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      <span>
                                        {isExpanded ? t("close") : t("manage")}
                                      </span>
                                      {isExpanded ? (
                                        <ChevronUp className="h-3 w-3" />
                                      ) : (
                                        <ChevronDown className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="mt-5 space-y-4">
                                    <ComplaintEvidencePanel
                                      complaint={complaint}
                                    />

                                    {/* Admin Operations Panel */}
                                    <div className="border border-[#233B32]/25 bg-[#FAF8F2] p-4 sm:p-5">
                                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#233B32]">
                                        {t("adminTriageControls")}
                                      </p>

                                      {/* 1. Verify or Reject Pending Complaint */}
                                      {complaint.status === "pending" && (
                                        <div className="mt-4 space-y-3">
                                          <label
                                            htmlFor={`review-note-${complaint.id}`}
                                            className="block font-mono text-[10px] uppercase tracking-wider text-[#777B70]"
                                          >
                                            {t("reviewNoteLabel")}
                                          </label>
                                          <textarea
                                            id={`review-note-${complaint.id}`}
                                            rows={2}
                                            value={
                                              reviewNotes[complaint.id] || ""
                                            }
                                            onChange={(e) =>
                                              setReviewNotes((prev) => ({
                                                ...prev,
                                                [complaint.id]: e.target.value,
                                              }))
                                            }
                                            placeholder={t("reviewNotePlaceholder")}
                                            className="w-full border border-[#DEDCCF] bg-[#F4F1E8] p-2.5 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none"
                                          />
                                          <div className="flex flex-wrap gap-3">
                                            <button
                                              type="button"
                                              disabled={
                                                actionLoadingKey ===
                                                `review-${complaint.id}`
                                              }
                                              onClick={() =>
                                                handleReviewComplaint(
                                                  complaint.id,
                                                  "verify"
                                                )
                                              }
                                              className="inline-flex items-center gap-1.5 bg-[#233B32] px-4 py-2 text-xs font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:opacity-50"
                                            >
                                              <ShieldCheck className="h-3.5 w-3.5" />
                                              <span>{t("verifyComplaint")}</span>
                                            </button>
                                            <button
                                              type="button"
                                              disabled={
                                                actionLoadingKey ===
                                                `review-${complaint.id}`
                                              }
                                              onClick={() =>
                                                handleReviewComplaint(
                                                  complaint.id,
                                                  "reject"
                                                )
                                              }
                                              className="inline-flex items-center gap-1.5 border border-[#864832] bg-[#FAF8F2] px-4 py-2 text-xs font-medium text-[#864832] transition-colors hover:bg-[#A65F45]/10 disabled:opacity-50"
                                            >
                                              <XCircle className="h-3.5 w-3.5" />
                                              <span>{t("rejectComplaint")}</span>
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* 2. Assign / Reassign Verified or Assigned Complaint */}
                                      {(complaint.status === "verified" ||
                                        complaint.status === "assigned") && (
                                        <div className="mt-4 space-y-3">
                                          {loading && workers.length === 0 ? (
                      <div className="space-y-3 p-6">
                        {[1, 2].map((row) => (
                          <div
                            key={row}
                            className="h-14 animate-pulse border border-[#DEDCCF]/60 bg-[#EFECE1]/70"
                          />
                        ))}
                      </div>
                    ) : workers.length === 0 ? (
                                            <div className="flex flex-col items-start justify-between gap-3 border border-[#A65F45]/40 bg-[#F4F1E8] p-4 sm:flex-row sm:items-center">
                                              <p className="text-xs leading-5 text-[#864832]">
                                                {t("noWorkersSystemMsg")}
                                              </p>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleSelectTab("workers")
                                                }
                                                className="shrink-0 bg-[#233B32] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#F4F1E8]"
                                              >
                                                {t("createWorkerShort")}
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                                              <div className="md:col-span-5">
                                                  <label
                                                    htmlFor={`assign-worker-${complaint.id}`}
                                                    className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-[#777B70]"
                                                  >
                                                    {complaint.status ===
                                                    "assigned"
                                                      ? t("reassignWorker")
                                                      : t("assignWorker")}
                                                  </label>
                                                  <select
                                                    id={`assign-worker-${complaint.id}`}
                                                    value={activeDropdownWorkerId}
                                                    onChange={(e) =>
                                                      setAssignWorkerIds(
                                                        (prev) => ({
                                                          ...prev,
                                                          [complaint.id]:
                                                            e.target.value,
                                                        })
                                                      )
                                                    }
                                                    className="h-10 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none"
                                                  >
                                                    {workers.map((w) => (
                                                      <option
                                                        key={w.id}
                                                        value={w.id}
                                                      >
                                                        {w.name} ({w.email}) ·{" "}
                                                        {w.activeAssignments}{" "}
                                                        {t("activeShort")}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </div>
                                                <div className="md:col-span-5">
                                                  <label
                                                    htmlFor={`assign-note-${complaint.id}`}
                                                    className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-[#777B70]"
                                                  >
                                                    {t("dispatchNoteLabel")}
                                                  </label>
                                                  <input
                                                    id={`assign-note-${complaint.id}`}
                                                    type="text"
                                                    value={
                                                      assignNotes[complaint.id] ||
                                                      ""
                                                    }
                                                    onChange={(e) =>
                                                      setAssignNotes((prev) => ({
                                                        ...prev,
                                                        [complaint.id]:
                                                          e.target.value,
                                                      }))
                                                    }
                                                    placeholder={t("dispatchNotePlaceholder")}
                                                    className="h-10 w-full border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none"
                                                  />
                                                </div>
                                                <div className="flex items-end md:col-span-2">
                                                  <button
                                                    type="button"
                                                    disabled={
                                                      actionLoadingKey ===
                                                      `assign-${complaint.id}`
                                                    }
                                                    onClick={() =>
                                                      handleAssignWorker(
                                                        complaint.id,
                                                        activeDropdownWorkerId
                                                      )
                                                    }
                                                    className="h-10 w-full bg-[#233B32] px-3 text-xs font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:opacity-50"
                                                  >
                                                    {complaint.status ===
                                                    "assigned"
                                                      ? t("reassignBtn")
                                                      : t("assignBtn")}
                                                  </button>
                                                </div>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* 3. Repair Verification Approval/Rejection */}
                                      {complaint.status === "in_progress" &&
                                        complaint.repairVerification
                                          ?.verificationStatus ===
                                          "pending" && (
                                          <div className="mt-4 space-y-3 border-t border-dashed border-[#DEDCCF] pt-4">
                                            <p className="text-xs font-medium text-[#233B32]">
                                              {t("repairEvidenceSubmittedPrefix")}{" "}
                                              {formatDateTime(
                                                complaint.repairVerification
                                                  .createdAt
                                              )}
                                              . {t("reviewBeforeResolveSuffix")}
                                            </p>
                                            <textarea
                                              rows={2}
                                              value={
                                                repairReviewNotes[
                                                  complaint.id
                                                ] || ""
                                              }
                                              onChange={(e) =>
                                                setRepairReviewNotes(
                                                  (prev) => ({
                                                    ...prev,
                                                    [complaint.id]:
                                                      e.target.value,
                                                  })
                                                )
                                              }
                                              placeholder={t("repairReviewNotePlaceholder")}
                                              className="w-full border border-[#DEDCCF] bg-[#F4F1E8] p-2.5 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none"
                                            />
                                            <div className="flex flex-wrap gap-3">
                                              <button
                                                type="button"
                                                disabled={
                                                  actionLoadingKey ===
                                                  `repair-${complaint.id}`
                                                }
                                                onClick={() =>
                                                  handleRepairVerification(
                                                    complaint.id,
                                                    "approve"
                                                  )
                                                }
                                                className="inline-flex items-center gap-1.5 bg-[#233B32] px-4 py-2 text-xs font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:opacity-50"
                                              >
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                <span>
                                                  {t("approveRepairBtn")}
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                disabled={
                                                  actionLoadingKey ===
                                                  `repair-${complaint.id}`
                                                }
                                                onClick={() =>
                                                  handleRepairVerification(
                                                    complaint.id,
                                                    "reject"
                                                  )
                                                }
                                                className="inline-flex items-center gap-1.5 border border-[#864832] bg-[#FAF8F2] px-4 py-2 text-xs font-medium text-[#864832] transition-colors hover:bg-[#A65F45]/10 disabled:opacity-50"
                                              >
                                                <XCircle className="h-3.5 w-3.5" />
                                                <span>
                                                  {t("rejectRepairBtn")}
                                                </span>
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                      {complaint.status === "in_progress" &&
                                        complaint.repairVerification
                                          ?.verificationStatus !==
                                          "pending" && (
                                          <p className="mt-3 text-xs text-[#777B70]">
                                            {t("fieldWorkInProgressPrefix")}{" "}
                                            {complaint.assignment?.workerName ||
                                              t("roleWorker")}
                                            . {t("awaitingRepairUploadSuffix")}
                                          </p>
                                        )}

                                      {(complaint.status === "resolved" ||
                                        complaint.status === "rejected") && (
                                        <p className="mt-3 text-xs text-[#777B70]">
                                          {t("complaintClosedPrefix")} (
                                          {t(`status_${complaint.status}`)}).{" "}
                                          {t("noDispatchRequiredSuffix")}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>

                        {pagination.totalPages > 1 && (
                          <div className="flex flex-col items-center justify-between gap-3 border-t border-[#DEDCCF] bg-[#EFECE1]/50 px-6 py-4 sm:flex-row">
                            <p className="font-mono text-[11px] text-[#777B70]">
                              {t("pageLabel")} {pagination.page} {t("ofLabel")}{" "}
                              {pagination.totalPages} · {pagination.total}{" "}
                              {t("totalLabel")}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPage((prev) => Math.max(1, prev - 1))
                                }
                                disabled={!pagination.hasPrevPage}
                                className="inline-flex items-center gap-1 border border-[#DEDCCF] bg-[#FAF8F2] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] hover:border-[#233B32] disabled:opacity-45"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                <span>{t("previous")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPage((prev) => prev + 1)}
                                disabled={!pagination.hasNextPage}
                                className="inline-flex items-center gap-1 border border-[#DEDCCF] bg-[#FAF8F2] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A] hover:border-[#233B32] disabled:opacity-45"
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
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
