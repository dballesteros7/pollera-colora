"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

// One score box's value, kept in sync with the server-side default: a
// revalidation (copy, apply-to-all, save) refreshes the box, while plain typing
// is left alone. No pick yet shows as 0 so the steppers start from a real number.
function useScoreValue(defaultValue: number | null) {
  const init = defaultValue === null ? "0" : String(defaultValue);
  const [state, setState] = useState({ seen: defaultValue, value: init });
  if (state.seen !== defaultValue) {
    setState({ seen: defaultValue, value: init });
  }
  const value = state.seen !== defaultValue ? init : state.value;
  const setValue = (v: string) => setState((s) => ({ ...s, value: v }));
  return [value, setValue] as const;
}

function Side({
  team,
  crest,
  name,
  value,
  setValue,
  aria,
}: {
  team: string;
  crest: string | null;
  name: string;
  value: string;
  setValue: (v: string) => void;
  aria: ScoreAria;
}) {
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
          // no max: the 99 cap is enforced server-side, so an over-cap score
          // (the 1776–0 Easter egg) submits and comes back with a clear toast
          // instead of being silently blocked by a native validation bubble
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

// 🦅🎆 The freedom unleashed: eagles soar, fireworks pop, the crowd chants.
// Full-viewport, non-interactive, self-dismissing. Portaled to <body> so no card
// overflow can clip America's glory.
function Fanfare({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => done.current(), 4000);
    return () => clearTimeout(id);
  }, []);

  if (typeof document === "undefined") return null;

  const eagles = Array.from({ length: 8 });
  const fireworks = ["🎆", "🎇", "🎆", "✨", "🎇", "🎆", "✨", "🎇", "🎆", "🎇"];

  return createPortal(
    <div className="pc-fanfare" aria-hidden>
      {fireworks.map((fw, i) => (
        <span
          key={`f${i}`}
          className="pc-fanfare__firework"
          style={{
            left: `${6 + ((i * 97) % 88)}%`,
            top: `${10 + ((i * 53) % 70)}%`,
            fontSize: `${34 + ((i * 13) % 30)}px`,
            animationDelay: `${(i % 6) * 0.28}s`,
          }}
        >
          {fw}
        </span>
      ))}
      {eagles.map((_, i) => (
        <span
          key={`e${i}`}
          className="pc-fanfare__eagle"
          style={{
            top: `${6 + i * 11}%`,
            fontSize: `${30 + (i % 3) * 14}px`,
            animationDelay: `${i * 0.2}s`,
            animationDuration: `${2.6 + (i % 3) * 0.6}s`,
          }}
        >
          🦅
        </span>
      ))}
      <span className="pc-fanfare__chant">🇺🇸 USA! USA! USA! 🇺🇸</span>
    </div>,
    document.body,
  );
}

export function ScoreInput({
  homeTeam,
  awayTeam,
  homeCrest,
  awayCrest,
  defaultHome,
  defaultAway,
  usaSide = null,
  aria = DEFAULT_ARIA,
}: {
  homeTeam: string;
  awayTeam: string;
  homeCrest: string | null;
  awayCrest: string | null;
  defaultHome: number | null;
  defaultAway: number | null;
  usaSide?: "home" | "away" | null;
  aria?: ScoreAria;
}) {
  const [homeValue, setHomeValue] = useScoreValue(defaultHome);
  const [awayValue, setAwayValue] = useScoreValue(defaultAway);
  const [fanfare, setFanfare] = useState(false);

  // The friend who couldn't enter 1776–0 gets his moment: USA buries the
  // opponent, eagles fly, fireworks pop. (The 99 cap still blocks the save —
  // the running joke survives.)
  const unleashFreedom = () => {
    if (usaSide === "home") {
      setHomeValue("1776");
      setAwayValue("0");
    } else {
      setAwayValue("1776");
      setHomeValue("0");
    }
    setFanfare(true);
  };

  return (
    <>
      <div className="pc-score">
        <Side team={homeTeam} crest={homeCrest} name="predHome" value={homeValue} setValue={setHomeValue} aria={aria} />
        <span className="pc-score__dash" aria-hidden>
          –
        </span>
        <Side team={awayTeam} crest={awayCrest} name="predAway" value={awayValue} setValue={setAwayValue} aria={aria} />
      </div>
      {usaSide && (
        <button type="button" className="pc-usa-btn" onClick={unleashFreedom}>
          🇺🇸 USA! USA! USA! 🇺🇸
        </button>
      )}
      {fanfare && <Fanfare onDone={() => setFanfare(false)} />}
    </>
  );
}
