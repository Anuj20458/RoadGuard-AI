import AuthCard from "@/components/auth/AuthCard";

export const metadata = {
  title: "Register | RoadGuard AI",
  description: "Create a RoadGuard AI citizen account.",
};

export default function RegisterPage() {
  return <AuthCard mode="register" />;
}
