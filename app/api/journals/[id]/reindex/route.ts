export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { error, json, requireUser } from "@/lib/api/http";
import { ENTRY_COLUMNS, EntryId, type JournalEntry } from "@/lib/journal/schema";
import { indexEntry } from "@/lib/journal/indexing";

export const dynamic = "force-dynamic";

// POST /api/journals/[id]/reindex — retry after an indexing failure.
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  if (!EntryId.safeParse(id).success) return error(404, "Entry not found");

  const { data: entry } = await auth.supabase
    .from("journal_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", id)
    .maybeSingle<JournalEntry>();
  if (!entry) return error(404, "Entry not found");

  const indexing = await indexEntry(auth.supabase, entry);
  return json({ indexing });
}
