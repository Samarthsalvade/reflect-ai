export default function LoadingJournal() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="text-sm text-stone-500">Loading your journal…</p>
      {[0, 1, 2].map(item => (
        <div key={item} aria-hidden="true" className="card h-28 animate-pulse bg-stone-100 dark:bg-stone-900" />
      ))}
    </div>
  );
}
