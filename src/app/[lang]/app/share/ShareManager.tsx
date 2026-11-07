"use client";

import { useActionState, useEffect, useState } from "react";
import QRCode from "qrcode";
import { cls, ErrorText } from "@/components/ui";
import { createShareLink, revokeShareLink } from "./actions";

type Link = { id: string; token: string; root: string | null; stories: boolean; photos: boolean; graves: boolean; expires: string | null; off: boolean; views: number; created: string };
type L = Record<string, string>;

const urlFor = (locale: string, token: string) => (typeof window === "undefined" ? "" : `${window.location.origin}/${locale}/m/${token}`);

/** Make a link to look at the tree, see the ones made, copy, show as a QR code, switch off. */
export function ShareManager({ locale, people, links, labels: t }: { locale: string; people: Array<{ id: string; label: string }>; links: Link[]; labels: L }) {
  const [state, action, pending] = useActionState(createShareLink, {});
  const [openNew, setOpenNew] = useState(links.length === 0);
  const active = links.filter((l) => !l.off);
  const old = links.filter((l) => l.off);
  const fresh = state.token ? links.find((l) => l.token === state.token) : undefined;

  return (
    <div className="space-y-5">
      <section className={`p-6 ${cls.card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={cls.h3}>{t.linkTitle}</h2>
            <p className="mt-1 text-[0.95rem] text-ink-muted">{t.linkLead}</p>
          </div>
          {!openNew && (
            <button type="button" onClick={() => setOpenNew(true)} className={cls.primary}>
              + {t.newLink}
            </button>
          )}
        </div>

        {openNew && (
          <form action={action} className="mt-5 space-y-5 border-t border-line pt-5" onSubmit={() => setTimeout(() => setOpenNew(false), 600)}>
            <input type="hidden" name="locale" value={locale} />
            <fieldset>
              <legend className={cls.label}>{t.whatShows}</legend>
              <p className="mb-2 text-[0.92rem] text-ink-muted">{t.alwaysTree}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  ["stories", t.incStories],
                  ["photos", t.incPhotos],
                  ["graves", t.incGraves],
                ].map(([name, label]) => (
                  <label key={name} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-4 has-[:checked]:border-ink has-[:checked]:bg-linen">
                    <input type="checkbox" name={name} defaultChecked className="h-4 w-4 accent-[#1c1d1a]" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sh-root" className={cls.label}>{t.howMuch}</label>
                <select id="sh-root" name="root" defaultValue="" className={cls.input}>
                  <option value="">{t.wholeTree}</option>
                  <optgroup label={t.branchFrom}>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label htmlFor="sh-days" className={cls.label}>{t.validFor}</label>
                <select id="sh-days" name="days" defaultValue="30" className={cls.input}>
                  <option value="7">{t.days7}</option>
                  <option value="30">{t.days30}</option>
                  <option value="0">{t.noLimit}</option>
                </select>
              </div>
            </div>
            <p className="rounded-xl bg-linen px-4 py-3 text-[0.92rem] text-ink-muted">{t.livingNote}</p>
            <ErrorText message={state.error ? (state.error === "setup" ? t.setup : t.error) : null} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={pending} className={cls.primary}>
                {pending ? t.creating : t.create}
              </button>
              {links.length > 0 && (
                <button type="button" onClick={() => setOpenNew(false)} className="rounded-full px-3 py-2 font-semibold text-ink-muted hover:bg-linen hover:text-ink">
                  {t.cancel}
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-[0.95rem] font-semibold text-ink-muted">{t.activeLinks}</h2>
          {active.map((l) => (
            <LinkRow key={l.id} l={l} locale={locale} t={t} highlight={fresh?.id === l.id} />
          ))}
        </section>
      )}
      {old.length > 0 && (
        <details className="px-1">
          <summary className="cursor-pointer text-[0.95rem] font-semibold text-ink-muted hover:text-ink">
            {t.oldLinks} ({old.length})
          </summary>
          <ul className="mt-2 space-y-1.5 text-[0.92rem] text-ink-muted">
            {old.map((l) => (
              <li key={l.id}>
                {l.root ? `${t.branchShort} ${l.root}` : t.wholeTree} · {t.views.replace("{n}", String(l.views))} · {new Date(l.created).toLocaleDateString(locale === "en" ? "en-GB" : "lt-LT")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LinkRow({ l, locale, t, highlight }: { l: Link; locale: string; t: L; highlight: boolean }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  // The address is known only in the browser (the site may be opened under more than one name).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setUrl(urlFor(locale, l.token)), [locale, l.token]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  async function showQr() {
    if (qr) return setQr(null);
    setQr(await QRCode.toDataURL(url, { width: 520, margin: 1, color: { dark: "#1c1d1a", light: "#ffffff" } }));
  }
  const what = [t.treeWord, l.stories && t.incStories.toLowerCase(), l.photos && t.incPhotos.toLowerCase(), l.graves && t.incGraves.toLowerCase()].filter(Boolean).join(", ");
  const until = l.expires ? t.until.replace("{d}", new Date(l.expires).toLocaleDateString(locale === "en" ? "en-GB" : "lt-LT")) : t.noLimit;

  return (
    <div className={`p-5 ${cls.card} ${highlight ? "ring-2 ring-sage" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t.linkTitle} className={`${cls.input} min-w-0 flex-1 !min-h-11 font-mono !text-[0.95rem]`} />
        <button type="button" onClick={copy} className={`${cls.primary} !min-h-11`}>
          {copied ? t.copied : t.copy}
        </button>
        <button type="button" onClick={showQr} aria-expanded={!!qr} className={`${cls.secondary} !min-h-11`}>
          {t.qr}
        </button>
      </div>
      <p className="mt-3 text-[0.92rem] text-ink-muted">
        {l.root ? `${t.branchShort} ${l.root}` : t.wholeTree} · {what} · {until} · {t.views.replace("{n}", String(l.views))}
      </p>
      {qr && (
        <div className="mt-4 flex flex-wrap items-center gap-5 rounded-2xl bg-linen p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated QR code */}
          <img src={qr} alt={t.qrAlt} width={180} height={180} className="rounded-xl bg-white p-2" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.95rem]">{t.qrLead}</p>
            <a href={qr} download={`mykartos-${l.token}.png`} className="mt-2 inline-block font-semibold underline underline-offset-2">
              {t.qrDownload}
            </a>
          </div>
        </div>
      )}
      <div className="mt-3 flex justify-end">
        {confirm ? (
          <form action={revokeShareLink} className="flex flex-wrap items-center justify-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={l.id} />
            <span className="text-[0.92rem]">{t.offQuestion}</span>
            <button type="button" onClick={() => setConfirm(false)} className="min-h-9 rounded-full px-3 text-[0.9rem] font-semibold text-ink-muted hover:bg-linen">
              {t.cancel}
            </button>
            <button type="submit" className="min-h-9 rounded-full bg-danger px-3.5 text-[0.9rem] font-semibold text-white">
              {t.off}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="text-[0.92rem] font-semibold text-ink-muted hover:text-danger">
            {t.off}
          </button>
        )}
      </div>
    </div>
  );
}
