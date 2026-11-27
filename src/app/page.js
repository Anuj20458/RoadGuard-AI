import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/formatters";

async function HomeRedirectGate() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }
  redirect(getRoleHomePath(user.role));
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4F1E8] font-mono text-xs uppercase tracking-[0.2em] text-[#777B70]">
          Routing...
        </div>
      }
    >
      <HomeRedirectGate />
    </Suspense>
  );
}
