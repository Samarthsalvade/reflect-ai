// Splits journal text into overlapping chunks for embedding.
// Conservative character windows leave room for title/date within BGE’s 512-token
// context. Token-dense input may still be truncated by the provider.

export type ChunkOptions = { maxChars?: number; overlapChars?: number };

export const DEFAULT_MAX_CHARS = 1000;
export const DEFAULT_OVERLAP_CHARS = 150;

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = Math.min(options.overlapChars ?? DEFAULT_OVERLAP_CHARS, Math.floor(maxChars / 2));

  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const units = splitIntoUnits(normalized, maxChars);
  const chunks: string[] = [];
  let current: string[] = [];

  const joinedLength = (parts: string[]) => parts.reduce((n, p, i) => n + p.length + (i ? 1 : 0), 0);

  for (const unit of units) {
    if (current.length && joinedLength([...current, unit]) > maxChars) {
      chunks.push(current.join(" "));
      // Carry the tail of the previous chunk forward as overlap.
      const carried: string[] = [];
      for (let i = current.length - 1; i >= 0; i--) {
        if (joinedLength([current[i], ...carried]) > overlapChars) break;
        carried.unshift(current[i]);
      }
      // Never let overlap + next unit exceed the limit.
      while (carried.length && joinedLength([...carried, unit]) > maxChars) carried.shift();
      current = carried;
    }
    current.push(unit);
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}

// Sentences are the packing unit; a sentence longer than maxChars is
// hard-split on word boundaries.
function splitIntoUnits(text: string, maxChars: number): string[] {
  const sentences = text
    .split(/\n\n+/)
    .flatMap((para) => para.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g) ?? [para])
    .map((s) => s.trim())
    .filter(Boolean);

  return sentences.flatMap((s) => (s.length <= maxChars ? [s] : hardSplit(s, maxChars)));
}

function hardSplit(sentence: string, maxChars: number): string[] {
  const out: string[] = [];
  let buf = "";
  for (const word of sentence.split(" ")) {
    if (word.length > maxChars) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      for (let i = 0; i < word.length; i += maxChars) out.push(word.slice(i, i + maxChars));
      continue;
    }
    const next = buf ? `${buf} ${word}` : word;
    if (next.length > maxChars) {
      out.push(buf);
      buf = word;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
}

// What actually gets embedded: the chunk plus the entry's title and date, so
// questions like "what did I write in March about interviews" can match.
export function embeddingInput(title: string, entryDate: string, chunk: string): string {
  return `${title} (${entryDate})\n\n${chunk}`;
}
