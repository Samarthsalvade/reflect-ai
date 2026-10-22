// Pure helpers for labelling retrieved chunks and validating the model's citations.
// Kept free of server-only imports so they can be unit-tested.

export type LabelledChunk = {
  label: string; // "S1", "S2", ...
  entry_id: string;
  title: string;
  entry_date: string;
  content: string;
  similarity: number;
};

export type Source = {
  label: string;
  entryId: string;
  title: string;
  entryDate: string;
  excerpt: string;
  similarity: number;
};

export function labelChunks<T extends Omit<LabelledChunk, "label">>(chunks: T[]): (T & { label: string })[] {
  return chunks.map((c, i) => ({ ...c, label: `S${i + 1}` }));
}

// Keeps only citations that point at chunks we actually retrieved, in first-cited
// order, de-duplicated. Anything the model invents is dropped.
export function resolveSources(cited: string[], chunks: LabelledChunk[]): Source[] {
  const byLabel = new Map(chunks.map((c) => [c.label.toUpperCase(), c]));
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const raw of cited) {
    const label = raw.trim().replace(/^\[|\]$/g, "").toUpperCase();
    const chunk = byLabel.get(label);
    if (!chunk || seen.has(label)) continue;
    seen.add(label);
    out.push({
      label: chunk.label,
      entryId: chunk.entry_id,
      title: chunk.title,
      entryDate: chunk.entry_date,
      excerpt: excerpt(chunk.content),
      similarity: Math.round(chunk.similarity * 1000) / 1000,
    });
  }
  return out;
}

// Removes [S7]-style markers that don't correspond to a retrieved chunk.
export function stripUnknownMarkers(answer: string, chunks: LabelledChunk[]): string {
  const valid = new Set(chunks.map((c) => c.label.toUpperCase()));
  return answer
    .replace(/\[(S\d+)\]/gi, (marker, label: string) => (valid.has(label.toUpperCase()) ? marker : ""))
    .replace(/ {2,}/g, " ")
    .trim();
}

function excerpt(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}
