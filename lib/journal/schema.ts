import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Not a real date");

export const EntryCreate = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Write something first").max(20000),
  entry_date: isoDate,
});

export const EntryUpdate = EntryCreate.partial().refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const EntryId = z.string().uuid();

export const AskQuestion = z.object({
  question: z.string().trim().min(3, "Ask a slightly longer question").max(500),
});

export type IndexStatus = "pending" | "ready" | "failed";

export type JournalEntry = {
  id: string;
  title: string;
  content: string;
  entry_date: string;
  index_status: IndexStatus;
  index_error: string | null;
  indexed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const ENTRY_COLUMNS =
  "id, title, content, entry_date, index_status, index_error, indexed_at, created_at, updated_at";
