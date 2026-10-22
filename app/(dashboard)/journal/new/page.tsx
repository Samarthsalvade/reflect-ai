import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EntryForm } from "@/components/journal/EntryForm";

export default function NewEntryPage() {
  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
        <ArrowLeft className="size-4" aria-hidden />
        Back to journal
      </Link>
      <h1 className="font-serif text-3xl font-semibold">New entry</h1>
      <EntryForm />
    </div>
  );
}
