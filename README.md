# Pollera Colora

Private "polla" (prediction pool) app for the 2026 World Cup, in the Colombian
tradition: friend groups predict exact scores, answer prop questions
("¿cuántos bailes de salsa choke?"), and fight over the leaderboard.

Docs: [design](docs/DESIGN.md) · [implementation plan](docs/IMPLEMENTATION_PLAN.md) ·
[decision log](docs/design-decisions.md) · [polla research](docs/research-pollas.md)

## Stack

Next.js (App Router) + SQLite (Drizzle) on one box. In-process cron polls
football-data.org for fixtures/results. Email-code login via Resend (codes log
to console in dev). No payments — the pot is the group's offline business.

## Dev

```bash
cp .env.example .env.local   # add FOOTBALL_DATA_TOKEN when you have it
npm install
npx tsx scripts/seed-demo.ts # fake matches if you have no API token yet
npm run dev
```

Sign in at `/login` — the 6-digit code prints to the server console when
`RESEND_API_KEY` is unset.

Useful scripts:

- `npm run sync` — one-shot fixtures sync (needs `FOOTBALL_DATA_TOKEN`)
- `npm test` — vitest suite
- `npx tsx scripts/make-admin.ts <email>` — grant the admin screen (`/admin`)

## Deploy

`fly launch` once (creates the `polla_data` volume per `fly.toml`), then
`fly deploy`. Set secrets: `FOOTBALL_DATA_TOKEN`, `RESEND_API_KEY`,
`EMAIL_FROM`. The machine must not scale to zero — the poller lives in-process.
