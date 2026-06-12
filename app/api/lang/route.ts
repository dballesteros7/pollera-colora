import { NextRequest, NextResponse } from "next/server";
import { LOCALES, type Locale } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("l");

  // Behind the proxy our own origin reads as localhost, so never build an
  // absolute URL — extract the path from the referer and redirect relative.
  let backPath = "/";
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      backPath = u.pathname + u.search;
    } catch {
      // keep "/"
    }
  }
  if (!backPath.startsWith("/") || backPath.startsWith("//")) backPath = "/";

  const res = new NextResponse(null, {
    status: 307,
    headers: { Location: backPath },
  });
  if (LOCALES.includes(lang as Locale)) {
    res.cookies.set("lang", lang!, {
      path: "/",
      maxAge: 365 * 24 * 3600,
      sameSite: "lax",
    });
  }
  return res;
}
