// Read lazily so `next build` works without secrets; missing values fail at request time.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function numberOr(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
};

export const serverEnv = {
  groqKey: () => required("GROQ_API_KEY"),
  chatModel: () => process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b",
  askLimitPerHour: () => numberOr("AI_ASK_LIMIT_PER_HOUR", 30),
  matchThreshold: () => numberOr("RAG_MATCH_THRESHOLD", 0.65),
  matchCount: () => numberOr("RAG_MATCH_COUNT", 5),
};
