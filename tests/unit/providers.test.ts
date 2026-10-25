import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { chatCompletion } from "../../lib/ai/groq";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GROQ_API_KEY", "test-groq-token");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
const reply = (body: unknown) => fetchMock.mockImplementation(async () => new Response(JSON.stringify(body)));

describe("Groq chat", () => {
  it("uses Groq with JSON mode and a server token", async () => {
    reply({ choices: [{ message: { content: '{"answer":"hello"}' } }] });
    expect(await chatCompletion([{ role: "user", content: "question" }])).toContain("hello");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
    const request = fetchMock.mock.calls[0][1];
    expect(request.headers.Authorization).toBe("Bearer test-groq-token");
    expect(JSON.parse(request.body).response_format).toEqual({ type: "json_object" });
  });
  it("rejects empty completions", async () => {
    reply({ choices: [] });
    await expect(chatCompletion([])).rejects.toThrow("unreadable");
  });
  it("redacts network errors", async () => {
    fetchMock.mockRejectedValue(new Error("test-groq-token"));
    await expect(chatCompletion([])).rejects.toThrow("Groq request failed or returned invalid JSON");
  });
});
