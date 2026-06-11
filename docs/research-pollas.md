# Research: La "polla" colombiana (quinielas mundialistas)

*Compiled 2026-06-11, ahead of the 2026 World Cup (Jun 11 – Jul 19, 104 matches).*

## What a polla is

A **polla** is the Colombian/Venezuelan name for an informal sports prediction pool —
what Spain calls a *porra* and Uruguay a *penca*. It is deeply rooted in Colombian
culture: coworkers, classmates, friends, and families organize one around every World
Cup, Copa América, and big tournament.

The traditional mechanics:

1. A closed group (office, family, friend circle) agrees to play.
2. Everyone pays the same entry fee into a common pot.
3. Each participant fills in predictions — classically a printed sheet (newspapers like
   La República published fill-in polla sheets) with the score of every match, plus
   bonus picks like champion and top scorer.
4. Points accumulate per match according to agreed rules; highest total at the end of
   the tournament takes the pot (often split, e.g. 70/20/10 for 1st/2nd/3rd).
5. If nobody nails it, closest prediction wins — there's always a winner.

A designated organizer ("el que hace la polla") collects money, tracks scores
(historically on paper or a spreadsheet), and publishes the standings — the social
ritual of arguing over the table is half the fun.

## Typical scoring systems

Rules vary per polla — being able to configure them is part of the tradition. Two
representative real-world schemes:

**Classic / simple** (lapollafutbolera.com):

| Prediction | Points |
|---|---|
| Correct result (winner or draw) | 1 |
| Exact score | 3 |
| Goal-difference bonus (right result, wrong score, non-draw) | +1 |
| Champion | 10 |
| Runner-up | 8 |
| Third place | 6 |
| Top scorer | 6 |
| Best goalkeeper | 6 |

**Tiered exclusive** (pollamundialista.com): mutually exclusive buckets — exact score
10 pts, winner + goal difference 5 pts, winner only 2 pts, +1 bonus for guessing one
team's goals right. Adds a per-round **joker** that doubles one match's points.

Common conventions:

- Predictions lock shortly before kickoff (1–15 min before, varies by polla).
- Knockout matches: only regulation time (sometimes + extra time) counts; penalty
  shootouts never count toward the score prediction.
- Bonus picks (champion, top scorer…) lock before the tournament or before a fixed
  early deadline.
- Tiebreakers, in order: most exact scores → most correct results → most correct
  bonus picks → (varies: earliest submission, or random draw).

## Legal context in Colombia (worth knowing, low risk for us)

Games of chance are a state monopoly under **Ley 643 de 2001**. Pollas among friends
are tolerated as long as they stay private and non-commercial. Per legal guidance
(El Universal, Jun 2026): the organizer must not profit or charge commission, no
public promotion / open recruitment, closed private group, occasional not permanent.
A friends-only app that just tracks predictions and points (with money handled
informally offline, if at all) is squarely in the tolerated zone. Avoid: handling
payments in-app, commissions, or marketing it publicly as a betting product.

## Implications for the app

- **Core loop**: fixture of all 104 matches → participants enter exact-score
  predictions before kickoff → auto-lock at kickoff → organizer/API enters results →
  points + leaderboard update.
- **Configurable rules**: point values (and which scheme) should be per-polla
  settings, since every group has its own house rules.
- **Bonus picks**: champion / podium / top scorer, locked before the tournament starts.
- **Tiebreakers**: implement exact-scores-count as the default first tiebreaker.
- **Private groups**: invite-link / code based, no public discovery — matches both the
  tradition and the legal comfort zone.
- **No money in the app**: show the pot/prize split as informational text at most.
- **The social layer matters**: a visible leaderboard and everyone's predictions
  (revealed after lock) is the heart of the experience.

## Sources

- [Polla (apuesta) — Wikipedia](https://es.wikipedia.org/wiki/Polla_(apuesta))
- [Reglas y puntajes — pollamundialista.com](https://pollamundialista.com/reglas-y-puntajes/)
- [Reglas — lapollafutbolera.com](https://lapollafutbolera.com/reglas/)
- [Reglas legales para pollas — El Universal](https://www.eluniversal.com.co/colombia/2026/06/03/va-a-hacer-una-polla-para-el-mundial-siga-estas-reglas-para-evitar-problemas-legales/)
- [Polla Mundialista 2026 guía — futbol22.com](https://futbol22.com/world-cup-2026/polla-mundialista-2026-la-guia-definitiva-para-organizar-pronosticos-del-mundial-en-tu-pais-y-ciudad-629.html)
