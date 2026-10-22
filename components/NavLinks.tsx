"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotebookPen, Sparkles } from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Journal", icon: NotebookPen, match: ["/dashboard", "/journal"] },
  { href: "/ask-ai", label: "Ask my journal", icon: Sparkles, match: ["/ask-ai"] },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`btn px-3 ${
              active
                ? "bg-accent/10 text-accent dark:bg-accent/20 dark:text-indigo-300"
                : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
