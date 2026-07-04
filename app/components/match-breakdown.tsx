import { Bot } from "lucide-react";
import type { PresetDef } from "@/lib/scoring/presets";
import {
  scoreBreakdown,
  UNICO_BONUS,
  type MatchResult,
  type ScorePartKey,
} from "@/lib/scoring/score";
import { t, type Locale } from "@/lib/i18n";

// each additive part maps to a label already in the scoring sheet (s.*)
const PART_KEY: Record<ScorePartKey, string> = {
  exact: "s.exact",
  winnerDiff: "s.winnerDiff",
  tierWinner: "s.winner",
  result: "s.result",
  goalDiff: "s.goalDiff",
  teamGoals: "s.teamGoals",
};

export interface BreakdownPick {
  userId: string;
  displayName: string | null;
  isBot: boolean;
  predHome: number;
  predAway: number;
  joker: boolean;
  isMe: boolean;
  masked?: boolean; // the viewer sees an alias — style it as the leaderboard gag
}

// Per-match scoring transparency: a server-rendered <details> (no JS) that
// shows every player's pick, the points it earned, and exactly which rules
// produced them — único included, since we have the whole group's picks here.
export function MatchBreakdown({
  locale,
  preset,
  result,
  unico,
  picks,
}: {
  locale: Locale;
  preset: PresetDef;
  result: MatchResult;
  unico: boolean;
  picks: BreakdownPick[];
}) {
  const lo = locale;
  const scored = picks.map((p) => ({
    pick: p,
    b: scoreBreakdown(
      { predHome: p.predHome, predAway: p.predAway, joker: p.joker },
      result,
      preset,
    ),
  }));
  const exactCount = scored.filter((s) => s.b.exact).length;
  const rows = scored
    .map((s) => {
      const unicoHit = unico && s.b.exact && exactCount === 1;
      return { ...s, unicoHit, total: s.b.points + (unicoHit ? UNICO_BONUS : 0) };
    })
    // highest first; on a tie, surface the viewer's own row
    .sort((a, b) => b.total - a.total || (a.pick.isMe ? -1 : b.pick.isMe ? 1 : 0));

  return (
    <details className="pc-calc">
      <summary>{t(lo, "f.howScored")}</summary>
      <div className="pc-calc__list">
        {rows.map(({ pick, b, unicoHit, total }) => (
          <div
            key={pick.userId}
            className={`pc-calc__row${pick.isMe ? " pc-calc__row--me" : ""}`}
          >
            <div className="pc-calc__head">
              <span className="pc-calc__who">
                <span className="pc-avatar pc-avatar--sm" aria-hidden>
                  {(pick.displayName ?? "?").slice(0, 2)}
                </span>
                <span
                  style={pick.masked ? { fontStyle: "italic", color: "var(--ink-soft)" } : undefined}
                >
                  {pick.displayName ?? "(sin nombre)"}
                </span>
                {pick.isBot && (
                  <Bot size={14} className="pc-bot-badge" aria-label={t(lo, "a11y.bot")} />
                )}
                {pick.isMe && (
                  <span className="pc-calc__you">{t(lo, "f.youTag")}</span>
                )}
              </span>
              <span className="pc-pick">
                {pick.predHome}–{pick.predAway}
              </span>
              <span
                className={`pc-badge ${total > 0 ? "pc-badge--points" : "pc-badge--locked"}`}
              >
                {t(lo, "f.plusPts", { n: total })}
              </span>
            </div>
            <div className="pc-calc__parts">
              {b.parts.length === 0 && !unicoHit && (
                <span className="pc-calc__chip pc-calc__chip--zero">
                  {t(lo, "f.calcMiss")}
                </span>
              )}
              {b.parts
                // a preset can value a part at 0 (e.g. goal diff in marcador o
                // nada) — an advertised "+0" reads as a rule that doesn't exist
                .filter((part) => part.points !== 0)
                .map((part, i) => (
                  <span className="pc-calc__chip" key={i}>
                    {t(lo, PART_KEY[part.key])} <b>+{part.points}</b>
                  </span>
                ))}
              {b.multiplier !== 1 && (
                <span className="pc-calc__chip">
                  {t(lo, "f.stageX", { m: b.multiplier })}
                </span>
              )}
              {b.joker && (
                <span className="pc-badge pc-badge--comodin">
                  {t(lo, "comodin")}
                </span>
              )}
              {unicoHit && (
                <span className="pc-badge pc-badge--points">
                  {t(lo, "preset.unicoTag")} +{UNICO_BONUS}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
