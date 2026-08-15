import Link from "next/link";

import { Container } from "@/components/layout/container";
import { NAV, SITE } from "@/data/site";

/**
 * The quiet end of every page. Carries the social links the old floating dock
 * used to.
 *
 * Maps the same NAV list the header does. It used to hardcode its own copy of
 * the three links, in a different order, and unconditionally, back when the
 * header hid Writing while the directory was empty.
 */
export function SiteFooter() {
  const socials = SITE.socials;

  return (
    <footer className="mt-block border-t border-border/60 py-8">
      <Container
        width="page"
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="font-mono text-meta text-muted-foreground">
          {SITE.name}
        </p>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {socials.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
            >
              {s.name}
            </a>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
