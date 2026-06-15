// One-time seed: create the Claude bot player and add it to every polla.
// Idempotent — safe to re-run. Usage: tsx scripts/seed-claude.ts
import { getDb } from "../lib/db";
import { ensureClaudeBot, addClaudeToAllGroups, CLAUDE_BOT_NAME } from "../lib/claude-bot";

const db = getDb();
const bot = ensureClaudeBot(db);
const groups = addClaudeToAllGroups(db);
console.log(`${CLAUDE_BOT_NAME} ready (${bot.id}); member of ${groups} group(s)`);
