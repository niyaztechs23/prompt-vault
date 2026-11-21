-- PROMPT VAULT · complete schema with Row Level Security
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

create extension if not exists pgcrypto;

-- ─────────────────────────── Tables ───────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#7C6CFF',
  created_at timestamptz not null default now()
);
create unique index categories_user_name_uniq on public.categories (user_id, lower(name));

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now()
);
create unique index tags_user_name_uniq on public.tags (user_id, lower(name));

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  color text not null default '#7C6CFF',
  created_at timestamptz not null default now()
);
create unique index collections_user_name_uniq on public.collections (user_id, lower(name));

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  content text not null,
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  platform text not null default 'Any',
  notes text not null default '',
  is_favorite boolean not null default false,
  is_pinned boolean not null default false,
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index prompts_user_updated_idx on public.prompts (user_id, updated_at desc);
create index prompts_user_deleted_idx on public.prompts (user_id, deleted_at);
create index prompts_search_idx on public.prompts using gin (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(content,''))
);

create table public.prompt_tags (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (prompt_id, tag_id)
);

create table public.collection_prompts (
  collection_id uuid not null references public.collections(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (collection_id, prompt_id)
);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  title text not null,
  content text not null,
  description text not null default '',
  category_id uuid, -- snapshot only; survives category deletion
  platform text not null default 'Any',
  notes text not null default '',
  tag_ids jsonb not null default '[]',
  collection_ids jsonb not null default '[]',
  change_note text not null default '',
  created_at timestamptz not null default now(),
  unique (prompt_id, version_number)
);
create index versions_prompt_idx on public.prompt_versions (prompt_id, version_number desc);
create index versions_user_created_idx on public.prompt_versions (user_id, created_at desc);

create table public.prompt_usage (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null default 'copy',
  used_at timestamptz not null default now()
);
create index usage_user_time_idx on public.prompt_usage (user_id, used_at desc);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  default_category_id uuid,
  default_sort text not null default 'updated',
  default_view text not null default 'grid' check (default_view in ('grid','list')),
  autosave boolean not null default true,
  editor_font_size integer not null default 14 check (editor_font_size between 10 and 28),
  show_counts boolean not null default true,
  seeded boolean not null default false,
  ai_model text,
  updated_at timestamptz not null default now()
);

-- Server-only AI rate-limit log (no client policies → denied for clients; service role bypasses RLS)
create table public.ai_request_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_log_user_time_idx on public.ai_request_log (user_id, created_at desc);

-- ─────────────────────────── Triggers ───────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger prompts_touch before update on public.prompts
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-provision profile + settings on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,'user'), '@', 1)),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Link tables: verify BOTH sides belong to the inserting user (defense in depth beyond RLS)
create or replace function public.check_link_ownership() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.prompts where id = new.prompt_id;
  if owner is distinct from new.user_id then raise exception 'ownership mismatch: prompt'; end if;
  if TG_TABLE_NAME = 'prompt_tags' then
    select user_id into owner from public.tags where id = new.tag_id;
    if owner is distinct from new.user_id then raise exception 'ownership mismatch: tag'; end if;
  else
    select user_id into owner from public.collections where id = new.collection_id;
    if owner is distinct from new.user_id then raise exception 'ownership mismatch: collection'; end if;
  end if;
  return new;
end $$;

create trigger prompt_tags_owner before insert or update on public.prompt_tags
  for each row execute function public.check_link_ownership();
create trigger collection_prompts_owner before insert or update on public.collection_prompts
  for each row execute function public.check_link_ownership();

-- ─────────────────────────── Row Level Security ───────────────────────────
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.tags              enable row level security;
alter table public.collections       enable row level security;
alter table public.prompts           enable row level security;
alter table public.prompt_tags       enable row level security;
alter table public.collection_prompts enable row level security;
alter table public.prompt_versions   enable row level security;
alter table public.prompt_usage      enable row level security;
alter table public.user_settings     enable row level security;
alter table public.ai_request_log    enable row level security; -- no policies: service-role only

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tags" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own collections" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own prompts" on public.prompts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own prompt_tags" on public.prompt_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own collection_prompts" on public.collection_prompts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own versions" on public.prompt_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own usage" on public.prompt_usage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
