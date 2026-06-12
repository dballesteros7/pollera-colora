import { cookies } from "next/headers";

const FALLBACK_TZ = "America/Bogota";

export async function getViewerTz(): Promise<string> {
  const raw = (await cookies()).get("tz")?.value;
  if (!raw) return FALLBACK_TZ;
  const tz = decodeURIComponent(raw);
  try {
    new Intl.DateTimeFormat("es-CO", { timeZone: tz });
    return tz;
  } catch {
    return FALLBACK_TZ;
  }
}

export function dayFormatter(tz: string, tag = "es-CO") {
  return new Intl.DateTimeFormat(tag, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
}

export function timeFormatter(tz: string, tag = "es-CO") {
  return new Intl.DateTimeFormat(tag, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

// ---- datetime-local <input> round-tripping in the viewer's timezone ----
// The browser gives us a bare wall-clock string; these two keep its meaning
// anchored to the submitter's tz instead of the server's (UTC on Fly).

function tzOffsetMs(date: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour % 24,
    +parts.minute,
    +parts.second,
  );
  return asUtc - date.getTime();
}

// "YYYY-MM-DDTHH:mm" meant as wall-clock time in tz → UTC instant
export function parseDatetimeLocal(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // two passes to converge across DST boundaries
  let utc = wall - tzOffsetMs(new Date(wall), tz);
  utc = wall - tzOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

// UTC instant → "YYYY-MM-DDTHH:mm" wall-clock in tz, for input defaultValue
export function formatDatetimeLocal(date: Date, tz: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

export function dateTimeFormatter(tz: string, tag = "es-CO") {
  return new Intl.DateTimeFormat(tag, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}
