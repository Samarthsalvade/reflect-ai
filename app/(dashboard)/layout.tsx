import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";
import { NavLinks } from "@/components/NavLinks";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Middleware already redirects; this is the server-side guarantee.
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <BookOpen className="size-5 text-accent" aria-hidden />
            <span className="hidden sm:inline">ReflectAI</span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-xs text-stone-500 md:inline" title={user.email ?? ""}>
              {user.email}
            </span>
            <form action={logout}>
              <button type="submit" className="btn-ghost px-2.5" aria-label="Sign out">
                <LogOut className="size-4" aria-hidden />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
