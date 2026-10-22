// Seeds two demo accounts with FICTIONAL journal entries so retrieval and tenant
// isolation are easy to show in the demo video.
//
//   1. Sign up two accounts in the app (TEST_USER_A_* and TEST_USER_B_* in .env.local).
//   2. npm run seed
//
// Re-running replaces only the entries this script created (titles start with "◆ ").
import { config } from "dotenv";
import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chunkText, embeddingInput } from "../lib/ai/chunking";

config({ path: ".env.local" });

const MARK = "◆ ";

type Seed = { title: string; entry_date: string; content: string };

const ACCOUNT_A: Seed[] = [
  {
    title: "Mock interview with a friend",
    entry_date: "2026-09-02",
    content:
      "Did a mock system-design interview over video. I froze on the caching layer and forgot to talk about cache invalidation until the very end. The feedback was that my API design was clean but I should state capacity estimates up front. Writing down: always start with requirements, then numbers, then the diagram.",
  },
  {
    title: "Started learning pgvector",
    entry_date: "2026-09-05",
    content:
      "Spent the evening reading about vector databases. Cosine distance finally clicked when I drew two arrows on paper. HNSW indexes trade a little accuracy for a lot of speed. I want to build something small with embeddings this month.",
  },
  {
    title: "Pottery class, week three",
    entry_date: "2026-09-09",
    content:
      "My bowl collapsed on the wheel again, but the instructor showed me how to brace my elbow against my knee. The second attempt held its shape. There is something calming about an hour where my phone is in a locker.",
  },
  {
    title: "Project Atlas kickoff",
    entry_date: "2026-09-12",
    content:
      "My secret side project is called Project Atlas: a tiny app that maps the walking routes I take every weekend. Nobody knows about it yet. I sketched the data model tonight and decided to store routes as GeoJSON.",
  },
  {
    title: "Real interview — round one",
    entry_date: "2026-09-18",
    content:
      "First real interview of the month. This time I opened with requirements and rough numbers, exactly like I practised. They asked how I would rate-limit an API and I talked through a token bucket. I felt calm. They said I would hear back next week.",
  },
  {
    title: "Long run along the river",
    entry_date: "2026-09-21",
    content:
      "Ran 12 km, my longest this year. The last two kilometres were hard but I kept a steady pace by counting breaths. Afterwards I stretched for twenty minutes and my knees thanked me.",
  },
  {
    title: "Atlas milestone: first route rendered",
    entry_date: "2026-09-27",
    content:
      "Project Atlas rendered its first walking route on a map tonight. The line was jagged because I forgot to sort the GPS points by timestamp. Fixed it and the route looked right. Next: elevation profile.",
  },
  {
    title: "Got the offer",
    entry_date: "2026-10-03",
    content:
      "They called with an offer! The hiring manager said my structured approach in the system-design round stood out. I am excited but want to negotiate the start date so I can finish the pottery course.",
  },
  {
    title: "What I learned in September",
    entry_date: "2026-10-05",
    content:
      "Looking back: practising interviews out loud made the biggest difference. Learning embeddings was more fun than expected. Pottery taught me patience. I want to keep running twice a week and ship Atlas before winter.",
  },
];

const ACCOUNT_B: Seed[] = [
  {
    title: "Sourdough experiment",
    entry_date: "2026-09-10",
    content:
      "Fed the starter twice today. The loaf rose beautifully but the crumb was dense; next time I will extend the bulk ferment by an hour.",
  },
  {
    title: "Weekend hike",
    entry_date: "2026-09-20",
    content:
      "Hiked to the waterfall with my cousin. We saw two herons and got caught in a short rain shower. Packed lunch tasted amazing at the top.",
  },
  {
    title: "Learning Spanish",
    entry_date: "2026-10-01",
    content:
      "Day thirty of my language streak. I can now order food and ask for directions. The subjunctive still confuses me.",
  },
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} in .env.local`);
  return v;
}

const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

async function signIn(email: string, password: string) {
  const client = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return client;
}

async function seed(label: string, client: SupabaseClient, entries: Seed[]) {
  // RLS scopes this delete to the signed-in user's own rows.
  await client.from("journal_entries").delete().like("title", `${MARK}%`);

  for (const e of entries) {
    const { data: row, error } = await client
      .from("journal_entries")
      .insert({ ...e, title: `${MARK}${e.title}` })
      .select("id, title, content, entry_date, updated_at")
      .single();
    if (error) throw error;

    const chunks = chunkText(row.content);
    const res = await openai.embeddings.create({
      model: embeddingModel,
      dimensions: 1536,
      input: chunks.map((c) => embeddingInput(row.title, row.entry_date, c)),
    });
    const { error: rpcError } = await client.rpc("replace_entry_chunks", {
      p_entry_id: row.id,
      p_expected_updated_at: row.updated_at,
      p_chunks: chunks.map((content, i) => ({
        chunk_index: i,
        content,
        embedding: `[${res.data[i].embedding.join(",")}]`,
      })),
    });
    if (rpcError) throw rpcError;
  }
  console.log(`${label}: seeded ${entries.length} entries`);
}

async function main() {
  const a = await signIn(requireEnv("TEST_USER_A_EMAIL"), requireEnv("TEST_USER_A_PASSWORD"));
  const b = await signIn(requireEnv("TEST_USER_B_EMAIL"), requireEnv("TEST_USER_B_PASSWORD"));
  await seed("Account A", a, ACCOUNT_A);
  await seed("Account B", b, ACCOUNT_B);
  console.log('Try as A: "How did my interviews go?"  Then as B: "What do you know about Project Atlas?"');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
