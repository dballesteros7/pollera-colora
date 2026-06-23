"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PatriotSide, PatriotTeam } from "@/lib/teams";

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

// very Canadian apologies, sprinkled across the screen during the Canada egg
const SORRIES = [
  "Sorry!",
  "Désolé!",
  "Pardon, eh!",
  "So sorry!",
  "Sorry aboot that!",
  "My bad, eh!",
  "Apologies!",
  "Sorry!",
];

// ── Patriotic Easter eggs ───────────────────────────────────────────────────
// Each patriot team buries the opponent by its founding year and throws a party.
// The cap is 99 (server-side), so the score can be *set* and celebrated but not
// saved — the running joke, with a clear toast on the failed save.
interface PatriotTheme {
  year: number; // the scoreline: this team `year`, opponent 0
  btnClass: string; // patriotic button styling
  label: string; // button text
  chant: string; // big center chant
  chantClass: string; // base chant + theme color (+ --wrap for long lines)
  flyer: string; // creature that crosses the screen
  flyerClass: string; // flight style (eagle glide / kangaroo hop / …)
  bursts: string[]; // the "fireworks"
  flipPage?: boolean; // turn the whole page upside down (Australia → down under)
  graben?: boolean; // Switzerland: draw the Röstigraben across the screen
  apology?: boolean; // Canada: floating sorries + a maple-syrup drip
  soundSrc?: string; // audio asset played on the click gesture (the jingles)
  durationMs?: number; // fanfare lifetime; defaults to 4000, matched to the clip
}

const PATRIOTS: Record<PatriotTeam, PatriotTheme> = {
  "United States": {
    year: 1776,
    btnClass: "pc-usa-btn",
    label: "🇺🇸 USA! USA! USA! 🇺🇸",
    chant: "🇺🇸 USA! USA! USA! 🇺🇸",
    chantClass: "pc-fanfare__chant",
    flyer: "🦅",
    flyerClass: "pc-fanfare__eagle",
    bursts: ["🎆", "🎇", "🎆", "✨", "🎇", "🎆", "✨", "🎇", "🎆", "🎇"],
  },
  Australia: {
    year: 1901,
    btnClass: "pc-aus-btn",
    label: "🇦🇺 Aussie! Aussie! Aussie! Oi! Oi! Oi! 🦘",
    chant: "🇦🇺 Aussie! Aussie! Aussie! Oi! Oi! Oi!",
    chantClass: "pc-fanfare__chant pc-fanfare__chant--aus",
    flyer: "🦘",
    flyerClass: "pc-fanfare__roo",
    bursts: ["🦘", "🐨", "🪃", "⭐", "🦘", "🐨", "🪃", "⭐", "🦘", "🐨"],
    flipPage: true, // down under: the whole page turns upside down
  },
  Colombia: {
    year: 1810, // El Grito de Independencia
    btnClass: "pc-co-btn",
    label: "🇨🇴 ¡Hoy juega la Sele! 📻",
    chant: "📻 ¡Prenda la radio, encienda la tele, que hoy juega la Sele! 📺",
    chantClass: "pc-fanfare__chant pc-fanfare__chant--co pc-fanfare__chant--wrap",
    flyer: "🦋", // the yellow butterflies of Macondo
    flyerClass: "pc-fanfare__mariposa",
    bursts: ["🟡", "🔵", "🔴", "🦋", "⚽", "🟡", "🔵", "🔴", "🦋", "☕"],
    soundSrc: "/eggs/colombia-jingle.mp3",
    durationMs: 10000, // run the party for the full jingle
  },
  Switzerland: {
    year: 1291, // Bundesbrief — the founding pact
    btnClass: "pc-ch-btn",
    label: "🇨🇭 Hopp Schwiiz! 🏔️",
    chant: "🇨🇭 Hopp Schwiiz! Yodl-ay-ee-oo! 🏔️",
    chantClass: "pc-fanfare__chant pc-fanfare__chant--ch pc-fanfare__chant--wrap",
    flyer: "🐄",
    flyerClass: "pc-fanfare__cow",
    bursts: ["🧀", "🍫", "🏔️", "🐮", "⛰️", "🧀", "🍫", "🏔️", "🐮", "⛰️"],
    graben: true, // the Röstigraben splits the screen in two
    soundSrc: "/eggs/switzerland-yodel.mp3",
    durationMs: 7100, // match the clip
  },
  Canada: {
    year: 1867, // Confederation
    btnClass: "pc-ca-btn",
    label: "🇨🇦 Sorry, eh? 🍁",
    chant: "🍁 So sorry for disrupting your page, eh! 🇨🇦",
    chantClass: "pc-fanfare__chant pc-fanfare__chant--ca pc-fanfare__chant--wrap",
    flyer: "🫎",
    flyerClass: "pc-fanfare__moose",
    bursts: ["🍁", "🏒", "🍯", "🫎", "🐻", "🍁", "🏒", "🍯", "🫎", "🍁"],
    apology: true, // floating sorries + a maple-syrup drip from the top
  },
};

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
          // (the patriotic Easter eggs) submits and comes back with a clear toast
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

