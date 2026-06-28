export type PresetId = "clasica" | "marcador_o_nada" | "escalonada";

// what groups.scoring_rules holds (JSON)
export interface ScoringRules {
  preset: PresetId;
  unicoAcertado: boolean; // +5 if you alone hit the exact score
}

export interface BonusPoints {
  champion: number;
  runner_up: number;
  third: number;
  top_scorer: number;
  best_gk: number;
}

export interface PresetDef {
  id: PresetId;
  name: string;
  description: string;
  // additive presets
  resultPoints: number;
  exactPoints: number;
  goalDiffBonus: number; // 0 when unused
  // escalonada is mutually exclusive tiers instead
  exclusiveTiers: boolean;
  tierWinnerGoalDiff: number; // escalonada middle tier
  teamGoalsBonus: number; // escalonada +1 for one team's goals
  joker: boolean; // one per round, doubles a chosen match
  // knockout multipliers by stage, applied to match points
  stageMultipliers: Record<string, number>;
  bonusPoints: BonusPoints;
}

const NO_MULTIPLIERS: Record<string, number> = {};

export const PRESETS: Record<PresetId, PresetDef> = {
  clasica: {
    id: "clasica",
    name: "Clásica",
    description:
      "La planilla tradicional: 1 pt resultado, 3 pts marcador exacto, +1 por diferencia de gol.",
    resultPoints: 1,
    exactPoints: 3,
    goalDiffBonus: 1,
    exclusiveTiers: false,
    tierWinnerGoalDiff: 0,
    teamGoalsBonus: 0,
    joker: false,
    stageMultipliers: NO_MULTIPLIERS,
    bonusPoints: {
      champion: 10,
      runner_up: 8,
      third: 6,
      top_scorer: 6,
      best_gk: 6,
    },
  },
  marcador_o_nada: {
    id: "marcador_o_nada",
    name: "Marcador o nada",
    description:
      "Para valientes: 4 pts resultado, 10 pts marcador exacto, y las eliminatorias multiplican.",
    resultPoints: 4,
    exactPoints: 10,
    goalDiffBonus: 0,
    exclusiveTiers: false,
    tierWinnerGoalDiff: 0,
    teamGoalsBonus: 0,
    joker: false,
    stageMultipliers: {
      LAST_32: 1.5,
      LAST_16: 1.5,
      QUARTER_FINALS: 2,
      SEMI_FINALS: 2,
      THIRD_PLACE: 2,
      FINAL: 3,
    },
    bonusPoints: {
      champion: 10,
      runner_up: 8,
      third: 6,
      top_scorer: 6,
      best_gk: 6,
    },
  },
  escalonada: {
    id: "escalonada",
    name: "Escalonada con comodín",
    description:
      "Niveles excluyentes: exacto 10 / ganador y diferencia 5 / ganador 2 (+1 goles de un equipo). Un comodín por ronda dobla un partido.",
    resultPoints: 2,
    exactPoints: 10,
    goalDiffBonus: 0,
    exclusiveTiers: true,
    tierWinnerGoalDiff: 5,
    teamGoalsBonus: 1,
    joker: true,
    stageMultipliers: NO_MULTIPLIERS,
    bonusPoints: {
      champion: 10,
      runner_up: 8,
      third: 6,
      top_scorer: 6,
      best_gk: 6,
    },
  },
};

// The Súper Polla scores under Marcador o nada, but with the comodín switched
// on — players pick their own joker there (it isn't inherited from the home
// polla), and a jokered knockout pick doubles in the glory table.
export const SUPER_PRESET: PresetDef = { ...PRESETS.marcador_o_nada, joker: true };

// Canonical preset resolver: the Súper Polla uses SUPER_PRESET; every other
// polla uses the preset named in its stored scoring rules.
export function presetForGroup(group: {
  isSuper?: boolean | null;
  scoringRules: unknown;
}): PresetDef {
  if (group.isSuper) return SUPER_PRESET;
  return PRESETS[parseScoringRules(group.scoringRules).preset];
}

export function parseScoringRules(raw: unknown): ScoringRules {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  const preset =
    typeof obj.preset === "string" && obj.preset in PRESETS
      ? (obj.preset as PresetId)
      : "clasica";
  return { preset, unicoAcertado: obj.unicoAcertado === true };
}
