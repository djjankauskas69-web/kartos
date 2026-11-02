"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Portrait } from "@/components/Portrait";
import { cls } from "@/components/ui";
import { IconCheck, IconImage, IconLink, IconSearch } from "@/components/icons";
import { isImage, uploadPhoto } from "@/lib/upload";
import { addPersonFromPanel, type AddState } from "./add-actions";

export type AddOption = {
  id: string;
  name: string;
  given: string;
  surname: string | null;
  years: string;
  portrait?: string;
  sex: "female" | "male" | "unknown" | null;
  born: number | null;
  parents: number;
  hasFather: boolean;
  hasMother: boolean;
  partners: { id: string; name: string }[];
};

/** What the new person is to the chosen one. The sex comes with the choice. */
type Kind = "father" | "mother" | "son" | "daughter" | "husband" | "wife" | "brother" | "sister";
const KINDS: Kind[] = ["father", "mother", "son", "daughter", "husband", "wife", "brother", "sister"];

/**
 * Lithuanian surname for the new relative, from the chosen person's surname:
 * Jankauskas → sūnus Jankauskas, dukra Jankauskaitė, žmona/mama Jankauskienė.
 */
function surnameFor(base: string | null, kind: Kind): string {
  if (!base) return "";
  const s = base.trim();
  // Back to the man's form first.
  let m = s;
  if (/ienė$/.test(s)) m = s.replace(/ienė$/, "as");
  else if (/aitė$/.test(s)) m = s.replace(/aitė$/, "as");
  else if (/ytė$/.test(s)) m = s.replace(/ytė$/, "is");
  else if (/[uū]tė$/.test(s)) m = s.replace(/[uū]tė$/, "us");
  const female = kind === "mother" || kind === "wife" || kind === "daughter" || kind === "sister";
  if (!female) return m;
  if (/(ė|a)$/.test(m)) return m; // already a woman's form or a non-Lithuanian surname
  const married = kind === "mother" || kind === "wife";
  if (married) return m.replace(/(as|is|ys|us)$/, "ienė");
  if (/as$/.test(m)) return m.replace(/as$/, "aitė");
  if (/(is|ys)$/.test(m)) return m.replace(/(is|ys)$/, "ytė");
  if (/us$/.test(m)) return m.replace(/us$/, "ūtė");
  return m;
}
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

