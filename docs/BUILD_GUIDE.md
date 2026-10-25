# FORME: Architecture & End-to-End Build Guide

> Audience: GitHub Copilot (Agent mode) in VS Code, and the developer driving it.
> Version 1.0 | Mobile-first web app | Based on the MVP Developer Handoff v1.0 and the 5-screen visual reference (Welcome, Today, Studio, Wardrobe, My Week).

---

## 0. How to use this document with GitHub Copilot

1. Create an empty repo `forme` and open it in VS Code.
2. Save this file as `docs/BUILD_GUIDE.md`.
3. Create `.github/copilot-instructions.md` and paste the block in section 0.1.
4. Work **one phase at a time** (section 14). For each phase, open Copilot Chat in **Agent mode**, attach `docs/BUILD_GUIDE.md` (`#file:docs/BUILD_GUIDE.md`), and paste that phase's prompt.
5. After each phase: run the phase's "Done when" checks, commit, then move on. Do not start the next phase until the checks pass.

### 0.1 `.github/copilot-instructions.md`

```md
# FORME project rules
- Read docs/BUILD_GUIDE.md before making architectural decisions. It is the source of truth.
- Stack: React 18 + TypeScript (strict) + Vite + Tailwind CSS, Supabase (Auth, Postgres, Storage, Edge Functions), pnpm workspaces.
- Mobile-first. Design for a 390px-wide viewport first. All tap targets >= 44x44px.
- Use design tokens from apps/web/src/styles/tokens.css and tailwind.config.ts. Never hard-code hex colours in components.
- Server state via TanStack Query. Local UI state via Zustand. Forms via react-hook-form + zod.
- Never put business logic in components. Outfit logic lives in packages/outfit-engine (pure functions, no I/O).
- Every table has Row Level Security. Never use the Supabase service-role key in client code.
- Write unit tests (Vitest) for every function in packages/outfit-engine.
- Prefer small, typed, named-export modules. No `any`. No default exports except route components.
- Commit in small steps with conventional commit messages (feat:, fix:, chore:, test:).
```

---

## 1. Product summary

FORME is a personal wardrobe and styling app. A user digitises clothes they own, gets daily and weekly outfit suggestions made **only from their own wardrobe**, tweaks them, and returns later to find everything saved.

**Pilot objective (the definition of success):** a new user can sign up, photograph 20 garments, confirm the extracted details, receive a week of outfits, modify one outfit, and return later to see their changes saved.

**Principle:** real inventory before artificial intelligence.

### 1.1 Scope (reconciled with the visual reference)

| Area | MVP (build now) | Later (do not build now) |
|---|---|---|
| Auth and persistence | Email + magic link, persistent sessions | Social login |
| Onboarding | Welcome screen with identity choice (Male / Female / Other), then short preference setup | Quiz-style deep personalisation |
| Wardrobe | Camera or gallery upload, **in-browser background removal**, editable metadata, grid with filters and search | Video import, automatic recognition |
| Outfits | Rule-based engine, regenerate, save, lock | Learning from feedback |
| Today | Full-screen flat-lay hero of today's outfit, regenerate/save, optional weather chip | Calendar integration |
| Studio | **2D layered outfit composer** with slot swapping | 360° rotation, realistic body try-on (separate product, P2 spike) |
| My Week | 7-day strip, per-day outfit, lock / regenerate / edit | Calendar sync |
| You | Preferences (sections in 6.7) | Goals analytics |
| Platform | Responsive web | PWA install, native apps |

> The reference mockup shows a realistic person wearing the outfit in Studio, with rotate and pose buttons. That requires a virtual try-on model and is **out of scope**. The MVP Studio shows the composed outfit as a 2D flat-lay or stacked layout with the same chips and thumbnail strip as the mockup.

---

## 2. Design system (derived from the reference)

### 2.1 Tokens

```css
/* apps/web/src/styles/tokens.css */
:root {
  --forme-ink:        #241D17;  /* base dark brown, app background */
  --forme-ink-90:     rgba(36, 29, 23, 0.90);
  --forme-ink-60:     rgba(36, 29, 23, 0.60);
  --forme-sand:       #D5C5B0;  /* accents, active states, borders */
  --forme-cream:      #F4EDE3;  /* cards, tiles, primary text on dark */
  --forme-line:       rgba(244, 237, 227, 0.35); /* 1px outlines */
  --forme-glass:      rgba(36, 29, 23, 0.55);    /* frosted tab bar / chips */

  --radius-card: 14px;
  --radius-pill: 999px;
  --tap-min: 44px;

  --font-serif: "Cormorant Garamond", "Playfair Display", Georgia, serif;
  --font-sans:  "Inter", system-ui, sans-serif;
}
```

Fonts: load via Google Fonts (`Cormorant Garamond` 400/500/600, `Inter` 400/500). Always include fallbacks.

### 2.2 Visual rules

