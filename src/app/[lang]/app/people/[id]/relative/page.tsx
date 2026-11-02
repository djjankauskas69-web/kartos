import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, lifeSpan, relativesOf, requireWorkspace } from "@/lib/data";
import { cls } from "@/components/ui";
import { RelativeForm } from "../../../forms";
import { PageLoading } from "@/components/PageLoading";

const KINDS = ["father", "mother", "partner", "child"] as const;
type Kind = (typeof KINDS)[number];

export default async function AddRelativePage({ params, searchParams }: PageProps<"/[lang]/app/people/[id]/relative">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <AddRelative
        t={t}
        locale={locale}
        idPromise={params.then((p) => p.id)}
        kindPromise={searchParams.then((s) => String(s.kind ?? ""))}
      />
    </Suspense>
  );
}

async function AddRelative({
  t,
  locale,
  idPromise,
  kindPromise,
}: {
  t: Dictionary;
  locale: Locale;
  idPromise: Promise<string>;
  kindPromise: Promise<string>;
}) {
  const [id, kindRaw] = await Promise.all([idPromise, kindPromise]);
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as Kind) : null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !kind) notFound();

  const { current } = await requireWorkspace(locale);
  if (!can.add(current.role)) redirect(`/${locale}/app/people/${id}`);
  const { people, byId, rels } = await getFamilyGraph(locale, current.id);
  const person = byId.get(id);
  if (!person) notFound();

  const fam = relativesOf(id, rels);
  const linked = new Set([id, ...fam.parents, ...fam.partners, ...fam.children]);
  const label = (p: (typeof people)[number]) => [fullName(p), lifeSpan(p, t.app.born.toLowerCase())].filter(Boolean).join(", ");
  const candidates = people.filter((p) => !linked.has(p.id)).map((p) => ({ id: p.id, label: label(p) }));
  const partners = fam.partners.map((pid) => ({ id: pid, label: label(byId.get(pid)!) }));

  const title = { father: t.family.addFather, mother: t.family.addMother, partner: t.family.addPartner, child: t.family.addChild }[kind];

  return (
    <div className="max-w-2xl">
      <Link href={`/${locale}/app/people/${id}`} className="text-[1rem] font-semibold text-sage-deep hover:underline">
        ‹ {fullName(person)}
      </Link>
      <h1 className={`mb-8 mt-6 ${cls.h1}`}>{title}</h1>
      <RelativeForm
        t={t}
        locale={locale}
        personId={id}
        kind={kind}
        candidates={candidates}
        partners={partners}
        needsApproval={can.needsApproval(current.role)}
      />
    </div>
  );
}
