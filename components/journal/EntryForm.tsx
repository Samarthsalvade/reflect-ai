"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { todayIso } from "@/lib/format";

type Initial = { id?: string; title: string; content: string; entry_date: string };
type FieldErrors = Partial<Record<"title" | "content" | "entry_date", string>>;

export function EntryForm({ initial, onCancel }: { initial?: Initial; onCancel?: () => void }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [entryDate, setEntryDate] = useState(initial?.entry_date ?? todayIso());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!title.trim()) e.title = "Give the entry a title";
    else if (title.length > 200) e.title = "Keep the title under 200 characters";
    if (!content.trim()) e.content = "Write something first";
    else if (content.length > 20000) e.content = "Entries are limited to 20,000 characters";
    if (!entryDate) e.entry_date = "Pick a date";
    return e;
  }

  // Clear a field's error as soon as the user fixes it (on input and change).
  const clear = (field: keyof FieldErrors) => errors[field] && setErrors((prev) => ({ ...prev, [field]: undefined }));

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.values(v).some(Boolean)) return;

    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(isEdit ? `/api/journals/${initial!.id}` : "/api/journals", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, entry_date: entryDate }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return router.push("/login");
      if (!res.ok) {
        setFormError(body.error ?? "Couldn't save the entry");
        return;
      }
      const id = body.entry.id as string;
      const failed = body.indexing?.status === "failed";
      router.push(`/journal/${id}${failed ? "?indexing=failed" : ""}`);
      router.refresh();
      onCancel?.();
    } catch {
      setFormError("Network error. Your text is still here; try saving again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-4 sm:p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <div>
          <label htmlFor="title" className="label">Title</label>
          <input
            id="title"
            className="input"
            value={title}
            maxLength={200}
            placeholder="A day worth remembering"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "title-error" : undefined}
            onInput={() => clear("title")}
            onChange={(e) => {
              setTitle(e.target.value);
              clear("title");
            }}
          />
          {errors.title ? <p id="title-error" className="mt-1 text-xs text-red-600">{errors.title}</p> : null}
        </div>
        <div>
          <label htmlFor="entry_date" className="label">Date</label>
          <input
            id="entry_date"
            type="date"
            className="input"
            value={entryDate}
            aria-invalid={Boolean(errors.entry_date)}
            onInput={() => clear("entry_date")}
            onChange={(e) => {
              setEntryDate(e.target.value);
              clear("entry_date");
            }}
          />
          {errors.entry_date ? <p className="mt-1 text-xs text-red-600">{errors.entry_date}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="content" className="label">Entry</label>
        <textarea
          id="content"
          className="input min-h-72 resize-y font-serif text-base leading-relaxed"
          value={content}
          maxLength={20000}
          placeholder="What happened today? What's on your mind?"
          aria-invalid={Boolean(errors.content)}
          aria-describedby={errors.content ? "content-error" : "content-count"}
          onInput={() => clear("content")}
          onChange={(e) => {
            setContent(e.target.value);
            clear("content");
          }}
        />
        <div className="mt-1 flex justify-between text-xs">
          <span id="content-error" className="text-red-600">{errors.content}</span>
          <span id="content-count" className="text-stone-400">{content.length.toLocaleString()} / 20,000</span>
        </div>
      </div>

      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {saving ? "Saving & indexing…" : isEdit ? "Save changes" : "Save entry"}
        </button>
      </div>
    </form>
  );
}
