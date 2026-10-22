import type { IndexStatus } from "@/lib/journal/schema";

const STYLES: Record<IndexStatus, { label: string; className: string; title: string }> = {
  ready: {
    label: "Indexed",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    title: "Searchable by Ask my journal",
  },
  pending: {
    label: "Indexing",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    title: "Embeddings are being generated",
  },
  failed: {
    label: "Not indexed",
    className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    title: "Saved, but not yet searchable. Open the entry to retry.",
  },
};

export function IndexBadge({ status }: { status: IndexStatus }) {
  const s = STYLES[status];
  return (
    <span title={s.title} className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
