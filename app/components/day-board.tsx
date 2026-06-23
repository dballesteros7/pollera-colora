"use client";

import { useState, type ReactNode } from "react";

export interface DayChip {
  key: string;
  home: string; // 3-letter code
  away: string;
  homeCrest: string | null;
  awayCrest: string | null;
  center: string; // live score, or kickoff time
  live: boolean;
}

// Kicker-style day board: a compact, horizontally-scrollable strip of the day's
// fixtures (flags + codes + score/time) over a single full-width detail card.
// Tapping a chip swaps the detail below — so every match (and its patriotic
// Easter-egg button) stays reachable, while the detail never gets cramped.
export function DayBoard({
  label,
  chips,
  details,
  defaultIndex,
}: {
  label: string;
  chips: DayChip[];
  details: ReactNode[];
  defaultIndex: number;
}) {
  const [sel, setSel] = useState(defaultIndex);
  const active = Math.min(Math.max(sel, 0), details.length - 1);

  return (
    <section className="pc-daysec" aria-label={label}>
      <div className="pc-daysec__head">
        <span className="pc-match__meta">{label}</span>
      </div>

      {chips.length > 1 && (
        <div className="pc-daystrip" role="tablist" aria-label={label}>
          {chips.map((c, i) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`pc-daychip${i === active ? " is-active" : ""}`}
              onClick={() => setSel(i)}
            >
              <span className="pc-daychip__match">
                {c.homeCrest && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.homeCrest} alt="" width={16} height={12} />
                )}
                <span>{c.home}</span>
                <span className="pc-daychip__vs">–</span>
                <span>{c.away}</span>
                {c.awayCrest && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.awayCrest} alt="" width={16} height={12} />
                )}
              </span>
              <span className={`pc-daychip__sub${c.live ? " is-live" : ""}`}>
                {c.live && <span className="pc-dot" />}
                {c.center}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="pc-daydetail">{details[active]}</div>
    </section>
  );
}
