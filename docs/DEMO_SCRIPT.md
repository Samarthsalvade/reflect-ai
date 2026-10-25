# Demo video script (target 2:40)

**Setup before recording**
- Two accounts: run `npm run seed` so both have fictional entries (A has 9, B has 3).
- Two browser windows: normal = Account A, private/incognito = Account B, both signed in.
- Zoom the browser to about 110% and close unrelated tabs. Record with OBS, Loom or the Windows Game Bar (Win+Alt+R).

| Time | Show | Say (roughly) |
|---|---|---|
| 0:00–0:20 | README architecture diagram or the login page | "ReflectAI is a private journal you can ask questions. It's built with Next.js, Supabase with pgvector, Groq chat, and free local Transformers.js BGE embeddings. Answers come only from your own entries, with citations." |
| 0:20–0:40 | Sign in as A → dashboard | "Each user sees only their entries. The green badge means the entry has been chunked, embedded and stored in pgvector." |
| 0:40–1:10 | **New entry** → type a short one ("Booked a trip to Lisbon for November") → save → open it → **Edit** a word → save → **Delete** a throwaway entry | "Saving runs the indexing pipeline: chunk, embed, then swap the vectors atomically. Editing re-indexes, and deleting removes the vectors too." |
| 1:10–1:50 | **Ask my journal** → "How did my interviews go?" → hover an `[S1]` marker → click a source card → the highlighted passage | "The question is embedded and matched against my chunks only. The model answers from those excerpts, and the server drops any citation it didn't retrieve. Clicking a source jumps to that passage." Then ask "What's the capital of Peru?" → "Off-topic questions get no-evidence instead of a guess." |
| 1:50–2:15 | Back to the diagram, or `lib/ai/rag.ts` / `001_initial.sql` | "Embeddings are text-embedding-3-small at 1,536 dimensions. Search is a SECURITY INVOKER Postgres function filtered on auth.uid(), so RLS applies. The chat model only ever sees the top five chunks." |
| 2:15–2:40 | Switch to B's window → Ask "What do you know about Project Atlas?" → no evidence. Paste one of A's `/journal/<id>` URLs → "Entry not found" | "Account A wrote about a secret Project Atlas. Account B gets nothing, either through search or the direct URL. Isolation is enforced in the database, and the integration tests prove it." |

**Tips:** do one dry run first, since the first question after a cold start is slower. Keep the
`.env.local` file and the Supabase dashboard **off screen** so no keys appear in the recording.
