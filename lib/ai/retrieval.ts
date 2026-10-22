import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText, toPgVector } from "@/lib/ai/embeddings";
import { serverEnv } from "@/lib/env";

export type RetrievedChunk = {
  chunk_id: string;
  entry_id: string;
  chunk_index: number;
  content: string;
  title: string;
  entry_date: string;
  similarity: number;
};

// Runs as the signed-in user: match_journal_chunks is SECURITY INVOKER and
// filters on auth.uid(), so another user's chunks are unreachable from here.
export async function retrieveChunks(supabase: SupabaseClient, question: string): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(question);
  const { data, error } = await supabase.rpc("match_journal_chunks", {
    query_embedding: toPgVector(queryEmbedding),
    match_count: serverEnv.matchCount(),
    match_threshold: serverEnv.matchThreshold(),
  });
  if (error) throw new Error(`Similarity search failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}