- **Background**: dark brown `--forme-ink`. Hero screens use full-bleed photography with a bottom gradient scrim (`linear-gradient(to top, rgba(36,29,23,.85), transparent 55%)`) to keep text legible (WCAG AA).
- **Titles**: serif, large (28 to 34px), cream. **Taglines and captions**: sans, 12 to 14px, cream at 80% opacity. Section labels in the footer style are small caps with letter-spacing `0.14em`.
- **Buttons**: outlined pills, 1px `--forme-line` border, transparent fill, cream text, chevron right. Primary-selected state is a cream fill with ink text.
- **Chips** (filters like All / Tops / Bottoms): pill, glass fill; active chip is cream fill with ink text.
- **Tiles** (wardrobe): cream `#F4EDE3` card, 14px radius, garment cutout centred with 12% padding, soft inner shadow.
- **Bottom tab bar**: frosted glass (`backdrop-filter: blur(16px)`), 5 tabs, line icons, label under each, active tab is filled icon plus cream label, inactive at 60% opacity. Height 72px plus safe-area inset.
- **Motion**: 200 to 300ms ease-out. Cross-fade between tabs, slide-up for sheets. Respect `prefers-reduced-motion`.
- **Icons**: `lucide-react` (Sun, Search, Plus, Home or Calendar, Shirt, Hanger-like, User).

---

## 3. System architecture

```
┌─────────────────────────── Client: React + TS + Vite ───────────────────────────┐
│ Router → feature modules → TanStack Query (server) + Zustand (UI state)          │
│ lib/: supabase client · image pipeline (compress + cutout worker) · flat-lay     │
│       composer (Canvas) · typed API wrappers                                      │
└───────────────┬──────────────────────────────────────┬───────────────────────────┘
                │ supabase-js (user JWT)               │ fetch (user JWT)
                ▼                                      ▼
┌──────────────────────────────────┐      ┌───────────────────────────────────────┐
│ Supabase                          │      │ Edge Function: generate-outfits (TS)  │
│ • Auth                            │◄─────│ imports packages/outfit-engine        │
│ • Postgres + RLS                  │      │ reads garments + preferences,         │
│ • Storage (private buckets)       │      │ writes outfits + outfit_items         │
└──────────────────────────────────┘      └───────────────────────────────────────┘

Later (not MVP): FastAPI vision service for video import and auto-tagging, triggered via upload_jobs.
```

### 3.1 Responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| Client | UI, validation, image compression, background removal, flat-lay rendering | Authorisation, outfit rules |
| Postgres + RLS | Integrity, per-user isolation | Outfit logic |
| Edge Function | Orchestration of generation, persistence | Rendering |
| `outfit-engine` | Pure rules: filter, score, rank, explain | Any I/O |

### 3.2 Tech stack (pin versions in `package.json`)

| Concern | Choice |
|---|---|
| Package manager | pnpm workspaces |
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS |
| Routing | React Router v6 |
| Server state | TanStack Query v5 |
| UI state | Zustand |
| Forms | react-hook-form + zod |
| UI primitives | Radix UI (via shadcn/ui), `vaul` for drawers |
| Animation | framer-motion |
| Icons | lucide-react |
| Image compression | `browser-image-compression` |
| Background removal | `@imgly/background-removal` (WASM, runs in a Web Worker) |
| Flat-lay export | HTML Canvas, `canvas.toBlob` |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions on Deno) |
| Tests | Vitest, React Testing Library, Playwright |
| Hosting | Vercel (web), Supabase Cloud |
| Weather (optional) | Open-Meteo (no API key) |

---

## 4. Repository structure

```
forme/
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/ci.yml
├── docs/BUILD_GUIDE.md
├── apps/web/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── app/
│   │   │   ├── routes.tsx
│   │   │   ├── AppShell.tsx          # outlet + bottom TabBar
│   │   │   ├── RequireAuth.tsx
│   │   │   └── providers.tsx         # QueryClient, Auth
│   │   ├── features/
│   │   │   ├── auth/                 # LoginPage, useSession
│   │   │   ├── onboarding/           # WelcomePage, IdentityChoice, SetupSteps
│   │   │   ├── wardrobe/             # WardrobePage, GarmentGrid, GarmentTile, AddGarmentSheet,
│   │   │   │                         #   ReviewGarmentForm, useGarments, useUploadGarment
│   │   │   ├── outfits/              # useGenerateOutfits, useOutfits, OutfitHero (flat-lay view)
│   │   │   ├── today/                # TodayPage
│   │   │   ├── studio/               # StudioPage, SlotChips, ThumbnailStrip, useStudioStore
│   │   │   ├── week/                 # WeekPage, DateStrip, DayOutfitCard
│   │   │   └── you/                  # YouPage, preference section forms
│   │   ├── components/
│   │   │   ├── ui/                   # Button, Chip, PillButton, Sheet, Tile, Skeleton
│   │   │   └── TabBar.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── queryClient.ts
│   │   │   ├── image/
│   │   │   │   ├── compress.ts
│   │   │   │   ├── cutout.worker.ts
│   │   │   │   └── cutout.ts
│   │   │   ├── flatlay/
│   │   │   │   ├── templates.ts      # layout coordinates
│   │   │   │   └── renderFlatlay.ts  # Canvas renderer
│   │   │   └── weather.ts
│   │   ├── styles/{tokens.css,index.css}
│   │   └── types/database.ts         # generated: supabase gen types
├── packages/outfit-engine/
│   ├── src/{types.ts,colour.ts,filter.ts,compose.ts,score.ts,generate.ts,index.ts}
│   └── test/*.test.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   ├── functions/generate-outfits/index.ts
│   └── seed.sql
├── e2e/                              # Playwright
├── package.json  pnpm-workspace.yaml  tsconfig.base.json
└── .env.example
```

