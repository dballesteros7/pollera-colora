// Grant admin: npx tsx scripts/make-admin.ts someone@example.com
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { users } from "../lib/db/schema";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("usage: tsx scripts/make-admin.ts <email>");
  process.exit(1);
}
const db = getDb();
const updated = db
  .update(users)
  .set({ isAdmin: true })
  .where(eq(users.email, email))
  .returning()
  .get();
if (!updated) {
  console.error(`no user with email ${email} — they must sign in once first`);
  process.exit(1);
}
console.log(`${email} is now an admin`);
