import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

export async function requireUser(nextPath: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  // invite-link signups never pass the home page — collect the name here
  if (!user.displayName) redirect(`/welcome?next=${encodeURIComponent(nextPath)}`);
  return user;
}