---

## 5. Data model (Postgres)

Create as migrations in `supabase/migrations/`. Never edit schema through the dashboard.

### 5.1 Migration `0001_init.sql`

```sql
create extension if not exists "pgcrypto";

-- enums
create type garment_category as enum ('top','bottom','outerwear','footwear','accessory');
create type presentation as enum ('male','female','other');
create type formality as enum ('casual','smart_casual','formal','sport');
create type season as enum ('spring','summer','autumn','winter','all');
create type pattern as enum ('solid','stripe','check','print','textured','other');

-- profiles: one row per auth user
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  presentation presentation,
  onboarding_completed boolean not null default false,
  home_lat double precision,
  home_lon double precision,
  created_at timestamptz not null default now()
);

create table preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  lifestyle text[] not null default '{}',      -- e.g. {'office','student','creative'}
  style_tags text[] not null default '{}',     -- e.g. {'minimal','classic','streetwear'}
  liked_colours text[] not null default '{}',  -- colour families
  disliked_colours text[] not null default '{}',
  fit text,                                    -- 'slim' | 'regular' | 'relaxed'
  sizes jsonb not null default '{}',           -- {"top":"M","bottom":"32","shoe":"9"}
  occasions text[] not null default '{}',      -- {'work','weekend','evening'}
  climate text,                                -- 'hot' | 'temperate' | 'cold'
  goals text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table garments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  category garment_category not null,
  subcategory text,                  -- 'shirt','tee','chinos','sneakers','watch', ...
  colour_hex text,                   -- dominant colour, e.g. '#D8C9B4'
  colour_family text not null,       -- 'white','cream','beige','olive','navy','blue','grey','black','brown','red', ...
  pattern pattern not null default 'solid',
  season season not null default 'all',
  formality formality not null default 'casual',
  image_original_path text not null,
  image_cutout_path text,            -- transparent PNG
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on garments (user_id, category) where archived = false;

create table outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  planned_for date,                  -- null for studio-saved looks
  title text,
  caption text,                      -- "Clean, relaxed and versatile."
  layout_template text not null default 'flatlay_a',
  locked boolean not null default false,
  source text not null default 'engine', -- 'engine' | 'manual'
  engine_version text,
  explanation jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, planned_for)
);

create table outfit_items (
  outfit_id uuid not null references outfits(id) on delete cascade,
  garment_id uuid not null references garments(id) on delete cascade,
  slot garment_category not null,
  position smallint not null default 0, -- distinguishes multiple accessories
  primary key (outfit_id, slot, position)
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  outfit_id uuid references outfits(id) on delete set null,
  garment_id uuid references garments(id) on delete set null,
  kind text not null check (kind in ('save','regenerate','dislike','swap')),
  created_at timestamptz not null default now()
);

create table upload_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  garment_id uuid references garments(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  error text,
  created_at timestamptz not null default now()
);

-- auto-create profile + preferences on signup
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id);
  insert into preferences (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- updated_at helper
create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger garments_touch before update on garments for each row execute function touch_updated_at();
create trigger preferences_touch before update on preferences for each row execute function touch_updated_at();
```

### 5.2 Migration `0002_rls.sql`

```sql
alter table profiles     enable row level security;
alter table preferences  enable row level security;
alter table garments     enable row level security;
alter table outfits      enable row level security;
alter table outfit_items enable row level security;
alter table feedback     enable row level security;
alter table upload_jobs  enable row level security;

create policy "own profile"     on profiles    for all using (id = auth.uid())      with check (id = auth.uid());
create policy "own preferences" on preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own garments"    on garments    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own outfits"     on outfits     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own feedback"    on feedback    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own jobs"        on upload_jobs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own outfit items" on outfit_items for all
  using (exists (select 1 from outfits o where o.id = outfit_id and o.user_id = auth.uid()))
  with check (
    exists (select 1 from outfits o where o.id = outfit_id and o.user_id = auth.uid())
    and exists (select 1 from garments g where g.id = garment_id and g.user_id = auth.uid())
  );
```

### 5.3 Migration `0003_storage.sql`

```sql
insert into storage.buckets (id, name, public) values
  ('garments-original','garments-original', false),
  ('garments-cutout','garments-cutout', false)
on conflict do nothing;

-- Path convention: {user_id}/{garment_id}.{ext}
create policy "own originals" on storage.objects for all
  using (bucket_id = 'garments-original' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'garments-original' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own cutouts" on storage.objects for all
  using (bucket_id = 'garments-cutout' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'garments-cutout' and (storage.foldername(name))[1] = auth.uid()::text);
```

