import type { Locale } from "./i18n";
import { LOCALE_TAG } from "./i18n";

// football-data.org English team name → ISO 3166-1 alpha-2.
// England/Scotland aren't ISO countries; they get manual translations below.
const ISO: Record<string, string> = {
  Algeria: "DZ",
  Argentina: "AR",
  Australia: "AU",
  Austria: "AT",
  Belgium: "BE",
  "Bosnia-Herzegovina": "BA",
  Brazil: "BR",
  Canada: "CA",
  "Cape Verde Islands": "CV",
  Colombia: "CO",
  "Congo DR": "CD",
  Croatia: "HR",
  Curaçao: "CW",
  Czechia: "CZ",
  Ecuador: "EC",
  Egypt: "EG",
  France: "FR",
  Germany: "DE",
  Ghana: "GH",
  Haiti: "HT",
  Iran: "IR",
  Iraq: "IQ",
  "Ivory Coast": "CI",
  Japan: "JP",
  Jordan: "JO",
  Mexico: "MX",
  Morocco: "MA",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Norway: "NO",
  Panama: "PA",
  Paraguay: "PY",
  Portugal: "PT",
  Qatar: "QA",
  "Saudi Arabia": "SA",
  Senegal: "SN",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
  Tunisia: "TN",
  Turkey: "TR",
  "United States": "US",
  Uruguay: "UY",
  Uzbekistan: "UZ",
};

const MANUAL: Record<string, Record<Locale, string>> = {
  England: { es: "Inglaterra", en: "England", de: "England", it: "Inghilterra", fr: "Angleterre", nl: "Engeland", pt: "Inglaterra", zh: "英格兰", zht: "英格蘭" },
  Scotland: { es: "Escocia", en: "Scotland", de: "Schottland", it: "Scozia", fr: "Écosse", nl: "Schotland", pt: "Escócia", zh: "苏格兰", zht: "蘇格蘭" },
  // Intl renders these absurdly long ("República Democrática del Congo",
  // "Congo - Kinshasa") — use the football-media names instead
  "Congo DR": { es: "RD del Congo", en: "DR Congo", de: "DR Kongo", it: "RD del Congo", fr: "RD Congo", nl: "DR Congo", pt: "RD do Congo", zh: "刚果（金）", zht: "剛果（金）" },
  "Bosnia-Herzegovina": { es: "Bosnia", en: "Bosnia", de: "Bosnien", it: "Bosnia", fr: "Bosnie", nl: "Bosnië", pt: "Bósnia", zh: "波黑", zht: "波赫" },
};

// Teams with a patriotic Easter egg on the score input, by raw football-data
// name. Each buries the opponent by a founding year and throws a themed party:
//   🦅 USA 1776–0 · 🦘 Australia 1901–0 (upside down) · 🦋 Colombia 1810–0 (la
//   Sele jingle) · 🐄 Switzerland 1291–0 (yodel + Röstigraben) · 🫎 Canada
//   1867–0 (moose, maple, and a heartfelt sorry). The 99 cap blocks the save —
//   that's the running joke. Order here drives button order in the rare
//   patriot-vs-patriot match.
export type PatriotTeam =
  | "United States"
  | "Australia"
  | "Colombia"
  | "Switzerland"
  | "Canada";
export interface PatriotSide {
  team: PatriotTeam;
  side: "home" | "away";
}

const PATRIOT_TEAMS: readonly PatriotTeam[] = [
  "United States",
  "Australia",
  "Colombia",
  "Switzerland",
  "Canada",
];

// Which patriot team(s) are in this match, and on which side — a patriot-vs-
// patriot match (yes, it happens) returns both, so both buttons show.
export function patriotSides(
  homeTeam: string | null,
  awayTeam: string | null,
): PatriotSide[] {
  const out: PatriotSide[] = [];
  for (const team of PATRIOT_TEAMS) {
    if (homeTeam === team) out.push({ team, side: "home" });
    else if (awayTeam === team) out.push({ team, side: "away" });
  }
  return out;
}

// i18n key for the "over the 99 cap" save-failed toast, themed per team.
const SCORE_ERR_KEY: Record<PatriotTeam, string> = {
  "United States": "ui.scoreErr",
  Australia: "ui.scoreErrAus",
  Colombia: "ui.scoreErrCol",
  Switzerland: "ui.scoreErrSui",
  Canada: "ui.scoreErrCan",
};

// Which toast to show when an over-cap patriotic score fails to save. Falls back
// to the generic message; in a patriot-vs-patriot match the home side's wins.
export function scoreErrKey(sides: PatriotSide[]): string {
  return sides.length > 0 ? SCORE_ERR_KEY[sides[0].team] : "ui.scoreErr";
}

// FIFA-style 3-letter codes for the compact fixtures strip; fall back to the
// first three letters of the raw name for anything unmapped.
const TEAM_CODE: Record<string, string> = {
  Algeria: "ALG", Argentina: "ARG", Australia: "AUS", Austria: "AUT",
  Belgium: "BEL", "Bosnia-Herzegovina": "BIH", Brazil: "BRA", Canada: "CAN",
  "Cape Verde Islands": "CPV", Colombia: "COL", "Congo DR": "COD", Croatia: "CRO",
  Curaçao: "CUW", Czechia: "CZE", Ecuador: "ECU", Egypt: "EGY", England: "ENG",
  France: "FRA", Germany: "GER", Ghana: "GHA", Haiti: "HAI", Iran: "IRN",
  Iraq: "IRQ", "Ivory Coast": "CIV", Japan: "JPN", Jordan: "JOR", Mexico: "MEX",
  Morocco: "MAR", Netherlands: "NED", "New Zealand": "NZL", Norway: "NOR",
  Panama: "PAN", Paraguay: "PAR", Portugal: "POR", Qatar: "QAT",
  "Saudi Arabia": "KSA", Scotland: "SCO", Senegal: "SEN", "South Africa": "RSA",
  "South Korea": "KOR", Spain: "ESP", Sweden: "SWE", Switzerland: "SUI",
  Tunisia: "TUN", Turkey: "TUR", "United States": "USA", Uruguay: "URU",
  Uzbekistan: "UZB",
};

export function teamAbbrev(name: string | null): string {
  if (!name) return "—";
  return TEAM_CODE[name] ?? name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

const displayCache = new Map<Locale, Intl.DisplayNames>();

export function teamName(name: string | null, locale: Locale): string | null {
  if (!name) return null;
  const manual = MANUAL[name];
  if (manual) return manual[locale];
  const iso = ISO[name];
  if (!iso) return name; // unknown / placeholder — show as-is
  let dn = displayCache.get(locale);
  if (!dn) {
    dn = new Intl.DisplayNames([LOCALE_TAG[locale]], { type: "region" });
    displayCache.set(locale, dn);
  }
  try {
    return dn.of(iso) ?? name;
  } catch {
    return name;
  }
}
