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
  England: { es: "Inglaterra", en: "England", de: "England" },
  Scotland: { es: "Escocia", en: "Scotland", de: "Schottland" },
};

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
