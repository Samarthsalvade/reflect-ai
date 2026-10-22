import { describe, expect, it } from "vitest";
import { labelChunks, resolveSources, stripUnknownMarkers } from "@/lib/ai/citations";

const retrieved = labelChunks([
  { entry_id: "e1", title: "Interview", entry_date: "2026-03-01", content: "The panel asked about system design.", similarity: 0.81 },
  { entry_id: "e2", title: "Pottery", entry_date: "2026-03-05", content: "First bowl came out lopsided.", similarity: 0.62 },
  { entry_id: "e1", title: "Interview", entry_date: "2026-03-01", content: "I followed up with a thank-you note.", similarity: 0.55 },
]);

describe("labelChunks", () => {
  it("labels S1..Sn in retrieval order", () => {
    expect(retrieved.map((c) => c.label)).toEqual(["S1", "S2", "S3"]);
  });
});

describe("resolveSources", () => {
  it("only returns sources that were actually retrieved", () => {
    const sources = resolveSources(["S2", "S9", "S1", "bogus"], retrieved);
    expect(sources.map((s) => s.label)).toEqual(["S2", "S1"]);
    expect(sources.map((s) => s.entryId)).toEqual(["e2", "e1"]);
  });

  it("accepts bracketed and lower-case labels and de-duplicates", () => {
    const sources = resolveSources(["[s1]", "S1", " S3 "], retrieved);
    expect(sources.map((s) => s.label)).toEqual(["S1", "S3"]);
  });

  it("returns nothing when the model cites nothing valid", () => {
    expect(resolveSources(["S4"], retrieved)).toEqual([]);
  });
});

describe("stripUnknownMarkers", () => {
  it("removes markers for chunks that were never retrieved", () => {
    expect(stripUnknownMarkers("You had an interview [S1] and a party [S7].", retrieved)).toBe(
      "You had an interview [S1] and a party .",
    );
  });
});
