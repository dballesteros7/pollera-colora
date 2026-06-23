import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { DB_PATH, STATE_PATH } from "./paths";
import { seedVisualDb } from "./seed";

// Seed a fresh deterministic DB before the suite. The webServer points at the
// same DATABASE_PATH; its scheduler is neutered (empty FOOTBALL_DATA_TOKEN), so
// nothing overwrites this data while the screenshots are taken.
export default function globalSetup() {
  mkdirSync(".pw", { recursive: true });
  for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    rmSync(f, { force: true });
  }
  const { groupId } = seedVisualDb(DB_PATH);
  writeFileSync(STATE_PATH, JSON.stringify({ groupId }), "utf8");
}
