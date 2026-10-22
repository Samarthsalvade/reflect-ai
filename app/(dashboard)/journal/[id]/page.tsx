import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ENTRY_COLUMNS, EntryId, type JournalEntry } from "@/lib/journal/schema";
import { EntryView } from "@/components/journal/EntryView";

export const dynamic = "force-dynamic";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ indexing?: string; hl?: string }>;
}) {
  const { id } = await params;
  const { indexing, hl } = await searchParams;
  if (!EntryId.safeParse(id).success) notFound();

  const supabase = await createClient();
  // RLS: another user's entry simply isn't returned → 404, never their content.
  const { data: entry } = await supabase.from("journal_entries").select(ENTRY_COLUMNS).eq("id", id).maybeSingle<JournalEntry>();
  if (!entry) notFound();

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
        <ArrowLeft className="size-4" aria-hidden />
        Back to journal
      </Link>
      <EntryView entry={entry} indexingFailed={indexing === "failed"} highlight={hl} />
    </div>
  );
}
