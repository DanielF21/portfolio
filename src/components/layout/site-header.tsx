import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Icons } from "@/components/icons";
import { ModeToggle } from "@/components/mode-toggle";
import { hasWriting } from "@/data/mdx";
import { SITE } from "@/data/site";

/** Social name to glyph. Keyed off SITE.socials so the header and footer stay
 *  driven by the same list. */
const SOCIAL_ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  GitHub: Icons.github,
  LinkedIn: Icons.linkedin,
};

/**
 * Sticky, not fixed.
 *
 * The previous nav was a `fixed inset-x-0 bottom-0` floating dock, which meant
 * it sat on top of whatever was at the bottom of the page. It covered the
 * skills badges and cut across project cards, because nothing reserved space
 * for it. A sticky header participates in layout and cannot do that.
 *
 * Server component: it reads the writing directory directly so the Writing link
 * only appears once there is something behind it. The route exists either way.
 */
export async function SiteHeader() {
  const showWriting = await hasWriting();

  const links = [
    { href: "/things", label: "Things" },
    ...(showWriting ? [{ href: "/writing", label: "Writing" }] : []),
    { href: "/work", label: "Work" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <Container
        width="page"
        className="flex h-14 items-center justify-between gap-4"
      >
        <Link
          href="/"
          className="font-display text-title font-bold tracking-tight transition-colors hover:text-brand"
        >
          {SITE.name}
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2 py-1.5 font-mono text-meta uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:px-3"
            >
              {l.label}
            </Link>
          ))}

          {SITE.socials.map((s) => {
            const Icon = SOCIAL_ICONS[s.name];
            if (!Icon) return null;
            return (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="size-4" />
              </a>
            );
          })}

          <ModeToggle />
        </nav>
      </Container>
    </header>
  );
}