/** ?add=son etc. as is; the tree's general "child" leaves son/daughter open, "partner" follows the sex. */
function initialKindFor(kind: string | null, anchor?: AddOption): Kind | null {
  if (KINDS.includes(kind as Kind)) return kind as Kind;
  if (kind === "partner") return anchor?.sex === "female" ? "husband" : anchor?.sex === "male" ? "wife" : null;
  return null;
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
          initialKind={initialKindFor(kind, people.find((p) => p.id === to))}
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

/* ---------- The panel: whose relative → who → about them ---------- */

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
  const first = people.length === 0;
  const [anchor, setAnchor] = useState<string | null>(initialAnchor);
  const [kind, setKind] = useState<Kind | null>(initialKind);
  const [existing, setExisting] = useState<string | null>(null);
  const [given, setGiven] = useState("");
  const [surname, setSurname] = useState("");
  const [surnameTouched, setSurnameTouched] = useState(false);
  const [living, setLiving] = useState(true);
  const [more, setMore] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [photo, setPhoto] = useState<{ url: string; file: File } | null>(null);
  // Opened from a card's + menu: person and relationship are already known, so steps 1–2 fold into one line.
  const [locked, setLocked] = useState(!!initialAnchor && !!initialKind);

  const anchorP = people.find((p) => p.id === anchor) ?? null;
  const existingP = people.find((p) => p.id === existing) ?? null;

  const kindNote = (k: Kind) => {
    if (!anchorP) return null;
    if ((k === "father" || k === "mother") && anchorP.parents >= 2) return t.twoParents;
    if (k === "father" && anchorP.hasFather) return t.hasFather;
    if (k === "mother" && anchorP.hasMother) return t.hasMother;
    if ((k === "brother" || k === "sister") && anchorP.parents === 0) return t.noParentsNote;
    return null;
  };
  const effectiveKind = kind && !kindNote(kind) ? kind : null;
  const shownSurname = surnameTouched ? surname : effectiveKind && anchorP ? surnameFor(anchorP.surname, effectiveKind) : surname;
  const suggestions = existing ? [] : lookAlikes(people, given, shownSurname).filter((p) => !dismissed.includes(p.id) && p.id !== anchor);

  const [state, dispatch, pending] = useActionState(async (prev: AddState, form: FormData): Promise<AddState> => {
    const file = form.get("photoFile");
    form.delete("photoFile");
    if (file instanceof File && file.size > 0 && !existing) {
      try {
        form.set("photo", JSON.stringify(await uploadPhoto(workspaceId, file)));
      } catch {
        return { error: "photo" };
      }
    }
    const result = await addPersonFromPanel(prev, form);
    if (result.ok) onClose(result);
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

  const err = state.error ? (errors[state.error] ?? errors.save) : null;
  const ready = first || (anchorP && effectiveKind);
  const newName = existingP ? existingP.name : [given, shownSurname].filter(Boolean).join(" ");
  const step = (n: number, title: string, done: boolean) => (
    <h3 className="mb-3 flex items-center gap-3 text-[1.12rem] font-semibold">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.9rem] ${done ? "bg-ink text-white" : "border border-line text-ink-muted"}`}>{done ? <IconCheck size={15} /> : n}</span>
      {title}
    </h3>
  );
  const tile = (on: boolean) => `min-h-12 rounded-xl border px-2 text-[1rem] disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-ink bg-ink font-semibold text-white" : "border-line bg-surface hover:border-ink/40"}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end lg:left-auto" role="dialog" aria-modal="true" aria-labelledby="add-title">
      <button type="button" aria-label={t.close} onClick={() => onClose()} className="fixed inset-0 -z-10 cursor-default bg-ink/15 lg:bg-ink/5" tabIndex={-1} />
      <form ref={formRef} onSubmit={submit} className="flex h-dvh w-full flex-col bg-surface shadow-[var(--shadow-float)] lg:w-[31rem] lg:border-l lg:border-line">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="mode" value={existing ? "existing" : "new"} />
        <input type="hidden" name="existingId" value={existing ?? ""} />
        <input type="hidden" name="relTo" value={anchor ?? ""} />
        <input type="hidden" name="relKind" value={anchor ? (effectiveKind ?? "") : ""} />
        <input type="hidden" name="living" value={living ? "yes" : "no"} />

        <header className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
          <h2 id="add-title" className="min-w-0 flex-1 text-[1.7rem] font-semibold leading-tight">
            {t.title}
          </h2>
          <button type="button" onClick={() => onClose()} aria-label={t.close} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.6rem] leading-none text-ink-muted hover:bg-linen hover:text-ink">
            ×
          </button>
        </header>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
          {first ? (
            <p className="rounded-xl bg-linen px-4 py-3">{t.firstPerson}</p>
          ) : locked && anchorP && effectiveKind ? (
            <section className="rounded-xl border border-line bg-paper px-4 py-3">
              <p className="mb-2 text-[0.88rem] text-ink-muted">{t.addingFor}</p>
              <div className="flex items-center gap-3">
                <Portrait given={anchorP.given} surname={anchorP.surname} src={anchorP.portrait} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{anchorP.name}</span>
                  <span className="mt-0.5 inline-flex rounded-full bg-ink px-2.5 py-0.5 text-[0.88rem] font-semibold text-white">{t[`k_${effectiveKind}`]}</span>
                </span>
                <button type="button" onClick={() => setLocked(false)} className={cls.quiet}>
                  {t.change}
                </button>
              </div>
              {(effectiveKind === "son" || effectiveKind === "daughter") && anchorP.partners.length > 0 && (
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
            </section>
          ) : (
            <>
              <section>
                {step(1, t.step1, !!anchorP)}
                <PersonSearch id="add-anchor" options={people.filter((p) => p.id !== existing)} value={anchor} onChange={setAnchor} placeholder={t.step1Ph} t={t} />
              </section>

              <section inert={!anchorP} className={anchorP ? "" : "opacity-40"}>
                {step(2, t.step2, !!effectiveKind)}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {KINDS.map((k) => {
                    const note = kindNote(k);
                    return (
                      <button key={k} type="button" disabled={!!note} title={note ?? undefined} aria-pressed={kind === k} onClick={() => setKind(k)} className={tile(kind === k && !note)}>
                        {t[`k_${k}`]}
                      </button>
                    );
                  })}
                </div>
                {anchorP && kind && kindNote(kind) && <p className="mt-2 text-[0.92rem] text-ink-muted">{t[`k_${kind}`]}: {kindNote(kind)}</p>}
                {(effectiveKind === "son" || effectiveKind === "daughter") && anchorP && anchorP.partners.length > 0 && (
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
              </section>
            </>
          )}

          <section inert={!ready} className={ready ? "" : "opacity-40"}>
            {!first && !locked && step(3, t.step3, !!(existingP || given.trim()))}
            {existingP ? (
              <div className="flex items-center gap-3 rounded-xl border border-ink px-3 py-2.5">
                <Portrait given={existingP.given} surname={existingP.surname} src={existingP.portrait} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{existingP.name}</span>
                  <span className="block text-[0.9rem] text-ink-muted">{t.existingLead}</span>
                </span>
                <button type="button" onClick={() => setExisting(null)} className={cls.quiet}>
                  {t.notThis}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="add-given" className={cls.label}>
                      {t.given}
                    </label>
                    <input id="add-given" name="givenNames" required maxLength={200} value={given} onChange={(e) => setGiven(e.target.value)} placeholder={t.givenPh} className={cls.input} autoComplete="off" />
                  </div>
                  <div>
                    <label htmlFor="add-surname" className={cls.label}>
                      {t.surname}
                    </label>
                    <input
                      id="add-surname"
                      name="surname"
                      maxLength={200}
                      value={shownSurname}
                      onChange={(e) => {
                        setSurnameTouched(true);
                        setSurname(e.target.value);
                      }}
                      placeholder={t.surnamePh}
                      className={cls.input}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {suggestions.length > 0 && (
                  <section className="rounded-xl border border-line bg-linen/70 p-4" aria-live="polite">
                    <p className="mb-2 font-semibold">{t.maybeTitle}</p>
                    <ul className="space-y-2">
                      {suggestions.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3 py-2">
                          <Portrait given={p.given} surname={p.surname} src={p.portrait} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{p.name}</span>
                            {p.years && <span className="block text-[0.9rem] text-ink-muted">{p.years}</span>}
                          </span>
                          <button type="button" onClick={() => setExisting(p.id)} className={cls.secondary}>
                            {t.useExisting}
                          </button>
                          <button type="button" aria-label={t.close} onClick={() => setDismissed((d) => [...d, p.id])} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-linen">
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" aria-pressed={living === v} onClick={() => setLiving(v)} className={tile(living === v)}>
                      {v ? t.living : t.deceased}
                    </button>
                  ))}
                </div>
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
                {first && (
                  <fieldset>
                    <legend className={cls.label}>{t.sex}</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(["female", "male"] as const).map((sx) => (
                        <label key={sx} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                          <input type="radio" name="sex" value={sx} className="sr-only" />
                          {t[sx]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                <div className="rounded-xl border border-line">
                  <button type="button" aria-expanded={more} onClick={() => setMore((v) => !v)} className="flex min-h-12 w-full items-center gap-2 px-4 text-left">
                    <span className="font-semibold">{t.more}</span>
                    <span className="text-[0.92rem] text-ink-muted">· {t.moreHint}</span>
                    <span aria-hidden="true" className={`ml-auto text-ink-muted transition-transform ${more ? "rotate-180" : ""}`}>⌄</span>
                  </button>
                  <div hidden={!more} className="space-y-4 border-t border-line p-4">
                    <div>
                      <label htmlFor="add-birth-surname" className={cls.label}>
                        {t.birthSurname}
                      </label>
                      <input id="add-birth-surname" name="birthSurname" maxLength={200} className={cls.input} />
                    </div>
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
                      <textarea id="add-bio" name="biography" rows={3} maxLength={20000} placeholder={t.biographyPh} className={cls.textarea} />
                    </div>
                    <div className="flex items-center gap-4">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local preview
                        <img src={photo.url} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-line" />
                      ) : (
                        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-line text-ink-muted">
                          <IconImage size={22} />
                        </span>
                      )}
                      <label className={`${cls.secondary} cursor-pointer`}>
                        {photo ? t.photoRemove : t.photoPick}
                        <input
                          type="file"
                          name="photoFile"
                          accept="image/*"
                          className="sr-only"
                          onClick={(e) => {
                            if (photo) {
                              e.preventDefault();
                              URL.revokeObjectURL(photo.url);
                              setPhoto(null);
                              (e.currentTarget as HTMLInputElement).value = "";
                            }
                          }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            setPhoto(f && isImage(f) ? { url: URL.createObjectURL(f), file: f } : null);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
          {ready && newName && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-linen px-4 py-3">
              <IconLink size={18} />
              <p className="min-w-0 text-[0.98rem] leading-snug">
                <span className="text-ink-muted">{existingP ? t.summaryLink : t.summaryLabel}: </span>
                <strong className="font-semibold">{newName}</strong>
                {anchorP && effectiveKind && (
                  <span className="text-ink-muted">
                    {" "}
                    – {t[`k_${effectiveKind}`].toLowerCase()} · {anchorP.name}
                  </span>
                )}
              </p>
            </div>
          )}
          {err && (
            <p role="alert" className="mb-3 text-danger">
              {err}
            </p>
          )}
          {needsApproval && !existing && <p className="mb-3 text-[0.95rem] text-ink-muted">{t.approval}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onClose()} className={cls.secondary}>
              {t.cancel}
            </button>
            <button type="submit" disabled={pending || !ready || (!existing && !given.trim())} className={`${cls.primary} ml-auto flex-1 sm:flex-none`}>
              {pending ? t.saving : existing ? t.submitLink : t.submit}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
