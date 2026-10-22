-- ReflectAI — initial schema
-- Tables: journal_entries, journal_chunks, ai_requests
-- Security model: Row Level Security on every table; every function is SECURITY INVOKER,
-- so it runs with the caller's permissions and RLS still applies.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  content       text not null check (char_length(content) between 1 and 20000),
  entry_date    date not null default current_date,
  index_status  text not null default 'pending' check (index_status in ('pending', 'ready', 'failed')),
  index_error   text,
  indexed_at    timestamptz,
  created_at    timestamptz not null default now(),
  -- Bumped only when indexed text changes (see trigger). Doubles as the
  -- version token that stops a slow, older re-index overwriting a newer one.
  updated_at    timestamptz not null default now()
);

create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc, created_at desc);

create or replace function public.touch_journal_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.title is distinct from old.title
     or new.content is distinct from old.content
     or new.entry_date is distinct from old.entry_date then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  -- Ownership can never be reassigned.
  new.user_id := old.user_id;
  return new;
end;
$$;

create trigger journal_entries_touch
before update on public.journal_entries
for each row execute function public.touch_journal_entry();

alter table public.journal_entries enable row level security;

create policy "entries_select_own" on public.journal_entries
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "entries_insert_own" on public.journal_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "entries_update_own" on public.journal_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "entries_delete_own" on public.journal_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- journal_chunks — one row per embedded chunk; removed with its parent entry
-- ---------------------------------------------------------------------------
create table public.journal_chunks (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.journal_entries (id) on delete cascade,
  -- Denormalised owner so retrieval can filter by an index before ranking.
  -- RLS below also requires the parent entry to be owned by the same user.
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chunk_index  integer not null check (chunk_index >= 0),
  content      text not null,
  embedding    extensions.vector(1536) not null,
  created_at   timestamptz not null default now(),
  unique (entry_id, chunk_index)
);

-- Exact (non-approximate) search over one user's chunks: a per-user B-tree is
-- enough at journal scale and avoids HNSW post-filtering dropping results.
create index journal_chunks_user_idx on public.journal_chunks (user_id);
create index journal_chunks_entry_idx on public.journal_chunks (entry_id);

alter table public.journal_chunks enable row level security;

create policy "chunks_select_own" on public.journal_chunks
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.journal_entries e
      where e.id = entry_id and e.user_id = (select auth.uid())
    )
  );

create policy "chunks_insert_own" on public.journal_chunks
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.journal_entries e
      where e.id = entry_id and e.user_id = (select auth.uid())
    )
  );

create policy "chunks_delete_own" on public.journal_chunks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- No UPDATE policy: chunks are replaced, never edited in place.

-- ---------------------------------------------------------------------------
-- replace_entry_chunks — atomic re-index
-- Old vectors are deleted and new ones inserted in one transaction, and only if
-- the entry still has the version the embeddings were built from. A failed
-- OpenAI call never reaches here, so the last good index survives.
-- p_chunks: [{ "chunk_index": 0, "content": "...", "embedding": "[0.1,...]" }, ...]
-- ---------------------------------------------------------------------------
create or replace function public.replace_entry_chunks(
  p_entry_id uuid,
  p_expected_updated_at timestamptz,
  p_chunks jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current timestamptz;
begin
  select e.updated_at into v_current
  from public.journal_entries e
  where e.id = p_entry_id and e.user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'journal entry not found' using errcode = 'P0002';
  end if;

  -- A newer edit landed while we were embedding; let its own indexing win.
  if v_current <> p_expected_updated_at then
    return false;
  end if;

  delete from public.journal_chunks where entry_id = p_entry_id;

  insert into public.journal_chunks (entry_id, user_id, chunk_index, content, embedding)
  select p_entry_id,
         (select auth.uid()),
         (c ->> 'chunk_index')::integer,
         c ->> 'content',
         (c ->> 'embedding')::extensions.vector(1536)
  from jsonb_array_elements(p_chunks) as c;

  update public.journal_entries
  set index_status = 'ready', index_error = null, indexed_at = now()
  where id = p_entry_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- match_journal_chunks — tenant-scoped cosine-similarity search
-- ---------------------------------------------------------------------------
create or replace function public.match_journal_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 5,
  match_threshold double precision default 0.25
)
returns table (
  chunk_id     uuid,
  entry_id     uuid,
  chunk_index  integer,
  content      text,
  title        text,
  entry_date   date,
  similarity   double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id,
         c.entry_id,
         c.chunk_index,
         c.content,
         e.title,
         e.entry_date,
         1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.journal_chunks c
  join public.journal_entries e on e.id = c.entry_id
  -- Explicit owner filter on top of RLS: defence in depth, and lets the
  -- planner use journal_chunks_user_idx.
  where c.user_id = (select auth.uid())
    and e.user_id = (select auth.uid())
    and 1 - (c.embedding operator(extensions.<=>) query_embedding) >= match_threshold
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 10);
$$;

-- ---------------------------------------------------------------------------
-- ai_requests + consume_ai_quota — per-user hourly cap on paid AI calls
-- ---------------------------------------------------------------------------
create table public.ai_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index ai_requests_user_time_idx on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

create policy "ai_requests_select_own" on public.ai_requests
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "ai_requests_insert_own" on public.ai_requests
  for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.consume_ai_quota(p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_used integer;
begin
  select count(*) into v_used
  from public.ai_requests
  where user_id = (select auth.uid())
    and created_at > now() - interval '1 hour';

  if v_used >= p_limit then
    return false;
  end if;

  insert into public.ai_requests (user_id) values ((select auth.uid()));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: signed-in users only
-- ---------------------------------------------------------------------------
revoke execute on function public.replace_entry_chunks(uuid, timestamptz, jsonb) from public, anon;
revoke execute on function public.match_journal_chunks(extensions.vector, integer, double precision) from public, anon;
revoke execute on function public.consume_ai_quota(integer) from public, anon;

grant execute on function public.replace_entry_chunks(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.match_journal_chunks(extensions.vector, integer, double precision) to authenticated;
grant execute on function public.consume_ai_quota(integer) to authenticated;
