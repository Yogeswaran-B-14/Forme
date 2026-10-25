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
