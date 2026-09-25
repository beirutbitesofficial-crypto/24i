import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SignupForm } from "@/components/signup-form";
import { AuthLayout } from "@/components/auth-layout";

export default async function SignupPage() {
  const user = await currentUser();
  if (user) redirect("/");

  return <AuthLayout title="Create your client account" subtitle="Use your own credentials to review scripts and content sent by 24i Production.">
    <SignupForm />
  </AuthLayout>;
}
