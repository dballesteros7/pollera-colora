# Design decisions

*Started 2026-06-11. Running log of product decisions for the polla app.*

## Decided

1. **Custom "prop" questions** — beyond match scores, group members can propose fun
   side questions ("how many salsa choke celebrations in this match?", "does the
   commentator cry if Colombia scores?"). Sketch:
   - Any member proposes a question; the group organizer approves it and sets its
     point value (or there's a default).
   - A question can be tied to a specific match (locks at that kickoff) or be
     tournament-wide (locks at a date the proposer/organizer sets).
   - Answer types to support: number, yes/no, pick-a-team/player, free choice from
     options the proposer defines.
   - The organizer resolves the correct answer after the fact (these are unofficial
     stats by nature — human judgment, not an API).
2. **Groups with invite links** — anyone can create a group ("polla") and share an
   invite link/code; no public discovery or search. The creator is the organizer
   (configures scoring rules, approves prop questions, resolves them). One user can
   belong to multiple groups; predictions for official matches could be per-group or
   shared — TBD.

3. **Fixtures & results via API** — schedule, kickoff times, and final scores come
   from **football-data.org** (verified 2026-06-11):
   - FIFA World Cup is in the free tier; register at football-data.org for an API key.
   - Rate limit: 10 requests/minute — plenty if we poll the competition's matches
     endpoint every minute or two from a single backend job (never from clients).
   - Score object has `duration` (`REGULAR` / `EXTRA_TIME` / `PENALTY_SHOOTOUT`),
     plus `fullTime`/`halfTime` breakdowns, so we can score predictions on the right
     period for knockout matches.
   - Admin manual-override screen as safety net for wrong/delayed data. Prop
     questions remain organizer-resolved by hand.

4. **Stack: Next.js + SQLite on a single box** — one TypeScript repo, deployed to
   Railway or Fly.io (~$5–10/mo, persistent volume for the DB). SQLite via Drizzle
   ORM; an in-process scheduled job polls football-data.org for fixtures/results;
   simple session-cookie auth. No external services beyond the fixtures API.
   Rationale: dead-simple ops (one deploy, one box, one file as the database),
   modest hosting cost accepted, and the scale (private friend groups) never
   challenges SQLite.

5. **Auth: passwordless** — email one-time code (6 digits) as the base flow; identity
   is the email address. After first sign-in, offer to register a **passkey**
   (WebAuthn via SimpleWebAuthn) so future logins are one tap with no email
   round-trip. Email delivery via Resend (free tier 100 emails/day — plenty, since
   codes are only needed on new devices and sessions are long-lived). No passwords.

6. **Scoring: presets + custom** (researched 2026-06-11). Organizer picks a preset
   at group creation or edits the point values. Presets:
   - **Clásica** (default — the traditional Colombian sheet): 1 pt correct result,
     3 pts exact score, +1 goal-difference bonus (non-draws), bonus picks:
     champion 10, runner-up 8, third 6, top scorer 6, best goalkeeper 6.
   - **Marcador o nada** (bold, big swings): 4 pts correct result, 10 pts exact
     score; knockout rounds multiply points (×1.5 up to ×3 for the final).
   - **Escalonada con comodín** (tiered, mutually exclusive): exact score 10 /
     winner + goal difference 5 / winner only 2 / +1 for one team's goals; one
     joker per round doubles a chosen match.
   - Optional toggle for any preset: **único acertado** — +5 bonus when you're the
     only one in the group with the exact score (very social, fits small groups).
   - Considered and rejected for v1: odds-weighted scoring (Kicktipp style — needs
     an odds feed) and closeness formulas (Superbru style — hard to explain).

7. **Predictions are per group** — a user in multiple pollas predicts separately in
   each; allows different strategies per group and keeps the model simple
   (prediction = user × group × match).

## Open
- (none — next step is scaffolding the repo)