Serve images with `createSignedUrl(path, 3600)`; cache signed URLs in TanStack Query.

---

## 6. Screen specifications (match the reference)

Routes: `/welcome` `/login` `/today` `/studio` `/wardrobe` `/week` `/you`. Default authed route is `/today`. Unauthenticated users go to `/welcome`.

### 6.1 Welcome (`/welcome`)
- Full-bleed fabric photo with dark overlay. Centre: wordmark **FORME** (serif, light weight, wide tracking) and the tagline "YOUR WARDROBE. A BRIGHTER YOU." in small caps.
- Lower third: heading "Let's get started", subtext "Choose your identity to personalise your experience.", then three outlined pill buttons: **Male**, **Female**, **Other** (each with a right chevron).
- On tap: store `presentation` in local state, route to `/login` (sign up). After first sign-in, save it to `profiles.presentation`, then run Setup Steps (6.7), then `/today`.
- States: loading (skeleton overlay), reduced motion.

### 6.2 Today (`/today`)
- Full-screen flat-lay hero (see section 10) of today's outfit, scrim at the bottom.
- Top-left: date ("Tue, 16 Apr") small, title "Today" (serif), tagline "Smart. Effortless. You." Top-right: weather chip (icon + temperature, hidden when no location or offline) and a round "more" button (opens a sheet: Regenerate, Save, Share image).
- Bottom: "Today's Look" (serif), caption (`outfits.caption`), and a circular arrow button that opens the outfit in Studio (`/studio?outfit=<id>`).
- Empty state (wardrobe has fewer than 4 garments, or missing a top, bottom or footwear): friendly card "Add a few more pieces to get your first look" with a button to `/wardrobe`.
- Actions: Regenerate (new seed), Save (sets `source='manual'` if edited; logs feedback `save`).

### 6.3 Studio (`/studio`)
- Title "Studio", subtitle "Style it your way."
- Main area: large 2D composition of the current outfit (flat-lay or stacked layout) rendered with the same renderer as Today.
- Bottom: chip row **Outfit | Tops | Bottoms | Footwear | Accessories** (Outerwear is included under Tops with an "Outerwear" sub-filter, or add it as a sixth chip) and a horizontal thumbnail strip.
  - **Outfit** chip: strip shows candidate full outfits (engine suggestions); tap to load.
  - Category chip: strip shows the user's garments in that category; tap to swap that slot. The selected thumbnail has a cream border.
- Actions: Save look (creates or updates an `outfits` row), Add to a day (date picker, writes `planned_for`).
- Not in MVP: 360° button and pose buttons.

### 6.4 Wardrobe (`/wardrobe`)
- Title "My Wardrobe", subtitle "Your collection, beautifully organised." Top-right: search button (expands to input, filters by name and subcategory) and round "+" button (opens AddGarmentSheet).
- Chips: **All | Tops | Bottoms | Outerwear | Footwear** (plus Accessories, scrollable).
- 3-column grid of cream tiles with cutouts. Tap a tile to open a detail sheet (edit metadata, archive/delete).
- Empty state: illustration plus "Add your first piece" button. Show a progress hint "12 of 20 pieces added" until 20.
- Infinite or virtualised list if more than 60 items.

### 6.5 My Week (`/week`)
- Title "My Week", subtitle "Outfits planned, so you can focus on what matters."
- Date strip: Mon to Sun with day number; the selected day is a cream pill. **Use correct abbreviations (Mon, Tue, Wed, Thu, Fri, Sat, Sun).** The mockup's "Yed" is a typo.
- Hero: that day's flat-lay, with weekday name, caption and circular arrow (opens in Studio).
- Per-day controls (in a sheet from the arrow or a "more" button): Regenerate, Lock/Unlock, Edit in Studio, Clear. Locked days are skipped by "Regenerate week".
- Top-level action: "Plan my week" generates all unlocked days for the visible week.

### 6.6 You (`/you`)
List of sections that each open a form sheet: **Lifestyle, Style, Colours, Fit & Size, Occasions, Climate, Goals**. Also: display name, identity (Male/Female/Other), location permission toggle (for weather), sign out, delete account/data. Autosave on change with debounce.

### 6.7 Onboarding setup steps (after first sign-in)
1. Identity (already chosen on Welcome), 2. Style (multi-select tags), 3. Colours (like/avoid), 4. Occasions, 5. "Add your first garments" (links to Wardrobe upload). Skippable; mark `profiles.onboarding_completed=true` at the end.

### 6.8 Shared UI states
Every data screen needs loading (skeletons), empty, and error (toast plus retry) states. Respect safe-area insets on iOS.

---

## 7. Image pipeline (add garment)

```
capture/select → validate → compress → cutout (Web Worker) → preview + review form
  → upload original + cutout to Storage → insert garments row → invalidate ['garments']
```

