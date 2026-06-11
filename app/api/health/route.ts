import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { getSyncStatus } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const byStatus = db
    .select({ status: matches.status, n: sql<number>`count(*)` })
    .from(matches)
    .groupBy(matches.status)
    .all();
  const total = byStatus.reduce((s, r) => s + r.n, 0);

  return NextResponse.json({
    sync: getSyncStatus(),
    matches: {
      total,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    },
    now: new Date().toISOString(),
  });
}
