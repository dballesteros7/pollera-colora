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
