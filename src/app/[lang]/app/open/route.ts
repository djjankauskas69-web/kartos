import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasLocale } from "@/i18n/config";
import { WS_COOKIE } from "@/lib/data";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Switch to another of your archives and open its tree at one person
 * ("Rūta's family tree" from a linked card). Not being a member just lands you
 * back in your own archive, because the archive is chosen among your memberships.
 */
export async function GET(request: Request, ctx: RouteContext<"/[lang]/app/open">) {
  const { lang } = await ctx.params;
  const locale = hasLocale(lang) ? lang : "lt";
  const url = new URL(request.url);
  const ws = url.searchParams.get("ws") ?? "";
  const p = url.searchParams.get("p") ?? "";
  if (UUID.test(ws)) (await cookies()).set(WS_COOKIE, ws, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return NextResponse.redirect(new URL(`/${locale}/app/tree${UUID.test(p) ? `?p=${p}` : ""}`, url));
}
