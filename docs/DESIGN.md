# Pollera Colora — Design

A private, invite-only "polla" (prediction pool) app for the 2026 World Cup, built
for friend groups in the Colombian tradition. See [research-pollas.md](research-pollas.md)
for the cultural background and [design-decisions.md](design-decisions.md) for the
decision log.

**Timeline pressure: the tournament runs Jun 11 – Jul 19, 2026 and the opening match
is Jun 11** — i.e., it has already started by the time we build. The app must be
usable mid-group-stage: predictions apply to not-yet-played matches only, and
tournament-wide bonus picks get a grace deadline instead of a kickoff-of-match-1 lock.

## Product

### Core loop

1. Someone creates a **polla** (group), picks a scoring preset, shares the invite link.
2. Friends join via the link, sign in with an email code (passkey optional later).
3. Everyone predicts the **exact score** of each upcoming match. Predictions lock at
   kickoff and become visible to the whole group once locked.
4. A backend job pulls real results from football-data.org; points and the
   **leaderboard** update automatically.
5. Members propose **prop questions** ("¿cuántos bailes de salsa choke en este
   partido?"); the organizer approves, everyone answers before the lock, the
   organizer resolves the answer by hand afterward.
6. **Bonus picks** (champion, runner-up, third, top scorer, best goalkeeper) are
   entered once per group, before a per-group grace deadline.

### Roles

- **Member**: predicts, answers props, proposes props, sees leaderboard.
- **Organizer** (group creator): everything a member does, plus configure scoring,
  approve/reject and resolve prop questions, set the bonus-pick deadline, remove
  members, regenerate the invite link.
- **App admin** (us): manual override screen for match results, user support.

### Scoring

Configurable per group; organizer picks a preset at creation and may edit values.

| Preset | Rules |
|---|---|
| **Clásica** (default) | 1 pt correct result · 3 pts exact score · +1 goal-diff bonus (non-draws) · bonus picks: champion 10, runner-up 8, third 6, top scorer 6, best GK 6 |
| **Marcador o nada** | 4 pts result · 10 pts exact · knockout multipliers ×1.5 (R32) → ×3 (final) |
| **Escalonada con comodín** | Mutually exclusive: exact 10 / winner+goal-diff 5 / winner 2 / +1 one team's goals · one joker per round doubles a chosen match |

Optional toggle on any preset: **único acertado** (+5 if you alone hit the exact score).

Conventions (all presets):
- Knockout matches score on **regulation time** (the API's `duration` field tells us
  when a match went to extra time; we use the 90-minute score).
- Predictions lock at kickoff, no exceptions; unpredicted matches score 0.
- Tiebreakers: most exact scores → most correct results → most correct bonus/prop
  answers → earliest cumulative submission time.

### Prop questions

- Proposed by any member: question text, answer type, lock time, suggested points.
- Answer types: **number**, **yes/no**, **multiple choice** (proposer defines options).
- Tied to a match (locks at that kickoff) or tournament-wide (proposer sets lock).
- Organizer approves (and can adjust points) before it's visible to the group;
  organizer enters the correct answer to resolve. Numbers can be exact-match or
  closest-wins (organizer chooses at resolution).

### Money

None in the app. The pot is the group's offline business — at most an informational
free-text field ("$50.000 entrada, 70/20/10") on the group page. This keeps us inside
the legally tolerated friends-polla zone (Ley 643 de 2001 context in the research doc).

## Architecture

One Next.js (App Router, TypeScript) app on a single Fly.io or Railway box with a
persistent volume. ~$5–10/mo.

```
┌────────────────────────── one box ──────────────────────────┐
│  Next.js app (server components + server actions)           │
│  ├─ Drizzle ORM ── SQLite file on persistent volume         │
│  ├─ in-process poller (node-cron via instrumentation.ts)    │
│  │     └→ football-data.org  /v4/competitions/WC/matches    │
│  └─ Resend API (login codes)                                │
└──────────────────────────────────────────────────────────────┘
```

- **Fixtures poller**: every 60s during live matches, every 15min otherwise
  (well under the 10 req/min free-tier limit; one request fetches all matches).
  Upserts matches; never overwrites a row flagged `manual_override`.
- **Scoring**: computed by a pure function `scoreMatch(prediction, result, rules)`;
  leaderboard recomputed on result change and cached in a table (cheap at our scale,
  but precomputing keeps pages instant).
- **Auth**: 6-digit email OTP (Resend) creating a long-lived session cookie;
  passkeys (SimpleWebAuthn) as an optional fast path added post-MVP.
- **Locking**: enforced server-side by comparing server time to `kickoff_utc` —
  never trust the client clock. All times stored UTC, rendered in the viewer's TZ.

### Data model

```
users        id, email (unique), display_name, is_admin, created_at
sessions     id, user_id, expires_at
otp_codes    email, code_hash, expires_at, attempts
passkeys     id, user_id, credential_id, public_key, counter        [post-MVP]

groups       id, name, invite_code (rotatable), organizer_id,
             scoring_rules (JSON: preset + overrides + toggles),
             bonus_lock_at, pot_note, created_at
memberships  user_id, group_id, role (organizer|member), joined_at

matches      id, fd_id (football-data id), stage, matchday, kickoff_utc,
             home_team, away_team (TBD allowed for knockouts),
             status, duration, reg_home, reg_away, final_home, final_away,
             manual_override (bool)

predictions  user_id, group_id, match_id, pred_home, pred_away,
             joker (bool), updated_at          [unique: user×group×match]
bonus_picks  user_id, group_id, category (champion|runner_up|third|
             top_scorer|best_gk), value, updated_at
prop_questions  id, group_id, proposer_id, status (proposed|approved|
                rejected|resolved), text, answer_type (number|boolean|choice),
                options (JSON), points, match_id?, lock_at,
                resolution_mode (exact|closest), correct_value
prop_answers    question_id, user_id, value     [unique: question×user]

scores       user_id, group_id, points_matches, points_bonus, points_props,
             exact_count, result_count   (cache, rebuilt on result changes)
```

### Pages

- `/` — your groups, or marketing-free landing with "create a polla" if signed out
- `/login` — email → code → session (+ passkey button post-MVP)
- `/g/[id]` — group home: leaderboard + next matches to predict (the main screen)
- `/g/[id]/fixtures` — all matches, your predictions, others' (locked ones only)
- `/g/[id]/props` — prop questions: answer, propose; organizer: approve/resolve
- `/g/[id]/bonus` — bonus picks (until group's grace deadline)
- `/g/[id]/settings` — organizer: scoring, invite link, members, pot note
- `/join/[code]` — invite landing → login → membership
- `/admin` — match list with manual result override (app admin only)

### Non-goals (v1)

Native apps (responsive web only) · push notifications · payments · public groups ·
odds-weighted scoring · localization beyond es/en hardcoded strings (Spanish-first UI).
