"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Portrait } from "@/components/Portrait";
import { cls } from "@/components/ui";
import { IconCheck, IconImage, IconLink, IconMembers, IconSearch } from "@/components/icons";
import { isImage, uploadPhoto } from "@/lib/upload";
import { addPersonFromPanel, type AddState } from "./add-actions";

export type AddOption = {
  id: string;
  name: string;
  given: string;
  surname: string | null;
  years: string;
  portrait?: string;
  parents: number;
  hasFather: boolean;
  hasMother: boolean;
  partners: { id: string; name: string }[];
};

type Kind = "father" | "mother" | "child" | "partner";
const KINDS: Kind[] = ["father", "mother", "child", "partner"];
type L = Record<string, string>;

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const prefixLen = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/** People with the same first name and a surname of the same family ("Jankauskas" ~ "Jankauskienė"). */
function lookAlikes(people: AddOption[], given: string, surname: string) {
  const g = fold(given);
  const s = fold(surname);
  if (g.length < 2) return [];
  return people
    .filter((p) => {
      const pg = fold(p.given).split(/\s+/)[0] ?? "";
      const givenOk = pg === g.split(/\s+/)[0] || (g.length >= 3 && pg.startsWith(g));
      if (!givenOk) return false;
      if (!s) return pg === g.split(/\s+/)[0];
      const ps = fold(p.surname ?? "");
      if (!ps) return false;
      return prefixLen(ps, s) >= Math.min(6, ps.length, s.length);
    })
    .slice(0, 3);
}

/* ---------- Opens from ?add=… on the people list or the tree ---------- */