// 🦅🦘🎆 The freedom unleashed: creatures soar/hop, fireworks pop, the crowd
// chants. Full-viewport, non-interactive, self-dismissing. Portaled to <body> so
// no card overflow can clip the glory.
function Fanfare({ theme, onDone }: { theme: PatriotTheme; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => done.current(), theme.durationMs ?? 4000);
    // down under: flip the whole document — but not on users who asked for less
    // motion (a spinning page is exactly what they're avoiding)
    const flip =
      theme.flipPage &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    if (flip) {
      // pivot on the center of what's on screen, so the visible area flips in
      // place even when the page is scrolled down a long fixtures list
      root.style.transformOrigin = `50% ${window.scrollY + window.innerHeight / 2}px`;
      root.classList.add("pc-flip");
    }
    return () => {
      clearTimeout(id);
      if (flip) root.classList.remove("pc-flip");
    };
  }, [theme.flipPage, theme.durationMs]);

  if (typeof document === "undefined") return null;

  const flyers = Array.from({ length: 8 });

  return createPortal(
    <div className="pc-fanfare" aria-hidden>
      {theme.bursts.map((b, i) => (
        <span
          key={`b${i}`}
          className="pc-fanfare__firework"
          style={{
            left: `${6 + ((i * 97) % 88)}%`,
            top: `${10 + ((i * 53) % 70)}%`,
            fontSize: `${34 + ((i * 13) % 30)}px`,
            animationDelay: `${(i % 6) * 0.28}s`,
          }}
        >
          {b}
        </span>
      ))}
      {flyers.map((_, i) => (
        <span
          key={`y${i}`}
          className={theme.flyerClass}
          style={{
            top: `${6 + i * 11}%`,
            fontSize: `${30 + (i % 3) * 14}px`,
            animationDelay: `${i * 0.2}s`,
            animationDuration: `${2.6 + (i % 3) * 0.6}s`,
            // a longer party keeps the critters streaming across the whole time
            animationIterationCount: theme.durationMs ? "infinite" : undefined,
          }}
        >
          {theme.flyer}
        </span>
      ))}
      {theme.graben && (
        // the Röstigraben: the (only half-joking) cultural rift between the
        // Swiss-German and Romandie halves of the country
        <div className="pc-fanfare__graben" aria-hidden>
          <span className="pc-fanfare__graben-label">🥔 Röstigraben 🥔</span>
        </div>
      )}
      {theme.apology && (
        <>
          <div className="pc-fanfare__syrup" aria-hidden />
          {SORRIES.map((s, i) => (
            <span
              key={`s${i}`}
              className="pc-fanfare__sorry"
              style={{
                left: `${6 + ((i * 89) % 86)}%`,
                animationDelay: `${(i % 4) * 0.3}s`,
                animationDuration: `${3 + (i % 3) * 0.5}s`,
              }}
            >
              {s}
            </span>
          ))}
        </>
      )}
      <span
        className={theme.chantClass}
        style={theme.durationMs ? { animationDuration: `${theme.durationMs}ms` } : undefined}
      >
        {theme.chant}
      </span>
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
  patriots = [],
  aria = DEFAULT_ARIA,
}: {
  homeTeam: string;
  awayTeam: string;
  homeCrest: string | null;
  awayCrest: string | null;
  defaultHome: number | null;
  defaultAway: number | null;
  patriots?: PatriotSide[];
  aria?: ScoreAria;
}) {
  const [homeValue, setHomeValue] = useScoreValue(defaultHome);
  const [awayValue, setAwayValue] = useScoreValue(defaultAway);
  const [fanfare, setFanfare] = useState<PatriotTheme | null>(null);

  // bury the opponent by the founding year, set the other side to 0, party.
  // (The 99 cap still blocks the save — the running joke survives.)
  const unleash = (p: PatriotSide) => {
    const theme = PATRIOTS[p.team];
    const year = String(theme.year);
    if (p.side === "home") {
      setHomeValue(year);
      setAwayValue("0");
    } else {
      setAwayValue(year);
      setHomeValue("0");
    }
    setFanfare(theme);
    // musical eggs — this click is the user gesture that unlocks audio playback
    if (theme.soundSrc) {
      const audio = new Audio(theme.soundSrc);
      audio.volume = 0.85;
      void audio.play().catch(() => {});
    }
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
      {patriots.map((p) => (
        <button key={p.team} type="button" className={PATRIOTS[p.team].btnClass} onClick={() => unleash(p)}>
          {PATRIOTS[p.team].label}
        </button>
      ))}
      {fanfare && <Fanfare theme={fanfare} onDone={() => setFanfare(null)} />}
    </>
  );
}
