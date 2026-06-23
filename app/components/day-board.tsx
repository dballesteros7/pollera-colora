"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

  // Desktop has no swipe and we hide the scrollbar, so the strip needs a visible
  // affordance: arrow buttons that appear only when it actually overflows, each
  // disabled at its end. Touch devices swipe instead (the arrows hide via CSS).
  const stripRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 4,
        right: Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [chips.length]);

  const nudge = (dir: -1 | 1) =>
    stripRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });

  const overflowing = edges.left || edges.right;

  return (
    <section className="pc-daysec" aria-label={label}>
      <div className="pc-daysec__head">
        <span className="pc-match__meta">{label}</span>
        {chips.length > 1 && overflowing && (
          <span className="pc-daynav">
            <button
              type="button"
              className="pc-daynav__btn"
              aria-label="scroll left"
              disabled={!edges.left}
              onClick={() => nudge(-1)}
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button
              type="button"
              className="pc-daynav__btn"
              aria-label="scroll right"
              disabled={!edges.right}
              onClick={() => nudge(1)}
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </span>
        )}
      </div>

      {chips.length > 1 && (
        <div className="pc-daystrip" ref={stripRef} role="tablist" aria-label={label}>
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
