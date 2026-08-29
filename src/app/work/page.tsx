import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { ROLES, SCHOOLS, STUDIES } from "@/data/work";
import { breadcrumbSchema, graph } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";
import { revealDelay } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  path: "/work",
  title: "Work",
  description:
    "Where Daniel Fleming has worked and what he studied: founding engineer " +
    "at Netic AI, computer science at MIT, and the research work underneath.",
});

const LINK_LABELS: Record<string, string> = {
  github: "Source",
  site: "Site",
  paper: "Paper",
};

/**
 * Career, education, and the academic work underneath them.
 *
 * Deliberately a plainer register than /things. Coursework and research are
 * evidence, not toys, and giving them tiles and preview imagery would both
 * overstate them and dilute the collection. So: a list, in mono metadata and
 * body text, no cards, no images.
 */
export default function WorkPage() {
  return (
    <Container as="main" width="measure" className="flex flex-col gap-block py-block">
      <JsonLd
        json={graph(
          breadcrumbSchema([
            { name: "Daniel Fleming", path: "/" },
            { name: "Work", path: "/work" },
          ])
        )}
      />

      <header className="reveal" style={revealDelay(0)}>
        <h1 className="font-display text-page font-bold">Work</h1>
        <a
          href="/daniel-resume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block font-mono text-meta underline decoration-brand underline-offset-4"
        >
          CV (PDF)
        </a>
      </header>

      <section className="reveal flex flex-col gap-8" style={revealDelay(1)}>
        {ROLES.map((role) => (
          <div key={role.company}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 className="font-display text-title font-bold">{role.company}</h2>
              <span className="font-mono text-meta text-muted-foreground">
                {role.start} &ndash; {role.end}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-meta text-muted-foreground">
              {role.title}
              {role.note ? `, ${role.note}` : ""}
            </p>
            <p className="mt-3 text-body text-muted-foreground">
              {role.description}
            </p>
          </div>
        ))}
      </section>

      <section className="reveal flex flex-col gap-5" style={revealDelay(2)}>
        <h2 className="font-mono text-meta uppercase tracking-widest text-muted-foreground">
          Education
        </h2>
        {SCHOOLS.map((school) => (
          <div
            key={school.school}
            className="flex flex-wrap items-baseline justify-between gap-x-4"
          >
            <div className="min-w-0">
              <a
                href={school.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display text-title font-bold underline decoration-transparent underline-offset-4 transition-colors hover:decoration-brand"
              >
                {school.school}
              </a>
              <p className="text-body text-muted-foreground">{school.degree}</p>
            </div>
            <span className="font-mono text-meta text-muted-foreground">
              {school.start} &ndash; {school.end}
            </span>
          </div>
        ))}
      </section>

      <section className="reveal flex flex-col gap-5" style={revealDelay(3)}>
        <h2 className="font-mono text-meta uppercase tracking-widest text-muted-foreground">
          Research and technical work
        </h2>
        {STUDIES.map((study) => (
          <div key={study.title}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 className="text-body font-semibold">{study.title}</h3>
              <span className="font-mono text-meta text-muted-foreground">
                {study.dates}
              </span>
            </div>
            <p className="mt-1 text-body text-muted-foreground">
              {study.description}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-4">
              {study.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target={l.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    l.href.startsWith("http") ? "noopener noreferrer" : undefined
                  }
                  className="font-mono text-meta underline decoration-brand underline-offset-4"
                >
                  {l.label ?? LINK_LABELS[l.kind]}
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>

      <p className="reveal text-body text-muted-foreground" style={revealDelay(4)}>
        <Link href="/things" className="underline decoration-brand underline-offset-4">
          Things I have built
        </Link>
      </p>
    </Container>
  );
}
