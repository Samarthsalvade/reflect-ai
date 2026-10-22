import { NextResponse } from "next/server";
import { error, json, parseBody, requireUser } from "@/lib/api/http";
import { ENTRY_COLUMNS, EntryId, EntryUpdate, type JournalEntry } from "@/lib/journal/schema";
import { indexEntry } from "@/lib/journal/indexing";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Another user's entry ID gets the same 404 as a missing one: RLS hides the row,
// so we never confirm that it exists.
const NOT_FOUND = () => error(404, "Entry not found");

async function entryId(ctx: Ctx) {
  const { id } = await ctx.params;
  return EntryId.safeParse(id).success ? id : null;
}

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const id = await entryId(ctx);
  if (!id) return NOT_FOUND();

  const { data, error: dbError } = await auth.supabase
    .from("journal_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", id)
    .maybeSingle<JournalEntry>();

  if (dbError) return error(500, "Could not load entry");
  if (!data) return NOT_FOUND();
  return json({ entry: data });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const id = await entryId(ctx);
  if (!id) return NOT_FOUND();

  const body = await parseBody(request, EntryUpdate);
  if (body instanceof NextResponse) return body;

  const { data: entry, error: dbError } = await auth.supabase
    .from("journal_entries")
    .update({ ...body, index_status: "pending", index_error: null })
    .eq("id", id)
    .select(ENTRY_COLUMNS)
    .maybeSingle<JournalEntry>();

  if (dbError) return error(500, "Could not update entry");
  if (!entry) return NOT_FOUND();

  // Title, date and body all feed the embeddings, so any change re-indexes.
  const indexing = await indexEntry(auth.supabase, entry);
  return json({ entry: { ...entry, index_status: indexing.status }, indexing });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const id = await entryId(ctx);
  if (!id) return NOT_FOUND();

  // journal_chunks.entry_id is ON DELETE CASCADE, so the vectors go with it.
  const { data, error: dbError } = await auth.supabase
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .select("id");

  if (dbError) return error(500, "Could not delete entry");
  if (!data?.length) return NOT_FOUND();
  return json({ deleted: id });
}