Details:
1. **Input**: `<input type="file" accept="image/*" capture="environment">` plus a gallery option.
2. **Validate**: type in {jpeg, png, webp, heic→convert}, max 15MB raw.
3. **Compress**: `browser-image-compression`, `maxWidthOrHeight: 1600`, `maxSizeMB: 0.8`, `useWebWorker: true`.
4. **Cutout**: `@imgly/background-removal` inside `cutout.worker.ts`; output PNG, then downscale to max 1000px. Show progress ("Preparing your piece…"). Lazy-load the model only when the user first adds a garment. On failure or timeout (20s), fall back to the original and flag `image_cutout_path = null` (tile uses `object-contain` on cream).
5. **Auto-fill suggestions** (no network): compute the dominant colour from non-transparent pixels (k-means on a downsampled canvas), map to `colour_family` with the nearest-neighbour table in `packages/outfit-engine/src/colour.ts`. User confirms or edits in the review form.
6. **Review form** (zod): name (required), category (required), subcategory, colour family (swatch picker), pattern, season, formality. "Save" disabled until valid.
7. **Upload**: `garments-original/{uid}/{garmentId}.jpg` and `garments-cutout/{uid}/{garmentId}.png`. Generate the `garmentId` client-side with `crypto.randomUUID()` so paths are known before insert. If the insert fails, delete the uploaded objects.
8. **Batch mode**: allow selecting multiple photos; process sequentially with a queue and a per-item status list.

Optional later (not MVP): `upload_jobs` + a Python service for video frames and auto-tagging.

---

## 8. Outfit engine (`packages/outfit-engine`)

Pure TypeScript. No network, no Supabase imports. Deterministic given a seed.

### 8.1 Types (`types.ts`)

```ts
export type Category = 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory';

export interface Garment {
  id: string;
  category: Category;
  subcategory?: string;
  colourFamily: string;
  colourHex?: string;
  pattern: 'solid' | 'stripe' | 'check' | 'print' | 'textured' | 'other';
  season: 'spring' | 'summer' | 'autumn' | 'winter' | 'all';
  formality: 'casual' | 'smart_casual' | 'formal' | 'sport';
}

export interface Preferences {
  styleTags: string[];
  likedColours: string[];
  dislikedColours: string[];
  occasions: string[];
  climate?: 'hot' | 'temperate' | 'cold';
}

export interface Context {
  date: string;            // ISO date
  temperatureC?: number;   // optional, from weather
  occasion?: string;
  seed: number;
}

export interface OutfitSuggestion {
  items: { slot: Category; garmentId: string; position: number }[];
  score: number;
  caption: string;
  explanation: string[];   // reasons, e.g. "Neutral palette", "Appropriate for cool weather"
}

export interface History {
  recentOutfits: { date: string; garmentIds: string[] }[];
  garmentUseCount: Record<string, number>;
}

export interface GenerateInput {
  garments: Garment[];
  prefs: Preferences;
  ctx: Context;
  history: History;
  count: number;           // number of suggestions to return
  lockedGarmentIds?: string[]; // must be included
}
export const ENGINE_VERSION = '1.0.0';
```

### 8.2 Algorithm (`generate.ts`)

1. **Filter** (`filter.ts`): remove garments whose colour is in `dislikedColours`; remove season mismatches (season ≠ `all` and ≠ current season, derived from date and hemisphere approximation); if `temperatureC` is available, drop outerwear when above 24°C and require outerwear below 12°C if any exists.
2. **Compose** (`compose.ts`): required slots are one `top`, one `bottom`, one `footwear`; optional `outerwear` (include when cold or by probability 0.4 otherwise); optional 0 to 2 `accessory`. Generate candidates by sampling combinations with a seeded RNG (cap at 300 candidates to bound runtime).
3. **Score** (`score.ts`), weights tunable constants:
   - Colour harmony (0 to 40): neutrals (white, cream, beige, grey, black, navy, brown, olive, tan) combine freely; at most one strong accent colour; penalise clashing pairs from a small table; reward tonal or analogous pairs.
   - Pattern balance (0 to 10): at most one patterned item among top, bottom, outerwear.
   - Formality coherence (0 to 20): max formality gap of 1 level across items; footwear must match the average formality within one level.
   - Preference match (0 to 15): liked colours, style tags (map tag to subcategory affinities).
   - Variety (0 to 15): penalise items worn in the last 3 days, and the same exact combination within 14 days; slightly boost under-used garments.
4. **Rank and diversify**: sort descending; pick the top `count` greedily, enforcing no identical top or bottom on consecutive days when `count > 1`.
5. **Explain**: attach `explanation[]` and build `caption` from templates by formality and palette (e.g. "Clean, relaxed and versatile." / "Polished and comfortable." / "Sharp, simple and ready for work.").
6. If a required slot has no candidates, return a typed error `{ code: 'MISSING_SLOT', slot }` for the UI to explain.

### 8.3 Colour module (`colour.ts`)
- `hexToFamily(hex: string): string` (nearest neighbour in Lab space against a table of ~14 families).
- `isNeutral(family)`, `harmonyScore(a, b)`.

### 8.4 Tests (Vitest), required
- Never returns two items for the same required slot.
- Respects disliked colours and locked garments.
- Same input and seed gives identical output; different seed gives a different outfit when alternatives exist.
- Cold-weather input includes outerwear when available.
- Week generation yields 7 outfits with no identical top on consecutive days when the wardrobe allows.
- Handles empty and tiny wardrobes without throwing.

