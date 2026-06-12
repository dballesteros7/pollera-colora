import { Info } from "lucide-react";
import type { PresetDef, ScoringRules } from "@/lib/scoring/presets";
import { UNICO_BONUS } from "@/lib/scoring/score";

const BONUS_LABELS: Record<string, string> = {
  champion: "Campeón",
  runner_up: "Subcampeón",
  third: "Tercer puesto",
  top_scorer: "Goleador",
  best_gk: "Mejor arquero",
};

// expandable "¿Cómo se puntúa?" sheet — server-rendered <details>, no JS
export function ScoringSheet({
  preset,
  rules,
}: {
  preset: PresetDef;
  rules: ScoringRules;
}) {
  const multipliers = Object.entries(preset.stageMultipliers);
  return (
    <details className="pc-card pc-sheet">
      <summary>
        <Info size={16} aria-hidden /> ¿Cómo se puntúa? — {preset.name}
      </summary>
      <p className="pc-hint" style={{ margin: "var(--space-2) 0" }}>
        {preset.description}
      </p>
      <table>
        <tbody>
          {preset.exclusiveTiers ? (
            <>
              <tr>
                <td>Marcador exacto</td>
                <td>{preset.exactPoints} pts</td>
              </tr>
              <tr>
                <td>Ganador y diferencia de gol (sin exacto)</td>
                <td>{preset.tierWinnerGoalDiff} pts</td>
              </tr>
              <tr>
                <td>Solo el ganador o empate</td>
                <td>{preset.resultPoints} pts</td>
              </tr>
              <tr>
                <td>Pegarle a los goles de un equipo (extra)</td>
                <td>+{preset.teamGoalsBonus} pt</td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <td>Marcador exacto</td>
                <td>{preset.exactPoints} pts</td>
              </tr>
              <tr>
                <td>Ganador o empate correcto</td>
                <td>{preset.resultPoints} pt{preset.resultPoints === 1 ? "" : "s"}</td>
              </tr>
              {preset.goalDiffBonus > 0 && (
                <tr>
                  <td>Diferencia de gol correcta (si no fue empate)</td>
                  <td>+{preset.goalDiffBonus} pt</td>
                </tr>
              )}
            </>
          )}
          {preset.joker && (
            <tr>
              <td>Comodín — uno por ronda, dobla ese partido</td>
              <td>×2</td>
            </tr>
          )}
          {multipliers.length > 0 && (
            <tr>
              <td>Eliminatorias multiplican los puntos</td>
              <td>
                ×{Math.min(...multipliers.map(([, v]) => v))}–×
                {Math.max(...multipliers.map(([, v]) => v))}
              </td>
            </tr>
          )}
          {rules.unicoAcertado && (
            <tr>
              <td>Único acertado — solo usted pega el exacto</td>
              <td>+{UNICO_BONUS} pts</td>
            </tr>
          )}
          {Object.entries(preset.bonusPoints).map(([k, v]) => (
            <tr key={k}>
              <td>Bonus: {BONUS_LABELS[k]}</td>
              <td>{v} pts</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pc-hint" style={{ margin: "var(--space-2) 0 0" }}>
        En eliminatorias cuentan solo los 90 minutos — ni alargue ni penales.
        Las preguntas de la recocha valen lo que diga quien organiza.
      </p>
    </details>
  );
}
