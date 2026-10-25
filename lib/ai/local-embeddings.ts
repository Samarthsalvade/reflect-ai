// Node-only implementation shared by the server wrapper and seed/smoke scripts.
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import { resolve } from "node:path";

export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
// Keep the expensive model alive across Next.js development module reloads.
// This stores model weights only, never user text, sessions, or query results.
const modelCache = globalThis as typeof globalThis & {
  reflectBgeFp32?: Promise<FeatureExtractionPipeline>;
};

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!modelCache.reflectBgeFp32) {
    modelCache.reflectBgeFp32 = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = resolve(process.env.TRANSFORMERS_CACHE || ".cache/transformers");
      env.allowLocalModels = false;
      return pipeline("feature-extraction", EMBEDDING_MODEL, {
        device: "cpu", dtype: "fp32",
      });
    })().catch(() => {
      modelCache.reflectBgeFp32 = undefined; // A failed download must be retryable.
      throw new Error("Local embedding model could not load. Check network access and the writable model cache, then retry.");
    });
  }
  return modelCache.reflectBgeFp32;
}

export const EMBEDDING_DIMENSIONS = 384;
export const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

export function validateVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS ||
      !value.every((n) => typeof n === "number" && Number.isFinite(n))) {
    throw new Error("Local model returned an invalid 384-dimensional embedding");
  }
  const norm = Math.hypot(...value);
  if (!Number.isFinite(norm) || norm === 0) throw new Error("Local model returned a zero or invalid embedding");
  return value.map((n) => n / norm);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const extractor = await getExtractor();
  const vectors: number[][] = [];
  // Small batches bound CPU memory; order matches journal chunks exactly.
  for (let offset = 0; offset < texts.length; offset += 8) {
    const batch = texts.slice(offset, offset + 8);
    let rows: unknown;
    try {
      const output = await extractor(batch, { pooling: "cls", normalize: true });
      rows = output.tolist();
    } catch {
      throw new Error("Local embedding inference failed. Please retry.");
    }
    if (!Array.isArray(rows) || rows.length !== batch.length) {
      throw new Error("Local model returned an unexpected embedding count");
    }
    vectors.push(...rows.map(validateVector));
  }
  return vectors;
}

// Retrieval queries alone receive BGE's instruction; documents do not.
export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([QUERY_PREFIX + text]);
  return vector;
}

export function toPgVector(vector: number[]): string {
  return `[${validateVector(vector).join(",")}]`;
}