---

## 9. Edge Function: `generate-outfits`

`POST /functions/v1/generate-outfits` (JWT required).

Request:
```json
{ "from": "2026-04-13", "to": "2026-04-19", "seed": 1234, "overwriteUnlocked": true, "temperatureC": 28 }
```
Response:
```json
{ "outfits": [ { "id": "uuid", "planned_for": "2026-04-13", "caption": "...", "items": [ { "slot": "top", "garment_id": "uuid" } ] } ], "warnings": [] }
```

Steps:
1. Create a Supabase client **with the caller's JWT** (so RLS applies). Never use the service-role key.
2. Load non-archived garments, preferences, and the last 14 days of outfits (for history).
3. For each date in range: skip if an outfit exists with `locked = true`; call `generate()` with `count` and history updated as you go.
4. Upsert `outfits` (on `user_id, planned_for`) and replace `outfit_items`. Store `engine_version` and `explanation`.
5. Return the created outfits, or `MISSING_SLOT` warnings.
6. Basic rate limit: max 20 calls per user per hour (check a counter table or the `feedback` log).

Single-outfit "regenerate" uses the same function with `from == to` and a new `seed`, and logs `feedback(kind='regenerate')`.

---

## 10. Flat-lay composer (Today, Week and Studio visuals)

Goal: reproduce the reference look (items laid on a textured surface) from the user's cutouts.

- `lib/flatlay/templates.ts` defines 3 templates (`flatlay_a`, `flatlay_b`, `flatlay_c`) as normalised coordinates (0 to 1) per slot: `{ slot, x, y, w, rotation, z }`.
  - Typical: outerwear and top stacked upper-centre (outerwear slightly behind and rotated -4°), bottoms lower-centre, footwear lower-left, accessories (watch, sunglasses) right edge.
- `renderFlatlay(canvas, { items, template, background })`:
  1. Draw the background texture (bundled WebP: linen, stone, wood), darkened to match the palette.
  2. For each item: load cutout image (signed URL, `crossOrigin='anonymous'`), draw with rotation, apply a soft drop shadow (`shadowBlur 24`, `shadowOffsetY 12`, rgba(0,0,0,.35)).
  3. Output size = device viewport × devicePixelRatio (cap 2).
- `OutfitHero` component renders a `<canvas>` plus gradient scrim, memoised on (outfit id, items hash, template).
- Fallback for garments without cutouts: draw the original inside a rounded cream card.
- Export: "Share image" calls `canvas.toBlob('image/jpeg', 0.9)` and uses the Web Share API when available, otherwise downloads.
- Assign `layout_template` pseudo-randomly from the seed so the week feels varied.

Assets: put 3 to 4 royalty-free background textures in `apps/web/src/assets/surfaces/` (Unsplash or Pexels, record licences in `docs/ASSET_LICENSES.md`). Welcome photography likewise.

---

## 11. Client data layer

### 11.1 Query keys and hooks

| Key | Hook | Source |
|---|---|---|
| `['session']` | `useSession` | `supabase.auth` |
| `['profile']` | `useProfile` | `profiles` |
| `['preferences']` | `usePreferences` | `preferences` |
| `['garments', filters]` | `useGarments` | `garments` (filter by category, search) |
| `['outfits', from, to]` | `useOutfits` | `outfits` joined with `outfit_items` and garments |
| `['signedUrl', path]` | `useSignedUrl` | Storage, stale time 50 min |

### 11.2 Mutations
`useUploadGarment`, `useUpdateGarment`, `useArchiveGarment`, `useGenerateOutfits`, `useSaveOutfit`, `useUpdatePreferences` (debounced). Use optimistic updates for garment edits, outfit lock/unlock and preference changes. Roll back on error with a toast.

### 11.3 Studio store (Zustand)
```ts
interface StudioState {
  draft: Record<Category, string | null> | null; // slot → garmentId
  activeChip: 'outfit' | 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory';
  setSlot(slot: Category, garmentId: string | null): void;
  loadOutfit(outfitId: string): void;
  reset(): void;
}
```

---

## 12. End-to-end workflows

**W1. New user**: `/welcome` → pick identity → `/login` (magic link or email+password) → profile row created by trigger → save presentation → setup steps → `/wardrobe` prompt to add pieces → after 4+ pieces covering top, bottom and footwear, `/today` shows the first outfit.

**W2. Add garment**: Wardrobe "+" → sheet (camera/gallery) → compress → cutout → review form → save → tile appears (optimistic) → counters update.

**W3. Generate**: Today (auto on first open each day if no outfit for today) or Week "Plan my week" → Edge Function → outfits stored → UI updates via invalidation.

**W4. Edit outfit**: Today/Week arrow → Studio with the outfit loaded → swap slots via thumbnails → Save look → outfit row updated (`source='manual'`, `locked=true` optional) → reflected on Today/Week.

