# Implementation plan

Ordered for the reality that the World Cup started Jun 11. Each phase ends in a
deployable state; we deploy from Phase 1 onward and keep shipping into the live
tournament. Group stage runs through ~Jun 27 — Phases 1–5 should land well inside it
so pollas can run for the knockouts even in the worst case.

**Definition of done per phase: deployed to the box, exercised against real data.**

## Phase 0 — Scaffold + fixtures spine (the data heart)

The poller is the riskiest external dependency, so it goes first.

- [x] `npx create-next-app` (App Router, TS), Drizzle + better-sqlite3, schema from
      DESIGN.md, migrations
- [ ] Register football-data.org key (needs Diego's email) → `.env`
- [x] Sync job: fetch `/v4/competitions/WC/matches`, upsert all 104 matches;
      node-cron in `instrumentation.ts` (60s when any match is live, else 15min)
- [x] Respect `manual_override`; store regulation-time score using `duration`
- [ ] Verify against tonight's real opening match: kickoff status flip + final score
- Acceptance: `matches` table mirrors reality without human help

## Phase 1 — Auth + deploy

- [x] Email OTP: request code → Resend (needs account + domain or onboarding sender)
      → verify → session cookie (90 days); rate-limit code requests per email/IP
- [x] Minimal `/login`, signed-in shell, display-name prompt on first login
- [ ] Fly.io (or Railway) deploy: Dockerfile, persistent volume for SQLite, secrets,
      domain; SQLite backup cron (litestream or volume snapshots)
- Acceptance: stranger can sign in on their phone in <1 min

## Phase 2 — Groups & invites

- [x] Create group (name, preset picker with the 3 presets + único toggle, pot note)
- [x] `/join/[code]` flow incl. login redirect; invite-code regeneration
- [x] Group home skeleton, member list, organizer settings page
- Acceptance: two real users in one group via link

## Phase 3 — Predictions

- [x] Fixtures page: upcoming matches grouped by day, score inputs, autosave
- [x] Server-side lock at kickoff; locked matches reveal everyone's predictions
- [x] Joker UI when preset is Escalonada
- Acceptance: predict on phone, see it lock at a real kickoff

## Phase 4 — Scoring + leaderboard  ← MVP line

- [x] `scoreMatch(prediction, result, rules)` pure function, all 3 presets +
      único acertado + knockout multipliers; unit tests against hand-computed cases
- [x] Score-cache rebuild triggered by poller result changes
- [x] Leaderboard on group home: totals, exact/result counts, tiebreaker order,
      per-member drill-down (which matches earned what)
- Acceptance: leaderboard provably correct for a finished matchday
- **→ Announce to friends, real pollas start here**

## Phase 5 — Bonus picks

- [x] Bonus picks page (champion, runner-up, third, top scorer, best GK) with
      per-group grace deadline (default: end of group stage, organizer-set)
- [x] Resolution: app admin enters tournament outcomes once at the end; scoring
      integrates into cache
- Acceptance: picks lock at deadline; mock resolution scores correctly

## Phase 6 — Prop questions (the salsa-choke feature)

- [x] Propose form (text, type, options, lock, suggested points)
- [x] Organizer queue: approve/adjust/reject; group answer UI with lock
- [x] Resolution UI (exact or closest-wins for numbers) → scoring integration
- Acceptance: full propose→approve→answer→resolve→points cycle in a real group

## Phase 7 — Polish & passkeys (during knockouts)

- [ ] Passkey registration + login (SimpleWebAuthn)
- [x] Admin manual-override screen (until here: SQL by hand is the fallback)
- [ ] Mobile polish pass, empty states, Spanish copy review
- [ ] Nice-to-haves as time allows: email digest of today's matches, prediction
      reminders, group activity feed

## Standing risks

- **TBD knockout teams**: matches sync with placeholder teams; predictions open only
  once both teams are known (status from API).
- **API hiccups mid-match**: poller failures alert via log + admin screen; manual
  override is the escape hatch.
- **Joined late**: members score 0 on already-played matches — by design, show
  joined-date on leaderboard so it's transparent.
