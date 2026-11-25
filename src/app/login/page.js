import AuthCard from "@/components/auth/AuthCard";

export const metadata = {
  title: "Sign In | RoadGuard AI",
  description: "Sign in to your RoadGuard AI account.",
};

export default function LoginPage() {
  return <AuthCard mode="login" />;
}
