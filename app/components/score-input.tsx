"use client";

import { useState } from "react";

export interface ScoreAria {
  goals: string; // "{team}" placeholder
  minus: string;
  plus: string;
}

const DEFAULT_ARIA: ScoreAria = {
  goals: "Goles {team}",
  minus: "Menos goles {team}",
  plus: "Más goles {team}",
};

function fill(tpl: string, team: string) {
  return tpl.replaceAll("{team}", team);
}

function Side({
  team,
  crest,
  name,
  defaultValue,
  aria,
}: {
  team: string;
  crest: string | null;
  name: string;
  defaultValue: number | null;
  aria: ScoreAria;
}) {
  const [value, setValue] = useState<string>(
    defaultValue === null ? "" : String(defaultValue),
  );
  const num = value === "" ? null : Number(value);

  const step = (d: number) => {
    const next = Math.min(99, Math.max(0, (num ?? 0) + d));
    setValue(String(next));
  };

  return (
    <span className="pc-score__side">
      <span className="pc-score__team">
        {crest && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={crest} alt="" className="pc-team__flag" width={26} height={19} />
        )}
        {team}
      </span>
      <span className="pc-score__box">
        <button type="button" className="pc-stepper" aria-label={fill(aria.minus, team)} onClick={() => step(-1)}>
          −
        </button>
        <input
          className="pc-score__num"
          type="number"
          name={name}
          min={0}
          max={99}
          required
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={fill(aria.goals, team)}
        />
        <button type="button" className="pc-stepper" aria-label={fill(aria.plus, team)} onClick={() => step(1)}>
          +
        </button>
      </span>
    </span>
  );
}

export function ScoreInput({
  homeTeam,
  awayTeam,
  homeCrest,
  awayCrest,
  defaultHome,
  defaultAway,
  aria = DEFAULT_ARIA,
}: {
  homeTeam: string;
  awayTeam: string;
  homeCrest: string | null;
  awayCrest: string | null;
  defaultHome: number | null;
  defaultAway: number | null;
  aria?: ScoreAria;
}) {
  return (
    <div className="pc-score">
      <Side team={homeTeam} crest={homeCrest} name="predHome" defaultValue={defaultHome} aria={aria} />
      <span className="pc-score__dash" aria-hidden>
        –
      </span>
      <Side team={awayTeam} crest={awayCrest} name="predAway" defaultValue={defaultAway} aria={aria} />
    </div>
  );
}
