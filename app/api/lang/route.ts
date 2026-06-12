import { NextRequest, NextResponse } from "next/server";
import { LOCALES, type Locale } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("l");
  const back = req.headers.get("referer");
  const backPath =
    back && new URL(back).origin === req.nextUrl.origin
      ? new URL(back).pathname
      : "/";
  const res = NextResponse.redirect(new URL(backPath, req.nextUrl.origin));
  if (LOCALES.includes(lang as Locale)) {
    res.cookies.set("lang", lang!, {
      path: "/",
      maxAge: 365 * 24 * 3600,
      sameSite: "lax",
    });
  }
  return res;
}
