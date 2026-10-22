"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import type { JournalEntry } from "@/lib/journal/schema";
import { formatEntryDate } from "@/lib/format";
import { EntryForm } from "@/components/journal/EntryForm";
import { IndexBadge } from "@/components/journal/IndexBadge";

type Props = { entry: JournalEntry; indexingFailed?: boolean; highlight?: string };

export function EntryView({ entry, indexingFailed, highlight }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"delete" | "reindex" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);

  async function remove() {
    setBusy("delete");
    const res = await fetch(`/api/journals/${entry.id}`, { method: "DELETE" });
    if (res.ok || res.status === 404) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setBusy(null);
      setConfirmDelete(false);
      setMessage("Couldn't delete the entry. Please try again.");
    }
  }

  async function reindex() {
    setBusy("reindex");
    setMessage(null);
    const res = await fetch(`/api/journals/${entry.id}/reindex`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (body.indexing?.status === "ready") {
      router.replace(`/journal/${entry.id}`);
      router.refresh();
    } else {
      setMessage(body.indexing?.error ?? "Indexing failed again. Check the OpenAI configuration.");
    }
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-3xl font-semibold">Edit entry</h1>
        <EntryForm initial={entry} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  const showFailed = indexingFailed || entry.index_status === "failed";

  return (
    <article className="space-y-4">
      {showFailed ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">Your entry is saved, but it isn&apos;t searchable by Ask my journal yet.</span>
          <button type="button" className="btn-ghost px-2.5 py-1" onClick={reindex} disabled={busy !== null}>
            {busy === "reindex" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            Retry indexing
          </button>
        </div>
      ) : null}

      <div className="card p-5 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-stone-500">{formatEntryDate(entry.entry_date)}</p>
            <h1 className="mt-1 break-words font-serif text-3xl font-semibold">{entry.title}</h1>
          </div>
          <IndexBadge status={entry.index_status} />
        </header>

        <div className="mt-6 whitespace-pre-wrap break-words font-serif text-lg leading-relaxed text-stone-800 dark:text-stone-200">
          <Highlighted text={entry.content} phrase={highlight} markRef={markRef} />
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-4 dark:border-stone-800">
          {message ? <p role="alert" className="mr-auto text-sm text-red-600">{message}</p> : null}
          {confirmDelete ? (
            <>
              <span className="mr-auto text-sm text-stone-600 dark:text-stone-400">
                Delete this entry and its search index? This can&apos;t be undone.
              </span>
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy !== null}>
                Keep it
              </button>
              <button type="button" className="btn-danger" onClick={remove} disabled={busy !== null}>
                {busy === "delete" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
                Delete
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-ghost text-red-600 dark:text-red-400" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden />
                Delete
              </button>
              <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </button>
            </>
          )}
        </footer>
      </div>
    </article>
  );
}

// Highlights the cited passage when arriving from an AI answer (?hl=...).
// Matching ignores whitespace differences because excerpts are whitespace-normalised.
function Highlighted({ text, phrase, markRef }: { text: string; phrase?: string; markRef: React.RefObject<HTMLElement | null> }) {
  const words = phrase?.replace(/…$/, "").trim().split(/\s+/).filter(Boolean).slice(0, 12);
  if (!words?.length) return <>{text}</>;
  const pattern = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "i");
  const match = pattern.exec(text);
  if (!match) return <>{text}</>;
  const start = match.index;
  // Extend the highlight to the end of that paragraph for readability.
  const paraEnd = text.indexOf("\n\n", start + match[0].length);
  const end = paraEnd === -1 ? text.length : paraEnd;
  return (
    <>
      {text.slice(0, start)}
      <mark ref={markRef} className="rounded bg-amber-100 px-0.5 text-inherit dark:bg-amber-900/60">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}
