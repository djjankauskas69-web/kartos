import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasLocale } from "@/i18n/config";

/** Only paths inside this site, e.g. "/lt/invite/abc". */
function safeNext(value: string | null): string | null {
  return value && /^\/(lt|en)\/[^/]/.test(value) && !value.startsWith("//") ? value : null;
}

/** Magic-link and Google sign-in land here; exchange the code for a session. */
export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/auth/callback">) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : "lt";
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next ?? `/${locale}/app`}`);
  }
  return NextResponse.redirect(`${origin}/${locale}/login?error=1`);
}
