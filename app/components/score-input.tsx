"use client";

import { useState } from "react";

function Side({
  team,
  crest,
  name,
  defaultValue,
}: {
  team: string;
  crest: string | null;
  name: string;
  defaultValue: number | null;
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
        <button type="button" className="pc-stepper" aria-label={`Menos goles ${team}`} onClick={() => step(-1)}>
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
          aria-label={`Goles ${team}`}
        />
        <button type="button" className="pc-stepper" aria-label={`Más goles ${team}`} onClick={() => step(1)}>
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
}: {
  homeTeam: string;
  awayTeam: string;
  homeCrest: string | null;
  awayCrest: string | null;
  defaultHome: number | null;
  defaultAway: number | null;
}) {
  return (
    <div className="pc-score">
      <Side team={homeTeam} crest={homeCrest} name="predHome" defaultValue={defaultHome} />
      <span className="pc-score__dash" aria-hidden>
        –
      </span>
      <Side team={awayTeam} crest={awayCrest} name="predAway" defaultValue={defaultAway} />
    </div>
  );
}
