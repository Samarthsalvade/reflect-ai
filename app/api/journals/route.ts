export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { error, json, parseBody, requireUser } from "@/lib/api/http";
import { ENTRY_COLUMNS, EntryCreate, type JournalEntry } from "@/lib/journal/schema";
import { indexEntry } from "@/lib/journal/indexing";

export const dynamic = "force-dynamic";

// GET /api/journals — the signed-in user's entries, newest first.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { data, error: dbError } = await auth.supabase
    .from("journal_entries")
    .select("id, title, entry_date, index_status, created_at, updated_at")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (dbError) return error(500, "Could not load entries");
  return json({ entries: data });
}

// POST /api/journals — create, then index for semantic search.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request, EntryCreate);
  if (body instanceof NextResponse) return body;

  // user_id is filled by the column default auth.uid(); RLS rejects anything else.
  const { data: entry, error: dbError } = await auth.supabase
    .from("journal_entries")
    .insert({ ...body, index_status: "pending" })
    .select(ENTRY_COLUMNS)
    .single<JournalEntry>();

  if (dbError || !entry) return error(500, "Could not save entry");

  const indexing = await indexEntry(auth.supabase, entry);
  return json({ entry: { ...entry, index_status: indexing.status }, indexing }, 201);
}
