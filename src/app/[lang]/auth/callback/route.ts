import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasLocale } from "@/i18n/config";

/** Magic-link and Google sign-in land here; exchange the code for a session. */
export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/auth/callback">) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : "lt";
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/${locale}/app`);
  }
  return NextResponse.redirect(`${origin}/${locale}/login?error=1`);
}
