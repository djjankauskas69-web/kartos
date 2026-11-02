# Kartos — šeimos atminties platforma

Darbinis pavadinimas „Kartos“ (lengvai keičiamas: `src/components/Wordmark.tsx` ir `src/dictionaries/*.json`).

## Kas jau padaryta

- Next.js 16 + TypeScript + Tailwind CSS 4
- Dvi kalbos: **lietuvių** (`/lt`, numatytoji) ir **anglų** (`/en`)
  - `/` nukreipia pagal išsaugotą pasirinkimą arba naršyklės kalbą
  - LT | EN jungiklis išlaiko tą patį puslapį ir įsimena pasirinkimą
  - Visi tekstai: `src/dictionaries/lt.json` ir `en.json`
- Pradinis puslapis (landing) abiem kalbomis
- Prisijungimo puslapis: nuoroda el. paštu ir „Tęsti su Google“ (Supabase)
- Duomenų bazės schema su privatumo taisyklėmis (Row Level Security): `supabase/migrations/0001_init.sql`
- Archyvo vidus (`/lt/app`): žmonės, giminės medis, kapų žemėlapis, nariai, tvirtinimas
  - Vaidmenys: Administratorius (tvirtina), Redaktorius (matoma iš karto), Narys (laukia patvirtinimo), Peržiūros teisė
  - Kvietimai nuoroda, nuotraukos (privačios), prisiminimai, kapo vieta su GPS ir žemėlapiu
  - Taisyklės ir tvirtinimas: `supabase/migrations/0002_roles_approval.sql`
  - Archyvas kaip šeimos biblioteka (aplankai, dokumentai, istorijos): `supabase/migrations/0003_library.sql`
  - Šeimos nariai: filtrai, ⋮ meniu (teisės, perdavimas, šalinimas), kvietimo nuoroda vienu mygtuku; paskutinis prisijungimas: `supabase/migrations/0004_member_activity.sql`

## Duomenų bazės atnaujinimai

Kiekvieną `supabase/migrations/` failą paleiskite **vieną kartą, iš eilės**: Supabase → SQL Editor → New query → įklijuoti → Run.

## Paleidimas

```bash
npm install
npm run dev
```

Atidarykite http://localhost:3000 — būsite nukreipti į `/lt`.

## Prisijungimo įjungimas (Supabase)

1. Sukurkite projektą supabase.com, regionas **EU (Frankfurt)**.
2. SQL Editor → įklijuokite ir paleiskite `supabase/migrations/0001_init.sql`.
3. Authentication → URL Configuration → Redirect URLs pridėkite:
   `http://localhost:3000/lt/auth/callback`, `http://localhost:3000/en/auth/callback`
4. (Nebūtina) Authentication → Providers → Google.
5. Nukopijuokite `.env.example` į `.env.local` ir įrašykite URL bei anon raktą.

## Kalbos pridėjimas vėliau

1. `src/i18n/config.ts` → pridėkite kodą į `locales`.
2. Sukurkite `src/dictionaries/<kodas>.json` (kopija iš `en.json`) ir įtraukite į `src/i18n/dictionaries.ts`.
3. Atnaujinkite kalbų sąrašą `LanguageSwitch.tsx` reguliariojoje išraiškoje (`lt|en`). `proxy.ts` keisti nereikia.

## Struktūra

```
src/
  app/[lang]/            puslapiai (layout, landing, login, auth/callback)
  components/            antraštė, kalbos jungiklis, hero kompozicija
  dictionaries/          lt.json, en.json
  i18n/                  kalbų konfigūracija ir žodynų įkėlimas
  lib/supabase/          Supabase klientai (naršyklė / serveris)
  proxy.ts               kalbos nukreipimas
supabase/migrations/     duomenų bazės schema
```
