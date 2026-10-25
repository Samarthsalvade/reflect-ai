import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../lib/ai/embeddings", () => ({ embedTexts: vi.fn(), embedText: vi.fn(), toPgVector: (v: number[]) => JSON.stringify(v) }));
import { embedTexts, embedText } from "../../lib/ai/embeddings";
import { indexEntry } from "../../lib/journal/indexing";
import { retrieveChunks } from "../../lib/ai/retrieval";

const entry = { id: "entry", title: "Title", content: "Journal text", entry_date: "2026-01-01", updated_at: "2026-01-01T00:00:00.123456Z" };
afterEach(() => vi.restoreAllMocks());

it("replaces BGE chunks only after embeddings succeed, with the exact version token", async () => {
  vi.mocked(embedTexts).mockResolvedValue([[1, 0]]);
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  expect(await indexEntry({ rpc } as unknown as SupabaseClient, entry)).toEqual({ status: "ready", chunks: 1 });
  expect(rpc).toHaveBeenCalledWith("replace_entry_chunks_bge", {
    p_entry_id: entry.id, p_expected_updated_at: entry.updated_at,
    p_chunks: [{ chunk_index: 0, content: entry.content, embedding: "[1,0]" }],
  });
});
it("preserves existing vectors when the embedding provider fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(embedTexts).mockRejectedValue(new Error("Provider unavailable"));
  const rpc = vi.fn();
  const eq = vi.fn(); eq.mockReturnValue({ eq });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  expect((await indexEntry({ rpc, from } as unknown as SupabaseClient, entry)).status).toBe("failed");
  expect(rpc).not.toHaveBeenCalled();
  expect(from).toHaveBeenCalledWith("journal_entries");
  expect(eq).toHaveBeenCalledWith("updated_at", entry.updated_at);
});
it("reports a stale indexing job as pending", async () => {
  vi.mocked(embedTexts).mockResolvedValue([[1, 0]]);
  const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
  expect((await indexEntry({ rpc } as unknown as SupabaseClient, entry)).status).toBe("pending");
});
it("retrieves through the same BGE index", async () => {
  vi.mocked(embedText).mockResolvedValue([1, 0]);
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
  expect(await retrieveChunks({ rpc } as unknown as SupabaseClient, "question")).toEqual([]);
  expect(embedText).toHaveBeenCalledWith("question");
  expect(rpc).toHaveBeenCalledWith("match_journal_chunks_bge", expect.objectContaining({ query_embedding: "[1,0]" }));
});
