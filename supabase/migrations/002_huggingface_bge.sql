-- Apply once after 001_initial.sql, with the old app stopped.
-- Preserve all journal records, original timestamps, and legacy 1536-d vectors.
-- BGE has a distinct embedding space, even from other 384-dimensional models.
begin;

create table public.journal_chunks_bge (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.journal_entries (id) on delete cascade,
  -- Denormalised owner so retrieval can filter by an index before ranking.
  -- RLS below also requires the parent entry to be owned by the same user.
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chunk_index  integer not null check (chunk_index >= 0),
  content      text not null,
  embedding    extensions.vector(384) not null,
  entry_updated_at timestamptz not null,
  created_at   timestamptz not null default now(),
  unique (entry_id, chunk_index)
);

-- Exact (non-approximate) search over one user's chunks: a per-user B-tree is
-- enough at journal scale and avoids HNSW post-filtering dropping results.
create index journal_chunks_bge_user_idx on public.journal_chunks_bge (user_id);
create index journal_chunks_bge_entry_idx on public.journal_chunks_bge (entry_id);

alter table public.journal_chunks_bge enable row level security;

create policy "chunks_select_own" on public.journal_chunks_bge
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.journal_entries e
      where e.id = entry_id and e.user_id = (select auth.uid())
    )
  );

create policy "chunks_insert_own" on public.journal_chunks_bge
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.journal_entries e
      where e.id = entry_id and e.user_id = (select auth.uid())
    )
  );

create policy "chunks_delete_own" on public.journal_chunks_bge
  for delete to authenticated using ((select auth.uid()) = user_id);

-- No UPDATE policy: chunks are replaced, never edited in place.

-- ---------------------------------------------------------------------------
-- replace_entry_chunks_bge — atomic re-index
-- Old vectors are deleted and new ones inserted in one transaction, and only if
-- the entry still has the version the embeddings were built from. A failed
-- Hugging Face call never reaches here, so the last good index survives.
-- p_chunks: [{ "chunk_index": 0, "content": "...", "embedding": "[0.1,...]" }, ...]
-- ---------------------------------------------------------------------------
create or replace function public.replace_entry_chunks_bge(
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
  if v_current is distinct from p_expected_updated_at then
    return false;
  end if;

  if jsonb_typeof(p_chunks) is distinct from 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'chunks must be a non-empty array';
  end if;

  delete from public.journal_chunks_bge where entry_id = p_entry_id;

  insert into public.journal_chunks_bge (entry_id, user_id, chunk_index, content, embedding, entry_updated_at)
  select p_entry_id,
         (select auth.uid()),
         (c ->> 'chunk_index')::integer,
         c ->> 'content',
         (c ->> 'embedding')::extensions.vector(384),
         v_current
  from jsonb_array_elements(p_chunks) as c;

  update public.journal_entries
  set index_status = 'ready', index_error = null, indexed_at = now()
  where id = p_entry_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- match_journal_chunks_bge — tenant-scoped cosine-similarity search
-- ---------------------------------------------------------------------------
create or replace function public.match_journal_chunks_bge(
  query_embedding extensions.vector(384),
  match_count integer default 5,
  match_threshold double precision default 0.65
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
  from public.journal_chunks_bge c
  join public.journal_entries e on e.id = c.entry_id
  -- Explicit owner filter on top of RLS: defence in depth, and lets the
  -- planner use journal_chunks_bge_user_idx.
  where c.user_id = (select auth.uid())
    and e.user_id = (select auth.uid())
    and c.entry_updated_at = e.updated_at
    and 1 - (c.embedding operator(extensions.<=>) query_embedding) >= match_threshold
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 10);
$$;


revoke all on public.journal_chunks_bge from public, anon;
grant select, insert, delete on public.journal_chunks_bge to authenticated;
revoke execute on function public.replace_entry_chunks_bge(uuid, timestamptz, jsonb) from public, anon;
revoke execute on function public.match_journal_chunks_bge(extensions.vector, integer, double precision) from public, anon;
grant execute on function public.replace_entry_chunks_bge(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.match_journal_chunks_bge(extensions.vector, integer, double precision) to authenticated;

-- Enable the existing Retry indexing UI. Journal text, IDs and dates stay intact.
update public.journal_entries
set index_status = 'failed', index_error = 'Reindex required after embedding provider migration', indexed_at = null;

commit;
