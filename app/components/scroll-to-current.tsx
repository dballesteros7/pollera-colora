"use client";

import { useEffect } from "react";

// On opening the long fixtures list, jump straight to the current/next match so
// the viewer doesn't have to scroll past every finished game. Instant (no smooth
// animation) — a slow scroll across a 100-match list is worse than a jump.
// scroll-margin-top on the target keeps it clear of the sticky header.
export function ScrollToCurrent({ targetId }: { targetId: string }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    // wait one frame so layout (flags have fixed dims) is settled before jumping
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [targetId]);
  return null;
}
