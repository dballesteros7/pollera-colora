import type { FdMatchesResponse, FdMatch } from "./types";

const BASE_URL = "https://api.football-data.org/v4";

export class FdConfigError extends Error {}
export class FdApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function getToken(): string {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    throw new FdConfigError(
      "FOOTBALL_DATA_TOKEN is not set — register at https://www.football-data.org/client/register",
    );
  }
  return token;
}

// One request returns the full World Cup fixture list with current scores.
// CAVEAT (observed 2026-06-11): this list endpoint is served from a cache that
// can lag minutes behind; the single-match endpoint below is fresher. The
// poller therefore re-fetches live matches individually.
export async function fetchWorldCupMatches(): Promise<FdMatch[]> {
  const res = await fetch(`${BASE_URL}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": getToken() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new FdApiError(
      `football-data.org responded ${res.status}: ${await res.text()}`,
      res.status,
    );
  }
  const body = (await res.json()) as FdMatchesResponse;
  return body.matches;
}

export async function fetchMatch(fdId: number): Promise<FdMatch> {
  const res = await fetch(`${BASE_URL}/matches/${fdId}`, {
    headers: { "X-Auth-Token": getToken() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new FdApiError(
      `football-data.org responded ${res.status} for match ${fdId}`,
      res.status,
    );
  }
  return (await res.json()) as FdMatch;
}
