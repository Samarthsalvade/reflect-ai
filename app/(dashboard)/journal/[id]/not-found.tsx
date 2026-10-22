import Link from "next/link";

export default function EntryNotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">Entry not found</h1>
      <p className="mt-2 text-sm text-stone-500">It may have been deleted, or it isn&apos;t yours to view.</p>
      <Link href="/dashboard" className="btn-primary mt-6">Back to journal</Link>
    </div>
  );
}
