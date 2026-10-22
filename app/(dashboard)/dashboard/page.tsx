import Link from "next/link";
import { NotebookPen, Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { IndexBadge } from "@/components/journal/IndexBadge";
import { formatEntryDate } from "@/lib/format";
import type { IndexStatus } from "@/lib/journal/schema";

export const dynamic = "force-dynamic";

type Row = { id: string; title: string; content: string; entry_date: string; index_status: IndexStatus };

export default async function DashboardPage() {
  const supabase = await createClient();
  // RLS limits this to the signed-in user's rows; no user_id filter is trusted from the client.
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, title, content, entry_date, index_status")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  const entries = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Your journal</h1>
          <p className="mt-1 text-sm text-stone-500">
            {entries.length ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}` : "Nothing here yet"}
          </p>
        </div>
        <Link href="/journal/new" className="btn-primary">
          <Plus className="size-4" aria-hidden />
          New entry
        </Link>
      </div>

      {error ? (
        <p role="alert" className="card p-4 text-sm text-red-700 dark:text-red-300">
          Couldn&apos;t load your entries. Refresh to try again.
        </p>
      ) : entries.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <NotebookPen className="size-10 text-stone-300 dark:text-stone-700" aria-hidden />
          <h2 className="text-lg font-semibold">Write your first entry</h2>
          <p className="max-w-sm text-sm text-stone-500">
            Once you have a few entries, ask questions like “What did I learn this month?” and get answers drawn only from
            your own writing.
          </p>
          <Link href="/journal/new" className="btn-primary mt-2">
            <Plus className="size-4" aria-hidden />
            New entry
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {entries.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/journal/${e.id}`}
                  className="card block p-4 transition hover:border-accent/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        {formatEntryDate(e.entry_date, "short")}
                      </p>
                      <h2 className="mt-1 truncate text-base font-semibold">{e.title}</h2>
                    </div>
                    <IndexBadge status={e.index_status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">{e.content}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/ask-ai" className="card flex items-center gap-3 p-4 text-sm hover:border-accent/40">
            <Sparkles className="size-5 text-accent" aria-hidden />
            <span>
              <span className="font-medium">Ask your journal a question</span>
              <span className="block text-stone-500">Answers cite the entries they came from.</span>
            </span>
          </Link>
        </>
      )}
    </div>
  );
}
