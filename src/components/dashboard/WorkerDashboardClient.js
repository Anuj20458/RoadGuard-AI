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
  Eye,
  Filter,
  HardHat,
  ImagePlus,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Play,
  RefreshCw,
  Send,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/components/LanguageProvider";
import {
  formatDate,
  formatDateTime,
  formatLocation,
} from "@/lib/formatters";
import ComplaintEvidencePanel from "./ComplaintEvidencePanel";
import { PriorityBadge, StatusBadge } from "./StatusBadge";
import {
  RoadGuardWordmark,
  RoadLineDivider,
  TopographicContours,
} from "./UrbanMotifs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const NAV_ITEMS = [
  { id: "queue", index: "01", labelKey: "navAssignedQueue", icon: HardHat },
  { id: "profile", index: "02", labelKey: "navProfile", icon: UserIcon },
];

const WORKER_STATUS_OPTIONS = [
  { value: "", labelKey: "allAssigned" },
  { value: "assigned", labelKey: "status_assigned" },
  { value: "in_progress", labelKey: "status_in_progress" },
  { value: "resolved", labelKey: "status_resolved" },
];

const INITIAL_STATS = {
  total: 0,
  assigned: 0,
  in_progress: 0,
  resolved: 0,
  pendingVerification: 0,
};

/**
 * Protected Field Worker Portal showing only complaints assigned to the
 * authenticated worker, allowing work start and after-repair evidence upload.
 *
 * @param {{ initialUser: { id: string, name: string, email: string, role: string, phone?: string, createdAt?: string } }} props
 */
