"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Stores the browser's IANA timezone in a cookie so server rendering can
// format times in the viewer's local zone. Refreshes once when it changes.
export function TzSync() {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith("tz="))
      ?.slice(3);
    if (current !== encodeURIComponent(tz)) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [router]);
  return null;
}
