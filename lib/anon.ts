// Cross-polla anonymization: players you don't share a polla with are shown as
// a famous footballer, with a wink — recognizable but clearly a gag, so nobody
// mistakes it for a leak of a real name. Kept to household names only.
export const FAMOUS_ALIASES = [
  "Lionel Messías",
  "Cristiano Ronaldoh",
  "Diego Maradoh",
  "Zinedine Zidance",
  "Ronaldinha Gaúcho",
  "Kylian Mbappémonos",
  "Andrés Iniestá",
  "David Beckhambre",
  "Johan Cruyffío",
  "Robert Lewandifícil",
  "Sergio Ramirámos",
  "Gianluigi Bufón",
  "Manuel Neuerón",
  "Luka Modríguez",
] as const;

// deterministic (no Math.random) — FNV-1a, so a viewer always sees the same
// alias for the same player across renders.
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Assign collision-free famous aliases for a viewer over `order` (the ranked
// user ids), masking only those `shouldMask` returns true for. Walks ranked
// order probing for the next free name so no two outsiders share one.
export function assignAliases(
  viewerId: string,
  order: string[],
  shouldMask: (userId: string) => boolean,
): Map<string, string> {
  const aliasByUser = new Map<string, string>();
  const used = new Set<string>();
  for (const userId of order) {
    if (!shouldMask(userId)) continue;
    const start = hashStr(`${viewerId}|${userId}`) % FAMOUS_ALIASES.length;
    let name = "";
    for (let k = 0; k < FAMOUS_ALIASES.length; k++) {
      const cand = FAMOUS_ALIASES[(start + k) % FAMOUS_ALIASES.length];
      if (!used.has(cand)) {
        name = cand;
        break;
      }
    }
    // more outsiders than names (huge pool) — fall back to a numbered suffix
    if (!name) name = `${FAMOUS_ALIASES[start]} ${used.size}`;
    used.add(name);
    aliasByUser.set(userId, name);
  }
  return aliasByUser;
}
