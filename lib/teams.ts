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
// name. 🦅 USA buries you 1776–0; 🦘 Australia 1901–0 (Federation), upside down.
export type PatriotTeam = "United States" | "Australia";
export interface PatriotSide {
  team: PatriotTeam;
  side: "home" | "away";
}

// Which patriot team(s) are in this match, and on which side — a USA-vs-Australia
// match (yes, it happens) returns both, so both buttons show.
export function patriotSides(
  homeTeam: string | null,
  awayTeam: string | null,
): PatriotSide[] {
  const out: PatriotSide[] = [];
  for (const team of ["United States", "Australia"] as const) {
    if (homeTeam === team) out.push({ team, side: "home" });
    else if (awayTeam === team) out.push({ team, side: "away" });
  }
  return out;
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
