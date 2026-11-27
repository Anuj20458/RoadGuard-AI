"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/components/LanguageProvider";
import { getRoleHomePath } from "@/lib/formatters";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import {
  RoadGuardWordmark,
  RoadLineDivider,
  TopographicContours,
} from "@/components/dashboard/UrbanMotifs";

const INITIAL_FORM = {
  name: "",
  email: "",
  phone: "",
  password: "",
};

const LABEL_CLASSES =
  "mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#292D2A]";

const ERROR_TEXT_CLASSES = "mt-1.5 text-xs font-medium text-[#864832]";

const SECONDARY_LINK_CLASSES =
  "inline-flex h-11 flex-1 items-center justify-center whitespace-nowrap border border-[#DEDCCF] bg-[#FAF8F2] px-4 text-sm font-medium text-[#292D2A] transition-colors hover:border-[#233B32] hover:text-[#233B32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65]";

function getInputClasses(hasError, extraPadding = "") {
  return `h-11 w-full border bg-[#F4F1E8] px-3.5 text-base text-[#292D2A] placeholder:text-[#63675D] transition-colors sm:text-sm focus:bg-[#FAF8F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65] ${
    hasError
      ? "border-[#864832] focus:border-[#864832]"
      : "border-[#DEDCCF] focus:border-[#233B32]"
  } ${extraPadding}`.trim();
}

/**
 * Shared editorial civic-tech authentication card for /login and /register.
 *
 * @param {{ mode: "login" | "register" }} props
 */
