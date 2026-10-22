"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUp, BookMarked, Loader2, SearchX } from "lucide-react";
import type { Source } from "@/lib/ai/citations";
import { formatEntryDate } from "@/lib/format";

type Turn = {
  id: number;
  question: string;
  status: "loading" | "done" | "error";
  answer?: string;
  sources?: Source[];
  grounded?: boolean;
  error?: string;
};

const SUGGESTIONS = [
  "What have I been learning lately?",
  "How did my interviews go?",
  "What made me happiest this month?",
  "What progress did I make on my project?",
];

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextId = useRef(1);
  const busy = turns.some((t) => t.status === "loading");

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    const id = nextId.current++;
    setTurns((prev) => [{ id, question: text, status: "loading" }, ...prev]);
    setQuestion("");

    const update = (patch: Partial<Turn>) => setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return update({ status: "error", error: body.error ?? "Something went wrong" });
      update({ status: "done", answer: body.answer, sources: body.sources, grounded: body.grounded });
    } catch {
      update({ status: "error", error: "Network error. Please try again." });
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="card flex items-end gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="question" className="sr-only">Your question</label>
        <textarea
          id="question"
          rows={2}
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
          placeholder="Ask anything about what you've written…"
          className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-stone-400"
        />
        <button type="submit" className="btn-primary size-10 shrink-0 p-0" disabled={busy || question.trim().length < 3} aria-label="Ask">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
        </button>
      </form>

      {turns.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-600 transition hover:border-accent/40 hover:text-accent dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <ol className="space-y-6" aria-live="polite">
        {turns.map((t) => (
          <li key={t.id} className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-4 py-2 text-sm text-white">{t.question}</p>
            <TurnAnswer turn={t} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function TurnAnswer({ turn }: { turn: Turn }) {
  if (turn.status === "loading") {
    return (
      <div className="card flex items-center gap-2 p-4 text-sm text-stone-500">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Searching your journal…
      </div>
    );
  }
  if (turn.status === "error") {
    return <div role="alert" className="card p-4 text-sm text-red-700 dark:text-red-300">{turn.error}</div>;
  }
  if (!turn.grounded) {
    return (
      <div className="card flex items-start gap-3 p-4 text-sm text-stone-600 dark:text-stone-400">
        <SearchX className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{turn.answer}</p>
      </div>
    );
  }

  const sources = turn.sources ?? [];
  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <p className="leading-relaxed">
        <AnswerWithCitations answer={turn.answer ?? ""} sources={sources} />
      </p>
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
          <BookMarked className="size-3.5" aria-hidden />
          Sources
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {sources.map((s) => (
            <li key={s.label}>
              <Link
                href={sourceHref(s)}
                className="block h-full rounded-xl border border-stone-200 p-3 text-sm transition hover:border-accent/50 hover:bg-accent/5 dark:border-stone-800"
              >
                <span className="flex items-center gap-2">
                  <span className="rounded bg-accent/10 px-1.5 text-xs font-semibold text-accent">{s.label}</span>
                  <span className="truncate font-medium">{s.title}</span>
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">{formatEntryDate(s.entryDate, "short")}</span>
                <span className="mt-1 line-clamp-2 block text-stone-600 dark:text-stone-400">{s.excerpt}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function sourceHref(s: Source) {
  const hl = s.excerpt.split(/\s+/).slice(0, 12).join(" ");
  return `/journal/${s.entryId}?hl=${encodeURIComponent(hl)}`;
}

// Turns "[S1]" markers in the answer into links to the cited entry.
function AnswerWithCitations({ answer, sources }: { answer: string; sources: Source[] }) {
  const byLabel = new Map(sources.map((s) => [s.label.toUpperCase(), s]));
  const parts = answer.split(/(\[S\d+\])/gi);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[(S\d+)\]$/i.exec(part);
        const source = m ? byLabel.get(m[1].toUpperCase()) : undefined;
        if (!m) return <span key={i}>{part}</span>;
        if (!source) return null;
        return (
          <Link
            key={i}
            href={sourceHref(source)}
            title={`${source.title} · ${formatEntryDate(source.entryDate, "short")}`}
            className="mx-0.5 inline-block rounded bg-accent/10 px-1 align-super text-[0.7em] font-semibold text-accent hover:bg-accent/20"
          >
            {source.label}
          </Link>
        );
      })}
    </>
  );
}
