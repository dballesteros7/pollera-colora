import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gt, sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  users,
  groups,
  memberships,
  predictions,
  propQuestions,
  propAnswers,
  sessions,
} from "./db/schema";

export interface Metrics {
  ts: string;
  users: number;
  dau: number; // seen in last 24h
  wau: number; // seen in last 7d
  sessions: number;
  groups: number;
  memberships: number;
  predictions: number;
  questions: number;
  answers: number;
}

import type { SQLiteTable } from "drizzle-orm/sqlite-core";

function count(db: Db, table: SQLiteTable): number {
  return db.select({ n: sql<number>`count(*)` }).from(table).get()!.n;
}

export function collectMetrics(db: Db, now = new Date()): Metrics {
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const seenSince = (since: Date) =>
    db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .where(gt(users.lastSeenAt, since))
      .get()!.n;

  return {
    ts: now.toISOString(),
    users: count(db, users),
    dau: seenSince(dayAgo),
    wau: seenSince(weekAgo),
    sessions: count(db, sessions),
    groups: count(db, groups),
    memberships: count(db, memberships),
    predictions: count(db, predictions),
    questions: count(db, propQuestions),
    answers: count(db, propAnswers),
  };
}

// snapshots live next to the database (the volume in prod)
export function metricsPath(): string {
  const dbPath = process.env.DATABASE_PATH ?? "data/polla.db";
  return path.join(path.dirname(dbPath), "metrics.jsonl");
}

export function appendSnapshot(db: Db, now = new Date()): Metrics {
  const m = collectMetrics(db, now);
  appendFileSync(metricsPath(), JSON.stringify(m) + "\n");
  return m;
}

export function readSnapshots(limit = 168): Metrics[] {
  const p = metricsPath();
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").trim().split("\n");
  return lines
    .slice(-limit)
    .map((l) => {
      try {
        return JSON.parse(l) as Metrics;
      } catch {
        return null;
      }
    })
    .filter((m): m is Metrics => m !== null);
}
