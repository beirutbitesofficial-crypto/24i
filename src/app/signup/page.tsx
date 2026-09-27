import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Public sign-up is closed: accounts are created by an Admin or Manager from Users.
export default function Signup() {
  redirect("/");
}