**W5. Remove garment**: Wardrobe tile → detail sheet → Archive (soft) → engine ignores it; outfits containing it are flagged "needs update" and regenerated on next open (unless locked, in which case prompt the user).

**W6. Return visit**: session restored → `/today` → saved data fetched; offline shows cached data with a subtle banner.

---

## 13. Non-functional requirements

- **Performance**: LCP under 2.5s on 4G for `/today`; wardrobe grid renders 60 tiles smoothly; image pipeline for one photo under 8s on a mid-range phone; JS bundle under 250KB gzipped initial (lazy-load the cutout model and Studio).
- **Accessibility**: WCAG AA contrast (use scrims), visible focus rings, `aria-label` on icon-only buttons, tabs implemented as nav landmarks, tap targets at least 44px, reduced-motion support.
- **Privacy and security**: private buckets, RLS everywhere, signed URLs, no third-party image uploads in MVP, "Delete my data" removes rows and storage objects, no PII in logs.
- **Browsers**: latest two versions of Safari iOS, Chrome Android, Chrome/Edge/Safari desktop.
- **Reliability**: retry with backoff on uploads, idempotent inserts using client-generated UUIDs.
- **Analytics (privacy-light)**: optional PostHog events: `garment_added`, `outfit_generated`, `outfit_saved`, `outfit_regenerated`, `week_planned`.

---

## 14. Build phases (feed these to Copilot one at a time)

Each phase: **Prompt**, then **Done when**. Commit at the end of each.

### Phase 0. Project scaffold
**Prompt:** "Read #file:docs/BUILD_GUIDE.md. Scaffold the pnpm monorepo exactly as in section 4: apps/web (Vite + React + TS strict + Tailwind), packages/outfit-engine (TS library with Vitest), supabase folder via `supabase init`. Add ESLint, Prettier, `tsconfig.base.json`, `.env.example` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY), and a GitHub Actions workflow running lint, typecheck and tests. Add scripts: `dev`, `build`, `lint`, `typecheck`, `test`."
**Done when:** `pnpm install && pnpm lint && pnpm typecheck && pnpm test` pass; `pnpm dev` shows a blank app.

### Phase 1. Design system and shell
**Prompt:** "Implement section 2: tokens.css, Tailwind theme extending the tokens, Google fonts, and base components in components/ui (Button/PillButton, Chip, Tile, Sheet using Radix Dialog or vaul, Skeleton). Build `TabBar` (5 tabs: Today, Studio, Wardrobe, My Week, You; frosted glass; active state) and `AppShell`. Configure React Router with the seven routes from section 6 using placeholder pages that show the screen title and subtitle. Add a `/dev/kit` page showing all components."
**Done when:** navigation between tabs works at 390px width, tap targets are 44px+, active tab styling matches the reference.

### Phase 2. Database and auth
**Prompt:** "Create migrations 0001, 0002, 0003 exactly as in section 5. Configure the Supabase client in lib/supabase.ts. Generate types to src/types/database.ts. Implement auth feature: LoginPage (magic link and email+password), useSession, RequireAuth, sign out. Write SQL or Vitest integration tests proving user A cannot read or write user B's garments, outfits and storage objects."
**Done when:** `supabase db reset` applies cleanly; signup creates profile and preferences rows; RLS tests pass.

### Phase 3. Welcome and onboarding
**Prompt:** "Build WelcomePage per section 6.1 with a full-bleed background image, FORME wordmark, tagline, and Male/Female/Other pill buttons. Persist the choice, route to login, then after first login save `profiles.presentation` and show the setup steps in 6.7 (skippable). Redirect logic: unauthenticated → /welcome; authenticated and onboarding incomplete → setup; else /today."
**Done when:** a fresh user completes onboarding and lands on /today; refresh keeps the session.

### Phase 4. Wardrobe and image pipeline
**Prompt:** "Implement section 7 and the Wardrobe screen (6.4): AddGarmentSheet, compress.ts, cutout worker with @imgly/background-removal (lazy-loaded), dominant-colour extraction, ReviewGarmentForm (react-hook-form + zod), upload to the two private buckets, insert garments row, GarmentGrid with filter chips, search, tile detail sheet (edit, archive). Include batch selection with a per-item progress list and a cutout fallback."
**Done when:** on a real phone you can add a garment in under 15s, see a transparent cutout on a cream tile, edit its metadata, archive it, and see it persisted after reload. Test with 20 garments.

### Phase 5. Outfit engine
**Prompt:** "Implement packages/outfit-engine per section 8: types, colour.ts, filter.ts, compose.ts, score.ts, generate.ts with a seeded RNG, plus all tests listed in 8.4. Export `generate` and `ENGINE_VERSION`. Keep it free of I/O."
**Done when:** `pnpm --filter outfit-engine test` passes with coverage over 90% for the package.

### Phase 6. Edge Function and outfit data hooks
**Prompt:** "Implement supabase/functions/generate-outfits per section 9 (import the engine via a bundled build or relative import map). Add client hooks useGenerateOutfits, useOutfits, useSaveOutfit with optimistic updates (section 11). Add the rate limit and error mapping (MISSING_SLOT → friendly message)."
**Done when:** calling the function with a 7-day range for a user with 20 garments creates 7 outfits with items; locked days are untouched.

