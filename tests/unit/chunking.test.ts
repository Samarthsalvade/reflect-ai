import { describe, expect, it } from "vitest";
import { chunkText, embeddingInput } from "@/lib/ai/chunking";

const sentence = (i: number) => `This is sentence number ${i} about learning something new today.`;
const longText = (n: number) => Array.from({ length: n }, (_, i) => sentence(i)).join(" ");

describe("chunkText", () => {
  it("returns nothing for blank input", () => {
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("keeps short entries as a single chunk", () => {
    expect(chunkText("A short day. Nothing much happened.")).toEqual(["A short day. Nothing much happened."]);
  });

  it("never exceeds maxChars", () => {
    const chunks = chunkText(longText(200), { maxChars: 500, overlapChars: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(500);
  });

  it("overlaps consecutive chunks", () => {
    const chunks = chunkText(longText(60), { maxChars: 400, overlapChars: 120 });
    for (let i = 1; i < chunks.length; i++) {
      const lastSentenceOfPrev = chunks[i - 1].split(/(?<=\.)\s/).pop()!;
      expect(chunks[i].startsWith(lastSentenceOfPrev)).toBe(true);
    }
  });

  it("covers every sentence of the source", () => {
    const text = longText(80);
    const joined = chunkText(text, { maxChars: 450, overlapChars: 100 }).join(" ");
    for (let i = 0; i < 80; i++) expect(joined).toContain(sentence(i));
  });

  it("hard-splits a single giant sentence on word boundaries", () => {
    const giant = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(giant, { maxChars: 300, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(300);
    expect(chunks.join(" ")).toContain("word399");
  });

  it("splits a pathological unbroken string", () => {
    const chunks = chunkText("x".repeat(1000), { maxChars: 300, overlapChars: 50 });
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(300);
    expect(chunks.join("").replace(/\s/g, "").length).toBeGreaterThanOrEqual(1000);
  });
});

describe("embeddingInput", () => {
  it("prefixes title and date", () => {
    expect(embeddingInput("Interview day", "2026-03-04", "It went well.")).toBe("Interview day (2026-03-04)\n\nIt went well.");
  });
});
