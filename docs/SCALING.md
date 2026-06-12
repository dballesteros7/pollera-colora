# Scaling plan

*Written 2026-06-13, when the parche started sharing links.*

## Where the ceiling actually is

Current: one shared-cpu-1x / 512MB Fly machine running Next.js SSR + static
assets + SQLite (WAL) on a local volume + the in-process poller.

Traffic shape is friendly: reads dominate massively (leaderboard checks), writes
are tiny and bursty (predictions in the minutes before kickoff), and the hottest
pages are identical for every member of a group. better-sqlite3 reads are
microseconds; the box realistically serves **a few hundred SSR requests/second**,
which at this app's check-in pattern is several thousand daily users.

The real architectural constraint isn't CPU — it's that **SQLite on a local
volume pins everything to exactly one machine** (the poller also assumes it's
the only writer). Vertical scaling and caching are easy; horizontal scaling
means replacing the database.

## Phase A — stretch the single box (now; ~$10/mo total)

Gets us comfortably into thousands of users with zero architecture risk:

1. **Bump the machine**: shared-cpu-2x / 1GB (`fly scale vm shared-cpu-2x
   --vm-memory 1024`). Doubles CPU for SSR bursts; ~$8/mo.
2. **Per-group render caching**: leaderboard + fixtures data memoized in-process
   for ~15s. During a result burst, 200 members of a group cost one set of
   queries instead of 200. Safe because there is exactly one writer (same
   process) — invalidate on score rebuild.
3. **Cache headers / CDN (optional)**: `/_next/static` is already
   immutable-cached; team crests come from football-data's CDN. If we want a
   shield, putting Cloudflare (free) in front adds static caching + DDoS
   protection — requires moving DNS from Squarespace to Cloudflare.

## Phase B — go horizontal (only on real signals; ~2-3 days work)

Trigger: sustained >5k daily users, kickoff-burst latency, or memory pressure
that a bigger single box can't absorb.

1. **SQLite → Postgres** (Neon or Supabase free/cheap tiers, or Fly Postgres).
   Drizzle makes the schema port mechanical, but the codebase uses synchronous
   better-sqlite3 calls (`.all()/.get()/.run()`) throughout — every lib function
   and page goes async. This is the bulk of the work.
2. **Split processes**: `web` (N stateless machines, `auto_stop` allowed) +
   `worker` (1 machine: poller + score rebuilds). Fly process groups make this
   a fly.toml change once the DB is external.
3. **Score cache stays a table** — it already absorbs the expensive
   recomputation; Postgres serves it to all web machines.

## Not doing

- LiteFS / distributed SQLite: real operational complexity for a worse version
  of Phase B.
- Kubernetes, queues, microservices: this is a World Cup app with a hard
  end date of July 19.

## Decision

Phase A now. Phase B only if growth data demands it — the migration is
well-understood and can be executed in a weekend without downtime (dual-write
or a short maintenance window at 4am Colombia time between matchdays).