### Phase 7. Flat-lay composer, Today and My Week
**Prompt:** "Implement section 10 (templates, renderFlatlay, OutfitHero with scrim and fallback). Build TodayPage per 6.2 (date, title, tagline, weather chip via Open-Meteo when location is allowed, caption, arrow to Studio, Regenerate/Save sheet, empty state). Build WeekPage per 6.5 (DateStrip with correct day abbreviations, hero per day, lock/regenerate/edit/clear, Plan my week)."
**Done when:** visuals closely match the reference screens; regenerate changes the outfit; lock persists; week plan generates for unlocked days.

### Phase 8. Studio
**Prompt:** "Implement StudioPage per 6.3: composed 2D outfit using the flat-lay renderer, chip row (Outfit, Tops, Bottoms, Outerwear, Footwear, Accessories), horizontal thumbnail strip, slot swapping via Zustand store, Save look, Add to a day. Opening from Today/Week via `?outfit=` loads that outfit."
**Done when:** swapping a slot updates the preview instantly; saved changes appear on Today and My Week after navigation and reload.

### Phase 9. You (preferences) and polish
**Prompt:** "Implement YouPage with the seven preference sheets (6.6), debounced autosave, identity edit, location toggle, sign out and 'Delete my data'. Then add page transitions with framer-motion, skeletons and empty/error states everywhere (6.8), an accessibility pass (focus rings, aria-labels, contrast), and bundle splitting for Studio and the cutout model."
**Done when:** Lighthouse mobile scores above 90 for performance and above 95 for accessibility on /today; preferences visibly influence generated outfits (liked and disliked colours).

### Phase 10. Tests, CI and deployment
**Prompt:** "Add Playwright e2e tests (mobile viewport) for: sign up and onboarding; add 3 garments with fixture images; generate week; edit an outfit in Studio; reload and verify persistence; RLS isolation with two users. Extend CI to run Supabase locally, migrations, unit tests, and e2e. Add deployment: Vercel for apps/web with env vars; `supabase db push` and `supabase functions deploy` documented in README."
**Done when:** CI is green on a PR; a staging deployment passes the pilot objective (section 1) end to end.

---

## 15. Environments, configuration and ops

| Env | Web | Supabase | Notes |
|---|---|---|---|
| local | `pnpm dev` | `supabase start` (Docker) | seed via `seed.sql` |
| staging | Vercel preview per PR | shared staging project | demos, QA |
| production | Vercel prod | production project | pilot users |

- Env vars (web): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Edge Function secrets are set with `supabase secrets set`. Never commit `.env*`.
- Migrations only through files; CI applies to staging on merge to `main`, production on tagged release.
- Regenerate DB types after every migration: `supabase gen types typescript --local > apps/web/src/types/database.ts`.
- Branching: trunk-based, short-lived `feat/*` branches, squash merge, conventional commits.

---

## 16. Acceptance tests (map to the pilot)

| ID | Scenario | Expected |
|---|---|---|
| AT-01 | Sign up with email | Profile and preferences rows exist; lands in setup |
| AT-02 | Choose identity on Welcome | Saved to profile after login |
| AT-03 | Add a garment from camera/gallery | Cutout shown on cream tile within 15s |
| AT-04 | Background removal fails | Original image used, user can still save |
| AT-05 | Edit garment metadata | Changes persist after reload |
| AT-06 | Add 20 garments | Grid scrolls smoothly; count shown |
| AT-07 | Open Today with a valid wardrobe | Flat-lay outfit shown with caption |
| AT-08 | Wardrobe missing footwear | Empty state explains what to add |
| AT-09 | Regenerate Today | Different outfit; previous logged as feedback |
| AT-10 | Plan my week | 7 outfits; no identical top on consecutive days |
| AT-11 | Lock a day then regenerate week | Locked day unchanged |
| AT-12 | Edit outfit in Studio and save | Visible on Today/Week after reload |
| AT-13 | Archive a garment used in an outfit | Outfit flagged/regenerated; no broken images |
| AT-14 | Two users | Cannot see each other's data or images |
| AT-15 | Return visit after 24h | Session valid; all data present |

---

## 17. Assumptions and open decisions

1. **Identity choice** (Male/Female/Other) influences only default style tags and sizing options, not which garments are allowed. Confirm wording with the product owner.
2. **Auth method**: magic link plus password; add Google later.
3. **Weather** is optional, uses coarse location with explicit permission, and falls back to climate preference.
4. **Image rights**: all stock imagery must be properly licensed; user-uploaded images are private to the user.
5. **Monetisation**: none in MVP.
6. **Virtual try-on / 360° Studio** is a future spike (third-party try-on API or a custom model) and must not block the MVP.
7. **Hemisphere/season** derived from the latitude if set, otherwise assume northern hemisphere.

---

*End of guide. Source of truth for architecture, data model, UX and delivery order. If a decision is missing, choose the simplest option consistent with this document and record it in `docs/DECISIONS.md`.*