export default function AuthCard({ mode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const isRegister = mode === "register";
  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (active && data?.user) {
            setCurrentUser(data.user);
          }
        }
      } catch {
        // Ignore network errors during initial session probe
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    loadSession();
    return () => {
      active = false;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (serverError) {
      setServerError("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setServerError("");

    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const payload = isRegister
      ? {
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
        }
      : {
          email: form.email,
          password: form.password,
        };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.details) {
          setFieldErrors(data.details);
        }
        setServerError(data?.error || t("authFailed"));
        return;
      }

      setCurrentUser(data.user);
      setForm(INITIAL_FORM);
      router.push(getRoleHomePath(data.user?.role));
      router.refresh();
    } catch {
      setServerError(t("networkErrorRetry"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setSubmitting(true);
    setServerError("");

    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        setCurrentUser(null);
      } else {
        setServerError(t("signOutError"));
      }
    } catch {
      setServerError(t("signOutNetworkError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#F4F1E8] px-4 py-8 font-sans text-[#292D2A] sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto w-full max-w-xl border border-[#DEDCCF] bg-[#FAF8F2] lg:max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Mobile Brand Bar */}
          <div className="flex items-center justify-between gap-3 border-b border-[#DEDCCF] bg-[#F4F1E8] px-6 py-4 sm:px-8 lg:hidden">
            {currentUser ? (
              <Link
                href={
                  currentUser.role === "admin"
                    ? "/admin"
                    : currentUser.role === "worker"
                      ? "/worker"
                      : "/dashboard"
                }
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65]"
              >
                <RoadGuardWordmark compact />
              </Link>
            ) : (
              <RoadGuardWordmark compact />
            )}
            <div className="flex items-center gap-2.5">
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-[#63675D]">
                {t("civicPortal")}
              </span>
              <LanguageSelector />
            </div>
          </div>

          {/* Desktop Editorial Civic Context Panel */}
          <aside className="relative hidden overflow-hidden border-r border-[#DEDCCF] bg-[#F4F1E8] p-8 lg:col-span-5 lg:flex lg:flex-col lg:justify-between lg:p-10">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 opacity-75">
              <TopographicContours />
            </div>

            <div className="relative z-10">
              {currentUser ? (
                <Link
                  href={
                    currentUser.role === "admin"
                      ? "/admin"
                      : currentUser.role === "worker"
                        ? "/worker"
                        : "/dashboard"
                  }
                  className="inline-block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65]"
                >
                  <RoadGuardWordmark />
                </Link>
              ) : (
                <div className="inline-block">
                  <RoadGuardWordmark />
                </div>
              )}

              <div className="mt-10">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
                  {t("civicPortal")} · {t("indiaName")}
                </p>
                <p className="mt-3 text-2xl font-light tracking-tight text-[#292D2A]">
                  {isRegister
                    ? t("authTaglineRegister")
                    : t("authTaglineLogin")}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#63675D]">
                  {isRegister
                    ? t("authDescRegister")
                    : t("authDescLogin")}
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-10 space-y-4">
              <RoadLineDivider
                label={isRegister ? t("citizenOnboarding") : t("verifiedAccess")}
              />
              <ul className="space-y-2.5 text-xs text-[#292D2A]">
                <li className="flex items-center justify-between border-b border-[#DEDCCF] pb-2">
                  <span>{t("authStep1Title")}</span>
                  <span className="font-mono text-[11px] text-[#63675D]">
                    {t("authStep1Value")}
                  </span>
                </li>
                <li className="flex items-center justify-between border-b border-[#DEDCCF] pb-2">
                  <span>{t("authStep2Title")}</span>
                  <span className="font-mono text-[11px] text-[#63675D]">
                    {t("authStep2Value")}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>{t("authStep3Title")}</span>
                  <span className="font-mono text-[11px] text-[#63675D]">
                    {t("authStep3Value")}
                  </span>
                </li>
              </ul>
              <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#63675D]">
                RoadGuard · {t("brandSubtitle")}
              </p>
            </div>
          </aside>

          {/* Main Form / Session Workspace */}
          <main className="min-w-0 bg-[#FAF8F2] p-6 sm:p-8 lg:col-span-7 lg:p-10">
            <div className="border-b border-[#DEDCCF] pb-6">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
                  {isRegister ? t("authHeaderRegister") : t("authHeaderLogin")}
                </span>
                <div className="flex items-center gap-3">
                  {currentUser && (
                    <Link
                      href={
                        currentUser.role === "admin"
                          ? "/admin"
                          : currentUser.role === "worker"
                            ? "/worker"
                            : "/dashboard"
                      }
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#63675D] transition-colors hover:text-[#233B32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65]"
                    >
                      {currentUser.role === "admin"
                        ? t("adminConsole")
                        : currentUser.role === "worker"
                          ? t("workerPortal")
                          : t("navDashboard")}
                    </Link>
                  )}
                  <div className="hidden lg:block">
                    <LanguageSelector />
                  </div>
                </div>
              </div>

              <h1 className="mt-3 text-2xl font-light tracking-tight text-[#292D2A] sm:text-3xl">
                {isRegister ? t("createCitizenAccount") : t("signInTitle")}
              </h1>
              <p className="mt-1.5 text-sm text-[#63675D]">
                {isRegister
                  ? t("authDescRegister")
                  : t("authDescLogin")}
              </p>
            </div>

            <div className="mt-6">
              {checkingSession ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="border border-[#DEDCCF] bg-[#F4F1E8] px-6 py-10 text-center"
                >
                  <div
                    aria-hidden="true"
                    className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-[#233B32] border-t-transparent"
                  />
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#63675D]">
                    {t("checkingSession")}
                  </p>
                </div>
              ) : currentUser ? (
                <div className="space-y-5 border border-[#DEDCCF] bg-[#F4F1E8] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3 border-b border-[#DEDCCF] pb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-[#6B8F65]"
                          strokeWidth={1.8}
                        />
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#63675D]">
                          {t("signedIn")}
                        </p>
                      </div>
                      <h2 className="mt-2 truncate text-lg font-semibold tracking-tight text-[#292D2A]">
                        {currentUser.name}
                      </h2>
                      <p className="mt-0.5 truncate font-mono text-xs text-[#63675D]">
                        {currentUser.email}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-xs border border-[#233B32]/30 bg-[#FAF8F2] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-widest text-[#233B32]">
                      {t("rolePrefix")}:{" "}
                      {currentUser.role === "admin"
                        ? t("roleAdmin")
                        : currentUser.role === "worker"
                          ? t("roleWorker")
                          : t("roleCitizen")}
                    </span>
                  </div>

                  {serverError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 border border-[#864832]/50 bg-[#FAF8F2] px-3.5 py-2.5 text-sm text-[#864832]"
                    >
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0"
                        strokeWidth={1.8}
                      />
                      <span>{serverError}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                    <Link
                      href={
                        currentUser.role === "admin"
                          ? "/admin"
                          : currentUser.role === "worker"
                            ? "/worker"
                            : "/dashboard"
                      }
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap bg-[#233B32] px-4 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65]"
                    >
                      <span>
                        {currentUser.role === "admin"
                          ? t("adminConsole")
                          : currentUser.role === "worker"
                            ? t("workerPortal")
                            : t("navDashboard")}
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-4 w-4 text-[#DEDCCF]"
                        strokeWidth={1.7}
                      />
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={submitting}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap border border-[#DEDCCF] bg-[#FAF8F2] px-4 text-sm font-medium text-[#292D2A] transition-colors hover:border-[#A65F45] hover:text-[#864832] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65]"
                    >
                      <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
                      <span>{submitting ? t("signingOut") : t("signOut")}</span>
                    </button>
                    <Link href="/" className={SECONDARY_LINK_CLASSES}>
                      {t("home")}
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {serverError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 border border-[#864832]/50 bg-[#F4F1E8] px-4 py-3 text-sm text-[#864832]"
                    >
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0"
                        strokeWidth={1.8}
                      />
                      <span>{serverError}</span>
                    </div>
                  )}

                  {isRegister && (
                    <div>
                      <label htmlFor="name" className={LABEL_CLASSES}>
                        {t("fullName")}
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        aria-invalid={Boolean(fieldErrors.name)}
                        aria-describedby={
                          fieldErrors.name ? "name-error" : undefined
                        }
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Aarav Sharma"
                        className={getInputClasses(Boolean(fieldErrors.name))}
                      />
                      {fieldErrors.name && (
                        <p id="name-error" className={ERROR_TEXT_CLASSES}>
                          {fieldErrors.name}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className={LABEL_CLASSES}>
                      {t("emailAddress")}
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={
                        fieldErrors.email ? "email-error" : undefined
                      }
                      value={form.email}
                      onChange={handleChange}
                      placeholder="aarav.sharma@example.in"
                      className={getInputClasses(Boolean(fieldErrors.email))}
                    />
                    {fieldErrors.email && (
                      <p id="email-error" className={ERROR_TEXT_CLASSES}>
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  {isRegister && (
                    <div>
                      <label htmlFor="phone" className={LABEL_CLASSES}>
                        {t("phoneNumber")}{" "}
                        <span className="font-mono text-[10px] font-normal normal-case tracking-[0.08em] text-[#63675D]">
                          ({t("indianPhoneHint")} · {t("optional")})
                        </span>
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        aria-invalid={Boolean(fieldErrors.phone)}
                        aria-describedby={
                          fieldErrors.phone ? "phone-error" : undefined
                        }
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="+91 98765 43210"
                        className={getInputClasses(Boolean(fieldErrors.phone))}
                      />
                      {fieldErrors.phone && (
                        <p id="phone-error" className={ERROR_TEXT_CLASSES}>
                          {fieldErrors.phone}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="password" className={LABEL_CLASSES}>
                      {t("password")}
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          isRegister ? "new-password" : "current-password"
                        }
                        required
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={
                          fieldErrors.password ? "password-error" : undefined
                        }
                        value={form.password}
                        onChange={handleChange}
                        placeholder={
                          isRegister
                            ? t("passwordPlaceholderRegister")
                            : t("passwordPlaceholderLogin")
                        }
                        className={getInputClasses(
                          Boolean(fieldErrors.password),
                          "pr-11"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword ? t("hidePassword") : t("showPassword")
                        }
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#63675D] transition-colors hover:text-[#233B32] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#6B8F65]"
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
                        ) : (
                          <Eye aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
                        )}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p
                        id="password-error"
                        className={ERROR_TEXT_CLASSES}
                      >
                        {fieldErrors.password}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 flex h-11 w-full items-center justify-center gap-2 bg-[#233B32] px-5 text-sm font-medium text-[#F4F1E8] transition-colors hover:bg-[#1B2E27] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65]"
                  >
                    <span>
                      {submitting
                        ? isRegister
                          ? t("creatingAccount")
                          : t("signingIn")
                        : isRegister
                          ? t("createAccount")
                          : t("signIn")}
                    </span>
                    {!submitting && (
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 text-[#DEDCCF]"
                        strokeWidth={1.7}
                      />
                    )}
                  </button>

                  <div className="border-t border-[#DEDCCF] pt-5 text-center text-sm text-[#63675D]">
                    {isRegister ? (
                      <>
                        {t("alreadyHaveAccount")}{" "}
                        <Link
                          href="/login"
                          className="font-medium text-[#233B32] underline decoration-[#DEDCCF] underline-offset-4 transition-colors hover:text-[#864832] hover:decoration-[#864832] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65]"
                        >
                          {t("signIn")}
                        </Link>
                      </>
                    ) : (
                      <>
                        {t("needCitizenAccount")}{" "}
                        <Link
                          href="/register"
                          className="font-medium text-[#233B32] underline decoration-[#DEDCCF] underline-offset-4 transition-colors hover:text-[#864832] hover:decoration-[#864832] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B8F65]"
                        >
                          {t("register")}
                        </Link>
                      </>
                    )}
                  </div>
                </form>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
