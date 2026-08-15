import Link from "next/link";

import { Container } from "@/components/layout/container";
import { SITE } from "@/data/site";

/**
 * The quiet end of every page. Carries the social links the old floating dock
 * used to, plus the Writing link unconditionally: the door stays open in the
 * URL space even while the header does not advertise it.
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
          <Link
            href="/things"
            className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
          >
            Things
          </Link>
          <Link
            href="/writing"
            className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
          >
            Writing
          </Link>
          <Link
            href="/work"
            className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
          >
            Work
          </Link>
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
