// Minimal slice of football-data.org v4 match resource that we consume.
// https://docs.football-data.org/general/v4/match.html

export interface FdScorePart {
  home: number | null;
  away: number | null;
}

export interface FdScore {
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  fullTime: FdScorePart;
  halfTime: FdScorePart;
  // present when the match went past regulation
  regularTime?: FdScorePart;
  extraTime?: FdScorePart;
  penalties?: FdScorePart;
}

export interface FdTeam {
  id: number | null;
  name: string | null;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status:
    | "SCHEDULED"
    | "TIMED"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "SUSPENDED"
    | "POSTPONED"
    | "CANCELLED"
    | "AWARDED";
  stage: string;
  matchday: number | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: FdScore;
}

export interface FdMatchesResponse {
  matches: FdMatch[];
}
