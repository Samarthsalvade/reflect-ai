import { AskPanel } from "@/components/chat/AskPanel";

export default function AskPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Ask my journal</h1>
        <p className="mt-1 text-sm text-stone-500">
          Answers come only from your own entries, and every claim links to the entry it came from.
        </p>
      </div>
      <AskPanel />
    </div>
  );
}
