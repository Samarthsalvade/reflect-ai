// Multi-tenant security tests against a real Supabase project.
// They talk to the database exactly as the app does (publishable key + a signed-in
// user), so RLS and the SECURITY INVOKER functions are what's being tested.
// No OpenAI calls: vectors are synthetic, which also makes similarity deterministic.
//
//   npm run test:integration
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_* and TEST_USER_A/B_* (two
// confirmed accounts). Skips when they are missing.
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const env = process.env;
const configured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL &&
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    env.TEST_USER_A_EMAIL &&
    env.TEST_USER_A_PASSWORD &&
    env.TEST_USER_B_EMAIL &&
    env.TEST_USER_B_PASSWORD,
);

// A unit vector pointing along one axis: cosine similarity 1 with itself, 0 with other axes.
const axis = (i: number) => `[${Array.from({ length: 1536 }, (_, j) => (j === i ? 1 : 0)).join(",")}]`;

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for a test user: ${error.message}`);
  return client;
}

type Entry = { id: string; updated_at: string };

describe.skipIf(!configured)("tenant isolation (RLS + RPC)", () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let anon: SupabaseClient;
  let entry: Entry;

  beforeAll(async () => {
    a = await signIn(env.TEST_USER_A_EMAIL!, env.TEST_USER_A_PASSWORD!);
    b = await signIn(env.TEST_USER_B_EMAIL!, env.TEST_USER_B_PASSWORD!);
    anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data, error } = await a
      .from("journal_entries")
      .insert({ title: "[test] Project Atlas", content: "My secret project is Project Atlas.", entry_date: "2026-01-15" })
      .select("id, updated_at")
      .single<Entry>();
    if (error) throw error;
    entry = data;

    const { data: applied, error: rpcError } = await a.rpc("replace_entry_chunks", {
      p_entry_id: entry.id,
      p_expected_updated_at: entry.updated_at,
      p_chunks: [{ chunk_index: 0, content: "My secret project is Project Atlas.", embedding: axis(7) }],
    });
    if (rpcError) throw rpcError;
    expect(applied).toBe(true);
  });

  afterAll(async () => {
    if (entry) await a.from("journal_entries").delete().eq("id", entry.id);
  });

  it("owner can read their entry and its chunks", async () => {
    const { data } = await a.from("journal_entries").select("id, index_status").eq("id", entry.id).single();
    expect(data?.index_status).toBe("ready");
    const { count } = await a.from("journal_chunks").select("id", { count: "exact", head: true }).eq("entry_id", entry.id);
    expect(count).toBe(1);
  });

  it("another user cannot read, update or delete the entry by ID", async () => {
    const read = await b.from("journal_entries").select("*").eq("id", entry.id);
    expect(read.data).toEqual([]);

    const upd = await b.from("journal_entries").update({ title: "hijacked" }).eq("id", entry.id).select("id");
    expect(upd.data ?? []).toEqual([]);

    const del = await b.from("journal_entries").delete().eq("id", entry.id).select("id");
    expect(del.data ?? []).toEqual([]);

    const still = await a.from("journal_entries").select("title").eq("id", entry.id).single();
    expect(still.data?.title).toBe("[test] Project Atlas");
  });

  it("another user cannot read the chunks directly", async () => {
    const { data } = await b.from("journal_chunks").select("content").eq("entry_id", entry.id);
    expect(data).toEqual([]);
  });

  it("semantic search never returns another user's chunks", async () => {
    // Same query vector as A's chunk: a perfect match if isolation were broken.
    const own = await a.rpc("match_journal_chunks", { query_embedding: axis(7), match_count: 5, match_threshold: 0.5 });
    expect(own.error).toBeNull();
    expect((own.data ?? []).map((r: { entry_id: string }) => r.entry_id)).toContain(entry.id);

    const other = await b.rpc("match_journal_chunks", { query_embedding: axis(7), match_count: 10, match_threshold: 0 });
    expect(other.error).toBeNull();
    expect((other.data ?? []).some((r: { entry_id: string }) => r.entry_id === entry.id)).toBe(false);
  });

  it("another user cannot write chunks into someone else's entry", async () => {
    const res = await b.rpc("replace_entry_chunks", {
      p_entry_id: entry.id,
      p_expected_updated_at: entry.updated_at,
      p_chunks: [{ chunk_index: 0, content: "injected", embedding: axis(1) }],
    });
    expect(res.error).not.toBeNull();

    const direct = await b
      .from("journal_chunks")
      .insert({ entry_id: entry.id, chunk_index: 99, content: "injected", embedding: axis(1) });
    expect(direct.error).not.toBeNull();
  });

  it("anonymous callers get nothing", async () => {
    const read = await anon.from("journal_entries").select("id").eq("id", entry.id);
    expect(read.data ?? []).toEqual([]);
    const rpc = await anon.rpc("match_journal_chunks", { query_embedding: axis(7) });
    expect(rpc.error).not.toBeNull();
  });

  it("re-indexing replaces old vectors and rejects a stale version", async () => {
    const { data: edited } = await a
      .from("journal_entries")
      .update({ content: "Project Atlas is now called Project Borealis." })
      .eq("id", entry.id)
      .select("id, updated_at")
      .single<Entry>();
    expect(edited!.updated_at).not.toBe(entry.updated_at);

    // An embedding job that started before the edit must not overwrite the index.
    const stale = await a.rpc("replace_entry_chunks", {
      p_entry_id: entry.id,
      p_expected_updated_at: entry.updated_at,
      p_chunks: [{ chunk_index: 0, content: "stale", embedding: axis(3) }],
    });
    expect(stale.data).toBe(false);

    const fresh = await a.rpc("replace_entry_chunks", {
      p_entry_id: entry.id,
      p_expected_updated_at: edited!.updated_at,
      p_chunks: [
        { chunk_index: 0, content: "Project Atlas is now called", embedding: axis(9) },
        { chunk_index: 1, content: "Project Borealis.", embedding: axis(10) },
      ],
    });
    expect(fresh.data).toBe(true);

    const { data: chunks } = await a.from("journal_chunks").select("content").eq("entry_id", entry.id).order("chunk_index");
    expect(chunks?.map((c) => c.content)).toEqual(["Project Atlas is now called", "Project Borealis."]);

    // The superseded vector is gone from search.
    const old = await a.rpc("match_journal_chunks", { query_embedding: axis(7), match_count: 5, match_threshold: 0.5 });
    expect((old.data ?? []).some((r: { entry_id: string }) => r.entry_id === entry.id)).toBe(false);

    entry = edited!;
  });

  it("deleting an entry removes its vectors", async () => {
    const { data: tmp } = await a
      .from("journal_entries")
      .insert({ title: "[test] temp", content: "temporary", entry_date: "2026-01-16" })
      .select("id, updated_at")
      .single<Entry>();
    await a.rpc("replace_entry_chunks", {
      p_entry_id: tmp!.id,
      p_expected_updated_at: tmp!.updated_at,
      p_chunks: [{ chunk_index: 0, content: "temporary", embedding: axis(20) }],
    });

    await a.from("journal_entries").delete().eq("id", tmp!.id);
    const { count } = await a.from("journal_chunks").select("id", { count: "exact", head: true }).eq("entry_id", tmp!.id);
    expect(count).toBe(0);
    const search = await a.rpc("match_journal_chunks", { query_embedding: axis(20), match_count: 5, match_threshold: 0.5 });
    expect(search.data ?? []).toEqual([]);
  });
});