export default function WorkerDashboardClient({ initialUser }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [user] = useState(initialUser);
  const [activeTab, setActiveTab] = useState("queue");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [stats, setStats] = useState(INITIAL_STATS);
  const [complaints, setComplaints] = useState([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  // Per-complaint worker states
  const [startNotes, setStartNotes] = useState({});
  const [repairNotes, setRepairNotes] = useState({});
  const [uploadedAfterImages, setUploadedAfterImages] = useState({});
  const [uploadingId, setUploadingId] = useState("");
  const [uploadErrors, setUploadErrors] = useState({});
  const [submittingKey, setSubmittingKey] = useState("");
  const [actionBanner, setActionBanner] = useState(null);

  useEffect(() => {
    let active = true;

    async function syncWorkerComplaints() {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "10",
        });
        if (statusFilter) params.set("status", statusFilter);

        const res = await fetch(
          `/api/worker/complaints?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

        if (res.status === 401 || res.status === 403) {
          if (active) {
            router.push("/login");
            router.refresh();
          }
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Unable to load assigned complaints.");
        }

        if (active) {
          setStats(data.stats || INITIAL_STATS);
          setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
          setPagination(
            data.pagination || {
              page,
              limit: 10,
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
            }
          );
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err?.message || "Unable to sync assigned job queue.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    syncWorkerComplaints();
    return () => {
      active = false;
    };
  }, [page, reloadKey, router, statusFilter]);

  const triggerReload = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((prev) => prev + 1);
  }, []);

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

  async function handleStartWork(complaintId) {
    setSubmittingKey(`start-${complaintId}`);
    setActionBanner(null);

    try {
      const res = await fetch(`/api/worker/complaints/${complaintId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "in_progress",
          note: (startNotes[complaintId] || "").trim(),
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
          message: data?.error || "Unable to mark complaint in progress.",
        });
        return;
      }

      setStartNotes((prev) => ({ ...prev, [complaintId]: "" }));
      setActionBanner({
        type: "success",
        message: `Complaint #${complaintId.slice(-6).toUpperCase()} marked In Progress.`,
      });
      triggerReload();
    } catch {
      setActionBanner({
        type: "error",
        message: "Network error while updating job status.",
      });
    } finally {
      setSubmittingKey("");
    }
  }

  async function handleRepairImageSelect(complaintId, file) {
    if (!file) return;

    setUploadErrors((prev) => ({ ...prev, [complaintId]: "" }));
    setActionBanner(null);

    if (!ALLOWED_IMAGE_TYPES.has((file.type || "").toLowerCase())) {
      setUploadErrors((prev) => ({
        ...prev,
        [complaintId]: "Only JPEG, PNG, and WebP images are allowed.",
      }));
      return;
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      setUploadErrors((prev) => ({
        ...prev,
        [complaintId]: "Repair image must be non-empty and under 5 MB.",
      }));
      return;
    }

    setUploadingId(complaintId);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/worker/upload", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        router.refresh();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setUploadErrors((prev) => ({
          ...prev,
          [complaintId]: data?.error || "Unable to upload repair photo.",
        }));
        return;
      }

      setUploadedAfterImages((prev) => ({
        ...prev,
        [complaintId]: {
          imageUrl: data.imageUrl,
          fileName: file.name,
        },
      }));
    } catch {
      setUploadErrors((prev) => ({
        ...prev,
        [complaintId]: "Network error while uploading repair photo.",
      }));
    } finally {
      setUploadingId("");
    }
  }

  async function handleSubmitRepair(event, complaintId) {
    event.preventDefault();
    const uploaded = uploadedAfterImages[complaintId];
    const notes = (repairNotes[complaintId] || "").trim();

    if (!uploaded?.imageUrl) {
      setActionBanner({
        type: "error",
        message: "Please upload an after-repair photo before submitting.",
      });
      return;
    }

    if (notes.length < 5) {
      setActionBanner({
        type: "error",
        message: "Please enter repair notes (at least 5 characters).",
      });
      return;
    }

    setSubmittingKey(`repair-${complaintId}`);
    setActionBanner(null);

    try {
      const res = await fetch(`/api/worker/complaints/${complaintId}/repair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          afterImage: uploaded.imageUrl,
          repairNotes: notes,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        router.refresh();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        const detailMsg =
          data?.details?.afterImage ||
          data?.details?.repairNotes ||
          data?.error;
        setActionBanner({
          type: "error",
          message: detailMsg || "Unable to submit repair evidence.",
        });
        return;
      }

      setUploadedAfterImages((prev) => {
        const next = { ...prev };
        delete next[complaintId];
        return next;
      });
      setRepairNotes((prev) => ({ ...prev, [complaintId]: "" }));
      setActionBanner({
        type: "success",
        message: `Repair evidence submitted for #${complaintId.slice(-6).toUpperCase()}. Complaint remains In Progress until an admin verifies the repair.`,
      });
      triggerReload();
    } catch {
      setActionBanner({
        type: "error",
        message: "Network error while submitting repair evidence.",
      });
    } finally {
      setSubmittingKey("");
    }
  }

  const metricCards = [
    {
      label: t("assignedJobs"),
      code: "WRK-01",
      value: stats.total,
      note: t("workerStatNoteTotal"),
      color: "text-[#292D2A]",
    },
    {
      label: t("awaitingStart"),
      code: "WRK-02",
      value: stats.assigned,
      note: t("workerStatNoteAssigned"),
      color: "text-[#A65F45]",
    },
    {
      label: t("inProgress"),
      code: "WRK-03",
      value: stats.in_progress,
      note: `${stats.pendingVerification} ${t("pendingLabel").toLowerCase()}`,
      color: "text-[#292D2A]",
    },
    {
      label: t("adminResolved"),
      code: "WRK-04",
      value: stats.resolved,
      note: t("workerStatNoteResolved"),
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
              {t("fieldOperations")}
            </p>
          </div>

          <nav aria-label="Worker portal navigation" className="space-y-1 px-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
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
              {t("rolePrefix")}: {t("roleWorker")}
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
              <span>{t("workerPortalLabel")}</span>
              <span className="text-[#DEDCCF]">/</span>
              <span className="text-[#292D2A]">
                {t(
                  NAV_ITEMS.find((item) => item.id === activeTab)?.labelKey ||
                    "navAssignedQueue"
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
                <span>{t("refresh")}</span>
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto max-w-6xl space-y-8">
            <section className="relative overflow-hidden border border-[#DEDCCF] bg-[#FAF8F2]">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="relative p-6 sm:p-8 lg:col-span-8 lg:border-r lg:border-[#DEDCCF]">
                  <div className="pointer-events-none absolute right-0 bottom-0 h-44 w-72 opacity-80">
                    <TopographicContours />
                  </div>
                  <div className="relative z-10">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#A65F45]">
                      {t("workerPortalLabel")}
                    </p>
                    <h1 className="mt-2 text-2xl font-light tracking-tight text-[#292D2A] sm:text-3xl">
                      {t("crewLead")}:{" "}
                      <span className="font-semibold text-[#233B32]">
                        {user?.name}
                      </span>
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[#777B70]">
                      {t("workerPortalIntro")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col justify-between bg-[#EFECE1]/75 p-6 sm:p-8 lg:col-span-4">
                  <div className="flex items-center justify-between border-b border-[#DEDCCF] pb-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                      {t("verificationRule")}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#233B32]">
                      {t("adminSignOff")}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#63675D]">
                    {t("verificationRuleDesc")}
                  </p>
                </div>
              </div>
            </section>

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

            {activeTab === "profile" ? (
              <section className="space-y-6">
                <RoadLineDivider label={t("dividerWorkerDossier")} />
                <div className="border border-[#DEDCCF] bg-[#FAF8F2]">
                  <div className="border-b border-[#DEDCCF] px-6 py-5 sm:px-8">
                    <h2 className="text-lg font-semibold text-[#292D2A]">
                      {t("verifiedAccountDetails")}
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
                        {t("phoneNumber")}
                      </dt>
                      <dd className="mt-2 font-mono text-sm text-[#292D2A]">
                        {user?.phone || t("notProvided")}
                      </dd>
                    </div>
                    <div className="p-6">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
                        {t("roleAndRegistration")}
                      </dt>
                      <dd className="mt-2 font-mono text-xs text-[#233B32]">
                        {user?.role === "admin"
                          ? t("roleAdmin")
                          : user?.role === "worker"
                            ? t("roleWorker")
                            : t("roleCitizen")}{" "}
                        · {formatDate(user?.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            ) : (
              <>
                <section aria-label="Worker queue metrics" className="space-y-4">
                  <RoadLineDivider label={t("dividerWorkerWorkload")} />
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

                <section className="space-y-4">
                  <RoadLineDivider label={t("dividerWorkerAssigned")} />

                  <div className="border border-[#DEDCCF] bg-[#FAF8F2]">
                    <div className="flex flex-col justify-between gap-3 border-b border-[#DEDCCF] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]">
                          <Filter className="h-3.5 w-3.5 text-[#A65F45]" />
                          {t("queueFilter")}
                        </span>
                        <select
                          aria-label="Filter assigned complaints by status"
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                            setExpandedId(null);
                          }}
                          className="h-9 border border-[#DEDCCF] bg-[#F4F1E8] px-3 font-mono text-xs text-[#292D2A] focus:border-[#233B32] focus:outline-none"
                        >
                          {WORKER_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {t(opt.labelKey)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="font-mono text-[11px] uppercase tracking-wider text-[#777B70]">
                        {pagination.total}{" "}
                        {pagination.total === 1
                          ? t("assignmentSingular")
                          : t("assignmentPlural")}
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
                        <div className="mx-auto flex h-11 w-11 items-center justify-center border border-[#DEDCCF] bg-[#F4F1E8] text-[#233B32]">
                          <HardHat className="h-5 w-5" />
                        </div>
                        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
                          {t("noAssignedComplaints")}
                        </p>
                        <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#777B70]">
                          {t("noAssignedDesc")}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="divide-y divide-[#DEDCCF]">
                          {complaints.map((complaint) => {
                            const isExpanded = expandedId === complaint.id;
                            const uploadedAfter =
                              uploadedAfterImages[complaint.id] || null;
                            const repairStatus =
                              complaint.repairVerification?.verificationStatus;
                            const canSubmitRepair =
                              (complaint.status === "assigned" ||
                                complaint.status === "in_progress") &&
                              repairStatus !== "pending";

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
                                      aria-label={`Inspect assignment ${complaint.title}`}
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
                                          · {t("assignedPrefix")}{" "}
                                          {formatDate(
                                            complaint.assignment?.assignedAt
                                          )}
                                        </span>
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
                                        {repairStatus && (
                                          <span className="border border-[#DEDCCF] bg-[#F4F1E8] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#292D2A]">
                                            {t("repairPrefix")}:{" "}
                                            {["pending", "approved", "rejected"].includes(repairStatus)
                                              ? t(`verification_${repairStatus}`)
                                              : repairStatus}
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
                                        {isExpanded ? t("close") : t("workOrder")}
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

                                    <div className="border border-[#233B32]/25 bg-[#FAF8F2] p-4 sm:p-5">
                                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#233B32]">
                                        {t("fieldWorkExecution")}
                                      </p>

                                      {/* Accept / Mark In Progress */}
                                      {complaint.status === "assigned" && (
                                        <div className="mt-4 space-y-3 border-b border-dashed border-[#DEDCCF] pb-4">
                                          <p className="text-xs text-[#63675D]">
                                            {t("acceptAssignmentDesc")}
                                          </p>
                                          <div className="flex flex-col gap-3 sm:flex-row">
                                            <input
                                              type="text"
                                              value={
                                                startNotes[complaint.id] || ""
                                              }
                                              onChange={(e) =>
                                                setStartNotes((prev) => ({
                                                  ...prev,
                                                  [complaint.id]:
                                                    e.target.value,
                                                }))
                                              }
                                              placeholder={t("startNotePlaceholder")}
                                              className="h-10 flex-1 border border-[#DEDCCF] bg-[#F4F1E8] px-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none"
                                            />
                                            <button
                                              type="button"
                                              disabled={
                                                submittingKey ===
                                                `start-${complaint.id}`
                                              }
                                              onClick={() =>
                                                handleStartWork(complaint.id)
                                              }
                                              className="inline-flex h-10 items-center justify-center gap-2 bg-[#233B32] px-4 text-xs font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:opacity-50"
                                            >
                                              <Play className="h-3.5 w-3.5" />
                                              <span>
                                                {t("acceptMarkInProgress")}
                                              </span>
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Pending Admin Verification State */}
                                      {repairStatus === "pending" && (
                                        <div className="mt-4 border border-[#9A6A32]/40 bg-[#F4F1E8] p-4 text-xs leading-5 text-[#724E24]">
                                          <p className="font-semibold">
                                            {t("repairAwaitingTitle")}
                                          </p>
                                          <p className="mt-1">
                                            {t("repairAwaitingPrefix")}{" "}
                                            {formatDateTime(
                                              complaint.repairVerification
                                                .createdAt
                                            )}
                                            . {t("repairAwaitingSuffix")}
                                          </p>
                                        </div>
                                      )}

                                      {/* Rejected Repair Notice */}
                                      {repairStatus === "rejected" &&
                                        complaint.status === "in_progress" && (
                                          <div className="mt-4 border border-[#864832]/45 bg-[#A65F45]/10 p-3.5 text-xs text-[#864832]">
                                            {t("repairRejectedNotice")}
                                          </div>
                                        )}

                                      {/* Submit Repair Evidence Form */}
                                      {canSubmitRepair && (
                                        <form
                                          onSubmit={(e) =>
                                            handleSubmitRepair(e, complaint.id)
                                          }
                                          className="mt-4 space-y-4"
                                        >
                                          <div>
                                            <p className="font-mono text-[10px] uppercase tracking-wider text-[#292D2A]">
                                              {t("afterRepairPhotoSpec")}
                                            </p>

                                            {uploadErrors[complaint.id] && (
                                              <p className="mt-1 text-xs text-[#864832]">
                                                {uploadErrors[complaint.id]}
                                              </p>
                                            )}

                                            {uploadedAfter?.imageUrl ? (
                                              <div className="mt-2 flex flex-col gap-3 border border-[#DEDCCF] bg-[#F4F1E8] p-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center gap-3">
                                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                                  <img
                                                    src={uploadedAfter.imageUrl}
                                                    alt="Uploaded after-repair preview"
                                                    className="h-16 w-20 border border-[#DEDCCF] object-cover"
                                                  />
                                                  <div>
                                                    <p className="text-xs font-medium text-[#233B32]">
                                                      {t("uploadedToCloudinary")}
                                                    </p>
                                                    <p className="font-mono text-[11px] text-[#777B70]">
                                                      {uploadedAfter.fileName}
                                                    </p>
                                                  </div>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setUploadedAfterImages(
                                                      (prev) => {
                                                        const next = {
                                                          ...prev,
                                                        };
                                                        delete next[
                                                          complaint.id
                                                        ];
                                                        return next;
                                                      }
                                                    )
                                                  }
                                                  className="inline-flex items-center gap-1 border border-[#DEDCCF] bg-[#FAF8F2] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#864832] hover:border-[#864832]"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                  <span>{t("replaceLabel")}</span>
                                                </button>
                                              </div>
                                            ) : (
                                              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 border border-dashed border-[#233B32]/40 bg-[#F4F1E8] px-4 py-5 text-xs font-medium text-[#233B32] transition-colors hover:bg-[#EFECE1]">
                                                {uploadingId ===
                                                complaint.id ? (
                                                  <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>
                                                      {t("uploadingLabel")}...
                                                    </span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <ImagePlus className="h-4 w-4 text-[#A65F45]" />
                                                    <span>
                                                      {t("selectAfterRepairPhoto")}
                                                    </span>
                                                  </>
                                                )}
                                                <input
                                                  type="file"
                                                  accept="image/jpeg,image/png,image/webp"
                                                  disabled={
                                                    uploadingId === complaint.id
                                                  }
                                                  onChange={(e) => {
                                                    const file =
                                                      e.target.files?.[0];
                                                    if (file) {
                                                      handleRepairImageSelect(
                                                        complaint.id,
                                                        file
                                                      );
                                                    }
                                                  }}
                                                  className="sr-only"
                                                />
                                              </label>
                                            )}
                                          </div>

                                          <div>
                                            <label
                                              htmlFor={`repair-notes-${complaint.id}`}
                                              className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-[#292D2A]"
                                            >
                                              {t("repairNotesLabel")}
                                            </label>
                                            <textarea
                                              id={`repair-notes-${complaint.id}`}
                                              rows={3}
                                              required
                                              value={
                                                repairNotes[complaint.id] || ""
                                              }
                                              onChange={(e) =>
                                                setRepairNotes((prev) => ({
                                                  ...prev,
                                                  [complaint.id]:
                                                    e.target.value,
                                                }))
                                              }
                                              placeholder={t("repairNotesPlaceholder")}
                                              className="w-full border border-[#DEDCCF] bg-[#F4F1E8] p-3 text-sm text-[#292D2A] focus:border-[#233B32] focus:outline-none"
                                            />
                                          </div>

                                          <button
                                            type="submit"
                                            disabled={
                                              submittingKey ===
                                                `repair-${complaint.id}` ||
                                              uploadingId === complaint.id
                                            }
                                            className="inline-flex h-10 items-center gap-2 bg-[#233B32] px-5 text-xs font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:opacity-50"
                                          >
                                            <Send className="h-3.5 w-3.5" />
                                            <span>
                                              {submittingKey ===
                                              `repair-${complaint.id}`
                                                ? t("submittingEvidence")
                                                : t("submitRepairEvidence")}
                                            </span>
                                          </button>
                                        </form>
                                      )}

                                      {complaint.status === "resolved" && (
                                        <p className="mt-3 text-xs text-[#233B32]">
                                          {t("adminVerifiedResolvedMsg")}
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
