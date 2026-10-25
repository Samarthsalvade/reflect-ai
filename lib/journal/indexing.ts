import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText, embeddingInput } from "@/lib/ai/chunking";
import { embedTexts, toPgVector } from "@/lib/ai/embeddings";
import type { IndexStatus, JournalEntry } from "@/lib/journal/schema";

type IndexableEntry = Pick<JournalEntry, "id" | "title" | "content" | "entry_date" | "updated_at">;

export type IndexOutcome = { status: IndexStatus; error?: string; chunks?: number };

// Chunk → embed → atomically swap vectors.
// Embeddings are built BEFORE anything is deleted, so if local inference fails the
// entry keeps its last working index and is flagged "failed" for a retry.
export async function indexEntry(supabase: SupabaseClient, entry: IndexableEntry): Promise<IndexOutcome> {
  try {
    const chunks = chunkText(entry.content);
    const vectors = await embedTexts(chunks.map((c) => embeddingInput(entry.title, entry.entry_date, c)));

    const payload = chunks.map((content, i) => ({
      chunk_index: i,
      content,
      embedding: toPgVector(vectors[i]),
    }));

    const { data: applied, error } = await supabase.rpc("replace_entry_chunks_bge", {
      p_entry_id: entry.id,
      // Passed back verbatim (microsecond precision) — never round-tripped through Date.
      p_expected_updated_at: entry.updated_at,
      p_chunks: payload,
    });
    if (error) throw new Error(error.message);

    // false = the entry was edited again meanwhile; that request owns indexing now.
    return applied ? { status: "ready", chunks: chunks.length } : { status: "pending" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed";
    console.error(`[indexing] entry ${entry.id}:`, message);
    await supabase
      .from("journal_entries")
      .update({ index_status: "failed", index_error: message.slice(0, 500) })
      .eq("id", entry.id)
      .eq("updated_at", entry.updated_at);
    return { status: "failed", error: "Your entry is saved, but it couldn't be indexed for AI search yet." };
  }
}
