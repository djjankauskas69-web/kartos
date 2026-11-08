import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { countView, shareGraph } from "@/lib/share";
import { buildTree } from "../../app/tree/build";
import { TreeView } from "../../app/tree/TreeView";
import { treeLabels } from "../../app/tree/labels";
import { LogoLoader } from "@/components/LogoLoader";
import { SharedGone, SharedInvite, SharedTop } from "./SharedChrome";

// A private family's page: never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SharedTreePage({ params, searchParams }: PageProps<"/[lang]/m/[token]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <LogoLoader size={72} />
        </div>
      }
    >
      <SharedTree t={t} locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SharedTree({ t, locale, params, searchParams }: { t: Dictionary; locale: Locale; params: PageProps<"/[lang]/m/[token]">["params"]; searchParams: PageProps<"/[lang]/m/[token]">["searchParams"] }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const g = await shareGraph(token, t.publicTree.living);
  if (!g) return <SharedGone t={t} locale={locale} />;
  const p = String(sp.p ?? "");
  // One opening is one view; moving around inside the tree does not count again.
  if (!p) await countView(token);

  const here = `/${locale}/m/${token}`;
  const focusId = g.people.some((x) => x.id === p) ? p : null;
  const tree = buildTree({
    t,
    people: g.people,
    rels: g.rels,
    portraits: g.portraits,
    focusId,
    depth: focusId ? 4 : null,
    canAdd: false,
    base: `/${locale}/app`,
    graves: g.graves,
    profileHrefFor: (id) => `${here}/p/${id}`,
  });
  if (!tree) return <SharedGone t={t} locale={locale} />;
  const initials = new Map(g.people.map((x) => [x.id, (x as typeof x & { _initials?: string })._initials]));
  for (const c of tree.cards) {
    c.showFromHref = `${here}?p=${c.id}`;
    c.mapHref = undefined;
    c.addOptions = [];
    c.families = [];
    c.linkHref = undefined;
    const ini = initials.get(c.id);
    if (ini) c.initials = ini;
    // A living person shows nothing of who they are: no maiden name worked out from the parents,
    // and "Living person" already says they're alive.
    if (c.living) {
      c.nee = undefined;
      c.years = "";
    }
  }

  return (
    <div className="min-h-dvh">
      <SharedTop t={t} locale={locale} family={g.family} sharer={g.sharer} />
      <main id="main" className="tree-wide mx-auto w-full max-w-[88rem] px-3 pt-3 sm:px-8">
        <TreeView
          cards={tree.cards}
          boxes={tree.boxes}
          pluses={[]}
          paths={tree.paths}
          partnerPaths={tree.partnerPaths}
          laterPartnerPaths={tree.laterPartnerPaths}
          width={tree.width}
          height={tree.height}
          cardW={tree.cardW}
          cardH={tree.cardH}
          generations={tree.generationChips}
          labels={treeLabels(t)}
          locale={locale}
        />
      </main>
      <SharedInvite t={t} locale={locale} />
    </div>
  );
}
