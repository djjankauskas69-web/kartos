import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, familyLinks, fullName, lifeSpan, myPersonLinks, requireWorkspace, type Person } from "@/lib/data";
import { kinship } from "@/lib/kinship";
import { cls } from "@/components/ui";
import { loadMerge } from "../../../merge-data";
import { MergeForm } from "./MergeForm";
import { PageLoading } from "@/components/PageLoading";

export default async function ComparePage({ params, searchParams }: PageProps<"/[lang]/app/people/[id]/compare">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <Compare t={t} locale={locale} idPromise={params.then((p) => p.id)} linkPromise={searchParams.then((s) => String(s.link ?? ""))} />
    </Suspense>
  );
}

async function Compare({ t, locale, idPromise, linkPromise }: { t: Dictionary; locale: Locale; idPromise: Promise<string>; linkPromise: Promise<string> }) {
  const [id, linkParam] = await Promise.all([idPromise, linkPromise]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { current, supabase } = await requireWorkspace(locale);
  const base = `/${locale}/app`;
  if (!can.admin(current.role)) redirect(`${base}/people/${id}`);
  const m = t.merge;

  // Harmless probe: fails with "pick people…" when 0008 is in, "function not found" (PGRST202) when not.
  const probe = await supabase.rpc("link_people", { p_mine: "00000000-0000-0000-0000-000000000000", p_theirs: "00000000-0000-0000-0000-000000000000" });
  const ready = probe.error?.code !== "PGRST202";
  const links = await familyLinks(locale, current.id);
  const link = links.find((l) => l.id === linkParam) ?? links.find((l) => l.mine === id && l.accepted);
  const data = link ? await loadMerge(locale, link.id) : null;

  const back = (
    <Link href={`${base}/people/${id}/link`} className="text-[1rem] font-semibold text-ink-muted hover:text-ink hover:underline">
      ‹ {t.familyLink.title}
    </Link>
  );
  if (!ready || !data || !data.other || !data.plan) {
    return (
      <div className="max-w-2xl">
        {back}
        <h1 className={`mb-3 mt-6 ${cls.h1}`}>{m.title}</h1>
        <p className={`mt-6 px-5 py-4 ${cls.card}`}>{!ready ? m.needsUpdate : m.notMember}</p>
      </div>
    );
  }
  const { plan, mine, theirs, linked, other } = data;
  const born = t.app.born.toLowerCase();
  const row = (p: Person) => ({ name: fullName(p), years: lifeSpan(p, born) });
  const show = (f: string, v: unknown) => (v === null || v === undefined || v === "" ? m.empty : f === "is_living" ? (v ? m.yes : m.no) : String(v));

  // Their people described from your place in their tree, when you are in it.
  const meHere = (await myPersonLinks(locale)).links.get(current.id);
  const meThere = plan.matched.find((x) => x.mine === meHere)?.theirs;
  const via = kinship(theirs.people, theirs.rels, meThere, locale);

  const pairs = plan.matched.map((x) => {
    const a = mine.byId.get(x.mine)!;
    const b = theirs.byId.get(x.theirs)!;
    return {
      key: `${x.mine}:${x.theirs}`,
      mine: row(a),
      theirs: row(b),
      linked: linked.has(`${x.mine}:${x.theirs}`),
      diffs: x.diffs.map((f) => ({ field: f, label: m.fields[f], mine: show(f, a[f]), theirs: show(f, b[f]) })),
    };
  });
  const onlyTheirs = plan.onlyTheirs.map((tid) => ({ id: tid, ...row(theirs.byId.get(tid)!), via: via.get(tid) ?? "" }));
  const anchor = mine.byId.get(data.link.mine);

  return (
    <div className="max-w-3xl">
      {back}
      <h1 className={`mb-3 mt-6 ${cls.h1}`}>{m.title}</h1>
      <p className="text-[1.08rem] text-ink-muted">{m.lead.replace("{family}", other.name).replace("{name}", anchor ? fullName(anchor) : "")}</p>
      {onlyTheirs.length === 0 && pairs.every((p) => p.linked && p.diffs.length === 0) ? (
        <p className={`mt-8 px-5 py-4 ${cls.card}`}>{m.nothing}</p>
      ) : (
        <MergeForm
          locale={locale}
          linkId={data.link.id}
          pairs={pairs}
          onlyTheirs={onlyTheirs}
          onlyMine={plan.onlyMine}
          labels={{ same: m.same, sameLead: m.sameLead, diff: m.diff, diffLead: m.diffLead, keepMine: m.keepMine, takeTheirs: m.takeTheirs, only: m.only, onlyLead: m.onlyLead, onlyMine: m.onlyMine, apply: m.apply, error: m.error }}
        />
      )}
    </div>
  );
}