export function AddPersonHost({
  people,
  workspaceId,
  needsApproval,
  after,
  t,
  errors,
}: {
  people: AddOption[];
  workspaceId: string;
  needsApproval: boolean;
  /** "people": highlight the new person in the list; "tree": stay on the tree. */
  after: "people" | "tree";
  t: L;
  errors: L;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [toast, setToast] = useState<{ id: string; name: string; linked: boolean } | null>(null);
  const kind = params.get("add");
  const to = params.get("to");
  const open = kind !== null;

  const close = (added?: AddState) => {
    const q = new URLSearchParams(params.toString());
    q.delete("add");
    q.delete("to");
    q.delete("new");
    if (added?.id && after === "people") q.set("new", added.id);
    const s = q.toString();
    router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
    if (added?.id && added.name) setToast({ id: added.id, name: added.name, linked: !!added.linked });
  };

  return (
    <>
      {open && (
        <AddPersonPanel
          key={`${kind}-${to}`}
          people={people}
          workspaceId={workspaceId}
          needsApproval={needsApproval}
          initialAnchor={to && people.some((p) => p.id === to) ? to : null}
          initialKind={KINDS.includes(kind as Kind) ? (kind as Kind) : null}
          locale={pathname.split("/")[1] ?? "lt"}
          onClose={close}
          t={t}
          errors={errors}
        />
      )}
      {toast && !open && (
        <div role="status" className="fixed bottom-5 left-1/2 z-40 flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-5 py-3.5 text-surface shadow-[var(--shadow-float)]">
          <IconCheck size={20} />
          <span className="min-w-0 flex-1">{(toast.linked ? t.linked : t.added).replace("{name}", toast.name)}</span>
          <Link href={`/${pathname.split("/")[1]}/app/people/${toast.id}`} className="shrink-0 font-semibold underline underline-offset-2">
            {t.openProfile}
          </Link>
          <button type="button" onClick={() => setToast(null)} aria-label={t.dismiss} className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-surface/10">
            ×
          </button>
        </div>
      )}
    </>
  );
}

/* ---------- Search a person (relation target, or someone already in the tree) ---------- */

function PersonSearch({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabledNote,
  t,
}: {
  id: string;
  options: AddOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  disabledNote?: (o: AddOption) => string | null;
  t: L;
}) {
  const [q, setQ] = useState("");
  const chosen = options.find((o) => o.id === value);
  const shown = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return options.slice(0, 6);
    return options.filter((o) => terms.every((term) => fold(o.name).includes(term))).slice(0, 6);
  }, [options, q]);

  if (chosen) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-sage-deep bg-sage-wash/50 px-3 py-2.5">
        <Portrait given={chosen.given} surname={chosen.surname} src={chosen.portrait} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{chosen.name}</span>
          {chosen.years && <span className="block text-[0.92rem] text-ink-muted">{chosen.years}</span>}
        </span>
        <button type="button" onClick={() => onChange(null)} className={cls.quiet}>
          {t.change}
        </button>
      </div>
    );
  }
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
          <IconSearch size={20} />
        </span>
        <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className={`${cls.input} pl-12`} autoComplete="off" />
      </div>
      <ul className="mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1">
        {shown.length === 0 && <li className="px-3 py-3 text-ink-muted">{t.noResults}</li>}
        {shown.map((o) => {
          const note = disabledNote?.(o) ?? null;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={!!note}
                onClick={() => onChange(o.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Portrait given={o.given} surname={o.surname} src={o.portrait} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{o.name}</span>
                  <span className="block text-[0.9rem] text-ink-muted">{note ?? o.years}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- The panel ---------- */

function AddPersonPanel({
  people,
  workspaceId,
  needsApproval,
  initialAnchor,
  initialKind,
  locale,
  onClose,
  t,
  errors,
}: {
  people: AddOption[];
  workspaceId: string;
  needsApproval: boolean;
  initialAnchor: string | null;
  initialKind: Kind | null;
  locale: string;
  onClose: (added?: AddState) => void;
  t: L;
  errors: L;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const another = useRef(false);
  const [tab, setTab] = useState<"main" | "more">("main");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existing, setExisting] = useState<string | null>(null);
  const [given, setGiven] = useState("");
  const [surname, setSurname] = useState("");
  const [living, setLiving] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(initialAnchor);
  const [kind, setKind] = useState<Kind | null>(initialKind);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [photo, setPhoto] = useState<{ url: string; file: File } | null>(null);
  const [addedNote, setAddedNote] = useState<string | null>(null);

  const anchorP = people.find((p) => p.id === anchor) ?? null;
  const existingP = people.find((p) => p.id === existing) ?? null;
  const suggestions = mode === "new" ? lookAlikes(people, given, surname).filter((p) => !dismissed.includes(p.id) && p.id !== anchor) : [];

  const kindNote = (k: Kind) => {
    if (!anchorP) return null;
    if ((k === "father" || k === "mother") && anchorP.parents >= 2) return t.twoParents;
    if (k === "father" && anchorP.hasFather) return t.hasFather;
    if (k === "mother" && anchorP.hasMother) return t.hasMother;
    return null;
  };
  const effectiveKind = kind && !kindNote(kind) ? kind : null;

  const resetForAnother = () => {
    formRef.current?.reset();
    setGiven("");
    setSurname("");
    setLiving(false);
    setMode("new");
    setExisting(null);
    setDismissed([]);
    setTab("main");
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  };

  const [state, dispatch, pending] = useActionState(async (prev: AddState, form: FormData): Promise<AddState> => {
    const file = form.get("photoFile");
    form.delete("photoFile");
    if (file instanceof File && file.size > 0 && mode === "new") {
      try {
        const up = await uploadPhoto(workspaceId, file);
        form.set("photo", JSON.stringify(up));
      } catch {
        return { error: "photo" };
      }
    }
    const result = await addPersonFromPanel(prev, form);
    if (result.ok) {
      if (another.current) {
        setAddedNote((result.linked ? t.linked : t.added).replace("{name}", result.name ?? ""));
        resetForAnother();
      } else {
        onClose(result);
      }
    }
    return result;
  }, {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => dispatch(form));
  };

  const summaryName = mode === "existing" ? (existingP?.name ?? "") : [given, surname].filter(Boolean).join(" ") || t.newPersonName;
  const err = state.error ? (errors[state.error] ?? errors.save) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end lg:left-auto" role="dialog" aria-modal="true" aria-labelledby="add-title">
      <button type="button" aria-label={t.close} onClick={() => onClose()} className="fixed inset-0 -z-10 cursor-default bg-ink/15 lg:bg-ink/5" tabIndex={-1} />
      <form
        ref={formRef}
        onSubmit={submit}
        className="flex h-dvh w-full flex-col bg-surface shadow-[var(--shadow-float)] lg:w-[31rem] lg:border-l lg:border-line"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="existingId" value={existing ?? ""} />
        <input type="hidden" name="relTo" value={anchor ?? ""} />
        <input type="hidden" name="relKind" value={anchor ? (effectiveKind ?? "") : ""} />
        <input type="hidden" name="living" value={living ? "yes" : "no"} />

        <header className="flex items-start gap-3 px-5 pb-3 pt-5 sm:px-7 sm:pt-7">
          <div className="min-w-0 flex-1">
            <h2 id="add-title" className="text-[1.7rem] leading-tight">
              {t.title}
            </h2>
            <p className="mt-1 text-ink-muted">{t.lead}</p>
          </div>
          <button type="button" onClick={() => onClose()} aria-label={t.close} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.6rem] leading-none text-ink-muted hover:bg-linen hover:text-ink">
            ×
          </button>
        </header>

        {mode === "new" && (
          <div className="flex gap-1 border-b border-line px-5 sm:px-7" role="tablist">
            {(["main", "more"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`-mb-px flex min-h-12 items-center gap-2 border-b-2 px-2 text-[0.98rem] sm:px-3 ${
                  tab === k ? "border-sage-deep font-semibold text-sage-deep" : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {k === "main" ? <IconMembers size={18} /> : <IconImage size={18} />}
                {k === "main" ? t.tabMain : t.tabMore}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {addedNote && (
            <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-sage-wash px-4 py-3 font-semibold text-sage-deep">
              <IconCheck size={18} />
              {addedNote}
            </p>
          )}

          {/* ----- Main ----- */}
          <div hidden={mode === "new" && tab !== "main"} className="space-y-6">
            {mode === "existing" ? (
              <section>
                <p className="font-semibold">{t.existingTitle}</p>
                <p className="mb-3 text-[0.95rem] text-ink-muted">{t.existingLead}</p>
                <PersonSearch id="add-existing" options={people.filter((p) => p.id !== anchor)} value={existing} onChange={setExisting} placeholder={t.linkToPh} t={t} />
                <button
                  type="button"
                  onClick={() => {
                    setMode("new");
                    setExisting(null);
                  }}
                  className={`${cls.quiet} mt-2 -ml-3`}
                >
                  {t.notThis}
                </button>
              </section>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="add-given" className={cls.label}>
                      {t.given} <span className="text-danger">*</span>
                    </label>
                    <input id="add-given" name="givenNames" required maxLength={200} value={given} onChange={(e) => setGiven(e.target.value)} placeholder={t.givenPh} className={cls.input} autoFocus autoComplete="off" />
                  </div>
                  <div>
                    <label htmlFor="add-surname" className={cls.label}>
                      {t.surname}
                    </label>
                    <input id="add-surname" name="surname" maxLength={200} value={surname} onChange={(e) => setSurname(e.target.value)} placeholder={t.surnamePh} className={cls.input} autoComplete="off" />
                  </div>
                </div>

                {suggestions.length > 0 && (
                  <section className="rounded-xl border border-[#e2cfa5] bg-[#faf3e3] p-4" aria-live="polite">
                    <p className="mb-2 font-semibold text-[#6d5434]">{t.maybeTitle}</p>
                    <ul className="space-y-2">
                      {suggestions.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3 py-2">
                          <Portrait given={p.given} surname={p.surname} src={p.portrait} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{p.name}</span>
                            {p.years && <span className="block text-[0.9rem] text-ink-muted">{p.years}</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setMode("existing");
                              setExisting(p.id);
                            }}
                            className={cls.secondary}
                          >
                            {t.maybeYes}
                          </button>
                          <button type="button" aria-label={t.close} onClick={() => setDismissed((d) => [...d, p.id])} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-linen">
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <fieldset>
                  <legend className={cls.label}>{t.status}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        aria-pressed={living === v}
                        onClick={() => setLiving(v)}
                        className={`flex min-h-13 items-center justify-center gap-2 rounded-xl border text-[1.05rem] ${
                          living === v ? "border-sage-deep bg-sage-wash/70 font-semibold text-sage-deep" : "border-line bg-surface hover:border-ink-muted"
                        }`}
                      >
                        <span aria-hidden="true">{v ? "♥" : "✢"}</span>
                        {v ? t.living : t.deceased}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-[1.05rem] font-semibold">{t.dates}</legend>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="add-born" className="mb-1.5 block text-[0.98rem]">
                        {t.birthYear}
                      </label>
                      <input id="add-born" name="birthYear" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder={t.birthPh} className={cls.input} />
                    </div>
                    {!living && (
                      <div>
                        <label htmlFor="add-died" className="mb-1.5 block text-[0.98rem]">
                          {t.deathYear}
                        </label>
                        <input id="add-died" name="deathYear" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder={t.deathPh} className={cls.input} />
                      </div>
                    )}
                  </div>
                </fieldset>

                <button
                  type="button"
                  onClick={() => {
                    setMode("existing");
                    setExisting(null);
                  }}
                  className="text-[0.98rem] font-semibold text-sage-deep underline-offset-2 hover:underline"
                >
                  {t.pickExisting}
                </button>
              </>
            )}

            <section className="border-t border-line pt-5">
              <h3 className="mb-3 flex items-center gap-2 text-[1.15rem]">
                <IconLink size={20} />
                {t.family}
              </h3>
              {mode === "existing" && (!anchor || !effectiveKind) && <p className="mb-3 text-[0.95rem] text-ink-muted">{t.existingNeedsLink}</p>}
              <label htmlFor="add-anchor" className="mb-1.5 block font-semibold">
                {t.linkTo}
              </label>
              <PersonSearch
                id="add-anchor"
                options={people.filter((p) => p.id !== existing)}
                value={anchor}
                onChange={(v) => setAnchor(v)}
                placeholder={t.linkToPh}
                t={t}
              />
              {anchorP && (
                <>
                  <p className="mb-2 mt-4 font-semibold">{t.kindQuestion}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {KINDS.map((k) => {
                      const note = kindNote(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          disabled={!!note}
                          title={note ?? undefined}
                          aria-pressed={kind === k}
                          onClick={() => setKind(k)}
                          className={`min-h-12 rounded-xl border px-2 text-[1rem] disabled:cursor-not-allowed disabled:opacity-40 ${
                            kind === k && !note ? "border-sage-deep bg-sage-wash/70 font-semibold text-sage-deep" : "border-line bg-surface hover:border-ink-muted"
                          }`}
                        >
                          {t[`kind_${k}`]}
                        </button>
                      );
                    })}
                  </div>
                  {effectiveKind === "child" && anchorP.partners.length > 0 && (
                    <div className="mt-3">
                      <label htmlFor="add-other-parent" className="mb-1.5 block text-[0.98rem]">
                        {t.otherParent}
                      </label>
                      <select id="add-other-parent" name="otherParent" defaultValue={anchorP.partners[0].id} className={cls.input}>
                        {anchorP.partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                        <option value="">{t.noOtherParent}</option>
                      </select>
                    </div>
                  )}
                  {effectiveKind && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-paper px-3 py-2.5 text-[0.98rem]">
                      <IconLink size={18} />
                      <span>
                        {t.summary
                          .replace("{anchor}", anchorP.name)
                          .replace("{kind}", t[`kind_${effectiveKind}`].toLowerCase())
                          .replace("{name}", summaryName)}
                      </span>
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          {/* ----- More ----- */}
          {mode === "new" && (
            <div hidden={tab !== "more"} className="space-y-5">
              <div>
                <label htmlFor="add-birth-surname" className={cls.label}>
                  {t.birthSurname}
                </label>
                <input id="add-birth-surname" name="birthSurname" maxLength={200} className={cls.input} />
              </div>
              {effectiveKind !== "father" && effectiveKind !== "mother" && (
                <fieldset>
                  <legend className={cls.label}>{t.sex}</legend>
                  <div className="flex flex-wrap gap-2">
                    {(["female", "male", "unknown"] as const).map((s) => (
                      <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 has-[:checked]:border-sage-deep has-[:checked]:bg-sage-wash/60">
                        <input type="radio" name="sex" value={s} defaultChecked={s === "unknown"} className="accent-[var(--color-sage-deep)]" />
                        {t[s]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="add-birth-place" className={cls.label}>
                    {t.birthPlace}
                  </label>
                  <input id="add-birth-place" name="birthPlace" maxLength={200} className={cls.input} />
                </div>
                {!living && (
                  <div>
                    <label htmlFor="add-death-place" className={cls.label}>
                      {t.deathPlace}
                    </label>
                    <input id="add-death-place" name="deathPlace" maxLength={200} className={cls.input} />
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="add-bio" className={cls.label}>
                  {t.biography}
                </label>
                <textarea id="add-bio" name="biography" rows={4} maxLength={20000} placeholder={t.biographyPh} className={cls.textarea} />
              </div>
              <div>
                <p className={cls.label}>{t.photo}</p>
                <div className="flex items-center gap-4">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local preview
                    <img src={photo.url} alt="" className="h-24 w-20 rounded-[50%] object-cover ring-1 ring-line" />
                  ) : (
                    <span className="flex h-24 w-20 items-center justify-center rounded-[50%] border border-dashed border-line text-ink-muted">
                      <IconImage size={24} />
                    </span>
                  )}
                  <div className="flex flex-col items-start gap-1">
                    <label className={`${cls.secondary} cursor-pointer`}>
                      {t.photoPick}
                      <input
                        type="file"
                        name="photoFile"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (photo) URL.revokeObjectURL(photo.url);
                          setPhoto(f && isImage(f) ? { url: URL.createObjectURL(f), file: f } : null);
                        }}
                      />
                    </label>
                    {photo && (
                      <button
                        type="button"
                        className={cls.quiet}
                        onClick={() => {
                          URL.revokeObjectURL(photo.url);
                          setPhoto(null);
                          const input = formRef.current?.querySelector<HTMLInputElement>('input[name="photoFile"]');
                          if (input) input.value = "";
                        }}
                      >
                        {t.photoRemove}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
          {err && (
            <p role="alert" className="mb-3 text-danger">
              {err}
            </p>
          )}
          {needsApproval && mode === "new" && <p className="mb-3 text-[0.95rem] text-ink-muted">{t.approval}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onClose()} className={cls.secondary}>
              {t.cancel}
            </button>
            <button type="submit" disabled={pending} onClick={() => (another.current = true)} className={cls.secondary}>
              {t.addAnother}
            </button>
            <button
              type="submit"
              disabled={pending || (mode === "existing" && (!existing || !anchor || !effectiveKind))}
              onClick={() => (another.current = false)}
              className={`${cls.primary} ml-auto flex-1 sm:flex-none`}
            >
              {pending ? t.saving : mode === "existing" ? t.submitLink : t.submit}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
