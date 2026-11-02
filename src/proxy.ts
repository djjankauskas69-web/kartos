import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, locales, type Locale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

const COOKIE = "locale";

/** Pick a locale: saved choice first, then the browser's languages, then Lithuanian. */
function pickLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(COOKIE)?.value;
  if (saved && hasLocale(saved)) return saved;

  const header = request.headers.get("accept-language") ?? "";
  const preferred = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of preferred) {
    if (hasLocale(lang)) return lang;
  }
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (!locale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${pickLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // Keep the sign-in session fresh, and guard the family archive.
  const { response, signedIn } = await updateSession(request);
  const inApp = pathname === `/${locale}/app` || pathname.startsWith(`/${locale}/app/`);
  const onLogin = pathname === `/${locale}/login`;

  if (inApp && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (onLogin && signedIn) {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.pathname = next && /^\/(lt|en)\/[^/]/.test(next) && !next.startsWith("//") ? next : `/${locale}/app`;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Skip Next internals, API routes and files with an extension (favicon, images).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
