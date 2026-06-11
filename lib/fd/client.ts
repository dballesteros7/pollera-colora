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

// One request returns the full World Cup fixture list with current scores —
// the only endpoint the poller needs, well within 10 req/min.
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
