// Manual one-shot sync: npm run sync
import { getDb } from "../lib/db";
import { syncMatches } from "../lib/sync";

const db = getDb();
syncMatches(db)
  .then((r) => {
    console.log(
      `synced ${r.total} matches (${r.upserted} upserted, ${r.skippedOverridden} overridden, ${r.resultsChanged.length} results changed)`,
    );
  })
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
