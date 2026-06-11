# Design brief — Pollera Colora

## What it is

A private, invite-only **polla mundialista**: the traditional Colombian World Cup
prediction pool, as a web app. Friend groups predict exact scores for all 104
matches of the 2026 World Cup, answer custom "prop" questions proposed by the group
("¿cuántos bailes de salsa choke en este partido?"), pick champion/top scorer, and
fight over a leaderboard. No money flows through the app — the pot is the group's
offline business. The app is **live and in use during the tournament right now**
(Jun 11 – Jul 19, 2026), functional but completely unstyled, awaiting this design
system.

## Who uses it, and how

- Colombian friends-and-family groups: the office polla, the family WhatsApp group,
  the parche del barrio. Ages ~20–70, wildly mixed tech comfort.
- **Mobile-first, overwhelmingly.** Links arrive via WhatsApp; predictions happen on
  a phone minutes before kickoff or during the previous match.
- Two usage rhythms: a 30-second daily check ("did I move up the table?") and a
  weekly 5-minute session (fill in the matchday's predictions).
- UI language is Colombian Spanish, informal — "tu pronóstico", "el parche",
  "quien organiza". Already written; keep the voice.

## Brand direction

The name riffs on *La Pollera Colorá*, the iconic cumbia. We want **festive
Colombian fútbol**, not corporate sportsbook: think tricolor (yellow/blue/red)
used with confidence but restraint, warmth over slickness. It should feel like an
asado with the game on — celebratory, a little loud, never childish. Avoid:
gambling-site green-felt aesthetics, generic SaaS minimalism, FIFA's own visual
language.

## Screens (by importance)

1. **Group home `/g/[id]`** — THE screen. Leaderboard table (rank, name, points,
   exact-score count), links to predict/bonus/props, scoring preset + prize note.
   The leaderboard is the social heart: it gets screenshotted into WhatsApp —
   design for that.
2. **Fixtures `/g/[id]/fixtures`** — matches grouped by day. Each match card cycles
   through states: *open* (two score inputs + save, optional "comodín ×2" toggle) →
   *locked/live* (your pick, delayed live score, everyone's picks revealed) →
   *finished* (regulation-time result, points earned). Big fat-finger-friendly
   number inputs; people enter 104 of these.
3. **Login `/login`** — email → 6-digit code. Two steps, zero friction; many users
   land here from an invite link as their first impression.
4. **Join `/join/[code]`** — invite landing: group name, member count, one button.
   First-impression page for every new member.
5. **Props `/g/[id]/props`** — list of open questions (number / sí-no / multiple
   choice answers), closed ones with everyone's answers, resolved ones with points;
   propose-a-question form; organizer-only approve/resolve controls.
6. **Bonus picks `/g/[id]/bonus`** — five picks (campeón, subcampeón, tercero,
   goleador, arquero) with a deadline; reveals the whole group's picks after lock.
7. Lower priority: home (group list), create-group form (preset picker with 3
   scoring schemes), settings, admin (internal tool, just needs to be usable).

## States that matter more than pixels

- **Open vs locked** must be unmistakable at a glance (lock at kickoff is the
  core rule of the game).
- **Live** (delayed ~minutes — don't over-promise "live", a subtle "en juego" is
  honest) vs **finished** (show regulation-time score; extra-time note when final
  differs).
- Knockout matches with teams **"por definir"** (disabled until teams known).
- Empty states: brand-new group (no predictions yet), no open prop questions.
- "← tú" row highlight in the leaderboard; position movement would be delightful.

## Technical constraints

- Next.js App Router, **server-rendered semantic HTML with form posts** — no client
  state libraries, minimal JS. The design system should be CSS-first: design tokens
  as CSS custom properties (or a Tailwind config), components expressible as plain
  markup + classes. Current markup is clean semantic HTML (main/section/article/
  table/form) ready to receive classes.
- One Geist font is loaded today; happy to swap for the system's choice (Google
  Fonts or self-hostable).
- Accessibility: real labels and roles exist; keep contrast AA, touch targets
  ≥44px. Some users are abuelos.
- Light mode required; dark mode welcome if cheap.

## Deliverables wanted

1. **Design tokens**: palette (incl. semantic colors for open/locked/live/finished/
   points-won), type scale, spacing, radii, shadows.
2. **Core components**: match card (all states), score input pair, leaderboard
   table/row, button set, form fields, badges/chips (comodín, "en juego",
   "organiza"), page header/nav, empty states.
3. **Mobile layouts** for screens 1–4 above (desktop = comfortable centered column;
   no complex responsive work needed).
4. Anything WhatsApp-screenshot-worthy you can give the leaderboard.
