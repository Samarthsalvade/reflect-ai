import "server-only";
import { openai } from "@/lib/ai/openai";
import { serverEnv } from "@/lib/env";

export const EMBEDDING_DIMENSIONS = 1536;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await openai().embeddings.create({
    model: serverEnv.embeddingModel(),
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const vectors = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error("Embedding response had an unexpected shape");
  }
  return vectors;
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

// pgvector's text input format: "[0.1,0.2,...]".
export function toPgVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
