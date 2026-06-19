import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __polleraDb: Db | undefined;
}

export function createDb(dbPath: string): Db {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  // standard pairing with WAL: fsync on checkpoint, not on every commit
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  // wait (don't immediately SQLITE_BUSY) when another connection holds the
  // write lock — the poller and request handlers share this file
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

// single shared connection; survives Next.js dev hot-reload via globalThis
export function getDb(): Db {
  if (!globalThis.__polleraDb) {
    const dbPath = process.env.DATABASE_PATH ?? "data/polla.db";
    globalThis.__polleraDb = createDb(dbPath);
  }
  return globalThis.__polleraDb;
}

export { schema };
