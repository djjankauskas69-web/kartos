import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, lifeSpan, relativesOf, requireWorkspace } from "@/lib/data";
import { edgePaths, layoutTree } from "@/lib/tree-layout";
import { cls } from "@/components/ui";
import { portraitUrls } from "../portraits";
import { TreeView, type TreeCard } from "./TreeView";
import { FocusPicker } from "./FocusPicker";

export default async function TreePage({ searchParams }: PageProps<"/[lang]/app/tree">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Tree t={t} locale={locale} focusPromise={searchParams.then((s) => String(s.p ?? ""))} />
    </Suspense>
  );
}

async function Tree({ t, locale, focusPromise }: { t: Dictionary; locale: Locale; focusPromise: Promise<string> }) {
  const { current, user } = await requireWorkspace(locale);
  const { people, byId, rels } = await getFamilyGraph(locale, current.id);
  const base = `/${locale}/app`;

  if (people.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className={cls.h1}>{t.tree.title}</h1>
        <p className="mt-3 text-ink-muted">{t.tree.empty}</p>
        <Link href={base} className={`mt-6 ${cls.primary}`}>
          {t.app.addPerson}
        </Link>
      </div>
    );
  }

  // Start from the requested person; otherwise the most connected person (usually the family's centre).
  const requested = await focusPromise;
  const connections = (id: string) => rels.filter((r) => r.person_a === id || r.person_b === id).length;
  const focusId = byId.has(requested)
    ? requested
    : [...people].sort((a, b) => connections(b.id) - connections(a.id) || (a.created_by === user.id ? -1 : 1))[0].id;

  const layout = layoutTree(focusId, people, rels);
  const shown = [...new Set(layout.nodes.map((n) => n.id))].map((id) => byId.get(id)!);
  const portraits = await portraitUrls(locale, shown);

  const cards: TreeCard[] = layout.nodes.map((n) => {
    const p = byId.get(n.id)!;
    return {
      key: n.key,
      id: n.id,
      x: n.x,
      y: n.y,
      focus: n.role === "focus",
      name: fullName(p),
      dates: lifeSpan(p, t.app.born.toLowerCase()) || (p.is_living ? t.app.alive : ""),
      portrait: portraits.get(n.id),
      initials: `${p.given_names.trim()[0] ?? ""}${p.surname?.trim()[0] ?? ""}`.toUpperCase(),
      pending: p.status === "pending",
      moreAbove: n.moreAbove,
      moreBelow: n.moreBelow,
    };
  });

  const focus = byId.get(focusId)!;
  const alone = layout.nodes.length === 1 && relativesOf(focusId, rels).parents.length === 0;
  const options = people.map((p) => ({ id: p.id, label: [fullName(p), lifeSpan(p, t.app.born.toLowerCase())].filter(Boolean).join(", ") }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={cls.h1}>{t.tree.title}</h1>
          <p className="mt-1 text-ink-muted">{t.tree.hint}</p>
        </div>
        <FocusPicker label={t.tree.centreOn} options={options} value={focusId} base={`${base}/tree`} />
      </div>

      <TreeView
        cards={cards}
        paths={edgePaths(layout.nodes, layout.edges)}
        width={layout.width}
        height={layout.height}
        base={`${base}/tree`}
        profileHref={`${base}/people/${focusId}`}
        labels={{
          zoomIn: t.tree.zoomIn,
          zoomOut: t.tree.zoomOut,
          reset: t.tree.reset,
          openProfile: t.tree.openProfile,
          moreAbove: t.tree.moreAbove,
          moreBelow: t.tree.moreBelow,
          pending: t.app.pending,
        }}
      />

      {alone && can.add(current.role) && (
        <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${cls.card}`}>
          <p className="text-ink-muted">
            {fullName(focus)}: {t.tree.noRelatives}
          </p>
          <Link href={`${base}/people/${focusId}`} className={cls.primary}>
            {t.tree.addRelatives}
          </Link>
        </div>
      )}
    </div>
  );
}
