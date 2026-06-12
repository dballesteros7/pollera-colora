import { Info } from "lucide-react";
import type { PresetDef, ScoringRules } from "@/lib/scoring/presets";
import { UNICO_BONUS } from "@/lib/scoring/score";
import { t, type Locale } from "@/lib/i18n";

const BONUS_KEYS: Record<string, string> = {
  champion: "b.champion",
  runner_up: "b.runnerUp",
  third: "b.third",
  top_scorer: "b.topScorer",
  best_gk: "b.bestGk",
};

// expandable "¿Cómo se puntúa?" sheet — server-rendered <details>, no JS
export function ScoringSheet({
  preset,
  rules,
  locale,
}: {
  preset: PresetDef;
  rules: ScoringRules;
  locale: Locale;
}) {
  const lo = locale;
  const multipliers = Object.entries(preset.stageMultipliers);
  return (
    <details className="pc-card pc-sheet">
      <summary>
        <Info size={16} aria-hidden /> {t(lo, "s.how", { preset: t(lo, `preset.${preset.id}`) })}
      </summary>
      <p className="pc-hint" style={{ margin: "var(--space-2) 0" }}>
        {t(lo, `preset.${preset.id}.d`)}
      </p>
      <table>
        <tbody>
          {preset.exclusiveTiers ? (
            <>
              <tr>
                <td>{t(lo, "s.exact")}</td>
                <td>{t(lo, "s.pts", { n: preset.exactPoints })}</td>
              </tr>
              <tr>
                <td>{t(lo, "s.winnerDiff")}</td>
                <td>{t(lo, "s.pts", { n: preset.tierWinnerGoalDiff })}</td>
              </tr>
              <tr>
                <td>{t(lo, "s.winner")}</td>
                <td>{t(lo, "s.pts", { n: preset.resultPoints })}</td>
              </tr>
              <tr>
                <td>{t(lo, "s.teamGoals")}</td>
                <td>+{t(lo, "s.pt1", { n: preset.teamGoalsBonus })}</td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <td>{t(lo, "s.exact")}</td>
                <td>{t(lo, "s.pts", { n: preset.exactPoints })}</td>
              </tr>
              <tr>
                <td>{t(lo, "s.result")}</td>
                <td>{t(lo, "s.pt1", { n: preset.resultPoints })}</td>
              </tr>
              {preset.goalDiffBonus > 0 && (
                <tr>
                  <td>{t(lo, "s.goalDiff")}</td>
                  <td>+{t(lo, "s.pt1", { n: preset.goalDiffBonus })}</td>
                </tr>
              )}
            </>
          )}
          {preset.joker && (
            <tr>
              <td>{t(lo, "s.joker")}</td>
              <td>×2</td>
            </tr>
          )}
          {multipliers.length > 0 && (
            <tr>
              <td>{t(lo, "s.multipliers")}</td>
              <td>
                ×{Math.min(...multipliers.map(([, v]) => v))}–×
                {Math.max(...multipliers.map(([, v]) => v))}
              </td>
            </tr>
          )}
          {rules.unicoAcertado && (
            <tr>
              <td>{t(lo, "s.unico")}</td>
              <td>+{t(lo, "s.pts", { n: UNICO_BONUS })}</td>
            </tr>
          )}
          {Object.entries(preset.bonusPoints).map(([k, v]) => (
            <tr key={k}>
              <td>{t(lo, "s.bonusRow", { cat: t(lo, BONUS_KEYS[k]) })}</td>
              <td>{t(lo, "s.pts", { n: v })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pc-hint" style={{ margin: "var(--space-2) 0 0" }}>
        {t(lo, "s.note")}
      </p>
    </details>
  );
}
