import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, profileNames, requireWorkspace, signedUrls } from "@/lib/data";
import { folderLabel, periodLabel, type FolderRow } from "@/lib/archive";
import { cls } from "@/components/ui";
import { ArchiveLibrary, type ArchiveItem, type Kind } from "./ArchiveLibrary";

export default async function ArchivePage({ searchParams }: PageProps<"/[lang]/app/archive">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Archive t={t} locale={locale} itemPromise={searchParams.then((s) => String(s.item ?? ""))} />
    </Suspense>
  );
}

async function Archive({ t, locale, itemPromise }: { t: Dictionary; locale: Locale; itemPromise: Promise<string> }) {
  const { supabase, user, current } = await requireWorkspace(locale);
  const [{ people }, media, folderRows, itemParam] = await Promise.all([
    getFamilyGraph(locale, current.id),
    supabase
      .from("media")
      .select("id, kind, title, description, place, taken_year, year_qualifier, year_to, folder_id, storage_path, mime_type, uploader_id, status, created_at, file_name, media_persons(person_id)")
      .eq("workspace_id", current.id)
      .neq("status", "rejected")
      // Photos that belong to a memory stay with that memory.
      .or("storage_path.is.null,storage_path.not.like.*/memories/*")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("media_folders").select("id, preset, name, sort").eq("workspace_id", current.id).order("sort").order("created_at"),
    itemPromise,
  ]);

  const rows = media.data ?? [];
  const [urls, uploaders] = await Promise.all([
    signedUrls(locale, rows.map((m) => m.storage_path).filter((p): p is string => !!p)),
    profileNames(locale, rows.map((m) => m.uploader_id as string)),
  ]);
  const isEditor = can.edit(current.role);

  const items: ArchiveItem[] = rows.map((m) => {
    const kind = (["photo", "document", "story"].includes(m.kind) ? m.kind : "photo") as Kind;
    const pending = m.status === "pending";
    return {
      id: m.id,
      kind,
      title: m.title || m.file_name || t.archive.kind[kind],
      description: m.description,
      place: m.place,
      year: m.taken_year,
      yearQualifier: (m.year_qualifier ?? "exact") as ArchiveItem["yearQualifier"],
      yearTo: m.year_to,
      dateLabel: periodLabel(t, m.taken_year, m.year_qualifier, m.year_to),
      folderId: m.folder_id,
      people: ((m.media_persons as { person_id: string }[] | null) ?? []).map((r) => r.person_id),
      uploader: uploaders.get(m.uploader_id as string) ?? "",
      createdAt: m.created_at,
      url: m.storage_path ? urls.get(m.storage_path) : undefined,
      pdf: m.mime_type === "application/pdf" || /\.pdf$/i.test(m.storage_path ?? ""),
      pending,
      canEdit: isEditor || (pending && m.uploader_id === user.id),
      canDelete: isEditor,
    };
  });

  const folders = ((folderRows.data ?? []) as FolderRow[]).map((f) => ({ id: f.id, preset: f.preset, name: folderLabel(t, f) }));
  const personOptions = people.map((p) => ({
    id: p.id,
    name: fullName(p),
    years: p.birth_year || p.death_year ? `${p.birth_year ?? "?"} – ${p.is_living ? "" : (p.death_year ?? "?")}`.trim() : "",
  }));

  const a = t.archive;
  const labels = {
    ...Object.fromEntries(Object.entries(a).filter(([, v]) => typeof v === "string")),
    kind: a.kind,
    pending: t.app.pending,
    approvalNote: t.app.approvalNote,
    yearError: t.app.errorYear,
  } as unknown as Record<string, string> & { kind: Record<Kind, string> };

  return (
    <div>
      <h1 className={cls.h1}>{a.title}</h1>
      <p className="mb-6 mt-1 text-[1.1rem] text-ink-muted">{a.lead}</p>
      <ArchiveLibrary
        items={items}
        folders={folders}
        people={personOptions}
        workspaceId={current.id}
        locale={locale}
        canAdd={can.add(current.role)}
        canManageFolders={isEditor}
        needsApproval={can.needsApproval(current.role)}
        initialItem={items.some((i) => i.id === itemParam) ? itemParam : null}
        t={labels}
      />
    </div>
  );
}
