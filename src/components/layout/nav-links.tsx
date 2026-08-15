"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV } from "@/data/site";
import { cn } from "@/lib/utils";

/**
 * The nav links, and the only client component in the header.
 *
 * Active state needs `usePathname`, and the alternative to extracting this was
 * to make the whole header a client component, which would drag the site name,
 * the social icons and the theme toggle across the boundary for one string
 * comparison.
 *
 * The prefix match is what makes it useful: /writing/inference/naive is three
 * segments deep and still marks Writing. Without it, the deepest pages on the
 * site would be the ones that tell you least about where you are.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2 py-1.5 font-mono text-meta uppercase tracking-wide transition-colors sm:px-3",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
