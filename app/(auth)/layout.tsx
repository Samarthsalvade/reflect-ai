import { BookOpen } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <BookOpen className="size-6 text-accent" aria-hidden />
        ReflectAI
      </div>
      {children}
    </main>
  );
}
