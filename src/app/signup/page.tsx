import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SignupForm } from "@/components/signup-form";

export default async function SignupPage() {
  const user = await currentUser();
  if (user) redirect("/");

  return <main className="login">
    <section>
      <div className="logo">24i</div>
      <span className="eyebrow">CLIENT SIGN UP</span>
      <h1>Create your client account.</h1>
      <p>Use your own credentials to review scripts and content sent by 24i Production.</p>
      <SignupForm />
    </section>
  </main>;
}
