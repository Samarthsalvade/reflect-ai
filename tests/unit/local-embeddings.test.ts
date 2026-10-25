import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pipeline: vi.fn(), extract: vi.fn(), env: {} }));
vi.mock("@huggingface/transformers", () => ({ pipeline: mocks.pipeline, env: mocks.env }));
const vector = Array.from({ length: 384 }, (_, i) => i === 0 ? 2 : 0);
beforeEach(() => {
  delete (globalThis as typeof globalThis & { reflectBgeFp32?: unknown }).reflectBgeFp32;
  vi.resetModules();
  vi.resetAllMocks();
  mocks.pipeline.mockResolvedValue(mocks.extract);
  mocks.extract.mockImplementation(async (texts: string[]) => ({ tolist: () => texts.map(() => vector) }));
});
describe("local BGE embeddings", () => {
  it("skips model loading for empty input", async () => {
    const { embedTexts } = await import("../../lib/ai/local-embeddings");
    expect(await embedTexts([])).toEqual([]);
    expect(mocks.pipeline).not.toHaveBeenCalled();
  });
  it("shares one model load across queries and ordered document batches", async () => {
    const { embedText, embedTexts, QUERY_PREFIX } = await import("../../lib/ai/local-embeddings");
    const docs = Array.from({ length: 9 }, (_, i) => `document ${i}`);
    const [vectors, query] = await Promise.all([embedTexts(docs), embedText("What happened?")]);
    expect(mocks.pipeline).toHaveBeenCalledTimes(1);
    expect(mocks.pipeline).toHaveBeenCalledWith("feature-extraction", "Xenova/bge-small-en-v1.5", { device: "cpu", dtype: "fp32" });
    expect(vectors).toHaveLength(9);
    expect(vectors[0][0]).toBe(1);
    expect(query[0]).toBe(1);
    expect(mocks.extract).toHaveBeenCalledWith(docs.slice(0, 8), { pooling: "cls", normalize: true });
    expect(mocks.extract).toHaveBeenCalledWith([docs[8]], { pooling: "cls", normalize: true });
    expect(mocks.extract).toHaveBeenCalledWith([QUERY_PREFIX + "What happened?"], { pooling: "cls", normalize: true });
  });
  it.each([[], [Array(1536).fill(1)], [Array(384).fill(0)], [[[1, 2]]], [Array(384).fill(NaN)]].map(rows => ({ rows })))("rejects malformed output $rows", async ({ rows }) => {
    mocks.extract.mockResolvedValue({ tolist: () => rows });
    const { embedTexts } = await import("../../lib/ai/local-embeddings");
    await expect(embedTexts(["document"])).rejects.toThrow();
  });
  it("reuses the loaded model after a development module reload", async () => {
    const first = await import("../../lib/ai/local-embeddings");
    await first.embedTexts(["document"]);
    vi.resetModules();
    const reloaded = await import("../../lib/ai/local-embeddings");
    await reloaded.embedText("question");
    expect(mocks.pipeline).toHaveBeenCalledTimes(1);
  });
  it("retries a failed model load and hides raw errors", async () => {
    mocks.pipeline.mockRejectedValueOnce(new Error("secret/private text"));
    const { embedTexts } = await import("../../lib/ai/local-embeddings");
    await expect(embedTexts(["document"])).rejects.toThrow("Local embedding model could not load");
    expect(await embedTexts(["document"])).toHaveLength(1);
    expect(mocks.pipeline).toHaveBeenCalledTimes(2);
  });
  it("rejects non-finite SQL vectors and redacts inference failures", async () => {
    const { embedTexts, toPgVector } = await import("../../lib/ai/local-embeddings");
    expect(() => toPgVector([...vector.slice(1), Infinity])).toThrow();
    mocks.extract.mockRejectedValue(new Error("private journal"));
    await expect(embedTexts(["document"])).rejects.toThrow("Local embedding inference failed. Please retry.");
  });
});
