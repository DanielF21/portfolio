import { SITE } from "@/data/site";
import type { Series } from "@/data/series";
import type { DocSummary } from "@/data/mdx";
import type { Thing } from "@/data/things";
import { absoluteUrl } from "@/lib/seo";

/**
 * schema.org JSON-LD, built from the same registries the pages render from.
 *
 * Nothing here is typed by hand that exists somewhere else. A `Person` whose
 * `alumniOf` is a literal string in this file is a second copy of `work.ts`,
 * and the two drift the first time a fact changes; every value below is read
 * out of `site.ts`, `series.ts`, `things.ts` or a document's frontmatter.
 *
 * **`@id` is what makes this a graph rather than four disconnected blobs.**
 * Every page emits `PERSON_ID` as an author reference rather than a repeated
 * Person object, so a consumer resolves nine `BlogPosting`s, four things and a
 * home page onto ONE entity. Repeating the object instead is what produces the
 * "several people with the same name" reading this exists to prevent.
 */

export const PERSON_ID = `${SITE.url}/#person`;
export const SITE_ID = `${SITE.url}/#website`;

type Json = Record<string, unknown>;

/** The one Person node. Emitted in full on the home page and on /about; every
 *  other page references it by id. */
export function personSchema(): Json {
  const { person } = SITE;

  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: SITE.name,
    url: absoluteUrl("/"),
    image: absoluteUrl("/me.png"),
    jobTitle: person.jobTitle,
    description: SITE.description,
    address: {
      "@type": "PostalAddress",
      addressLocality: person.locality,
      addressRegion: person.region,
      addressCountry: person.country,
    },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: person.alumniOf.name,
      // Spelled out AND abbreviated. The two strings are what people search
      // with, and a consumer matching on either resolves to the same node.
      alternateName: "MIT",
      url: person.alumniOf.url,
    },
    knowsAbout: [...person.knowsAbout],
    sameAs: SITE.socials.map((s) => s.url),
  };
}

export function websiteSchema(): Json {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: SITE.name,
    url: absoluteUrl("/"),
    description: SITE.description,
    inLanguage: "en-US",
    publisher: { "@id": PERSON_ID },
    author: { "@id": PERSON_ID },
  };
}

/**
 * One article.
 *
 * `dateModified` falls back to `datePublished` rather than to the build date.
 * A build-stamped `dateModified` claims every page was revised on every deploy,
 * which is both false and the kind of freshness signal that stops being
 * believed once it is always true.
 */
export function blogPostingSchema({
  doc,
  path,
  section,
  series,
}: {
  doc: DocSummary;
  path: string;
  /** The subject area, e.g. the series title. */
  section: string;
  series?: Series;
}): Json {
  const url = absoluteUrl(path);
  const { title, publishedAt, updatedAt, description, summary } = doc.metadata;

  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: title,
    description: description ?? summary,
    url,
    // The generated card for this exact route. Served without the cache-busting
    // query Next appends in the `og:image` tag, which is a real URL: the route
    // answers with or without it.
    image: `${url}/opengraph-image`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: publishedAt,
    dateModified: updatedAt ?? publishedAt,
    articleSection: section,
    wordCount: doc.wordCount,
    inLanguage: "en-US",
    author: { "@id": PERSON_ID },
    publisher: { "@id": PERSON_ID },
    isPartOf: series
      ? {
          "@type": "CreativeWorkSeries",
          name: series.title,
          url: absoluteUrl(`/writing/${series.slug}`),
        }
      : { "@id": SITE_ID },
    ...(doc.metadata.part ? { position: doc.metadata.part } : {}),
  };
}

/** A series hub. A `Blog` rather than a `CreativeWorkSeries` alone, because it
 *  is both: an ordered work, and the page that lists its posts. */
export function seriesSchema(series: Series, parts: DocSummary[]): Json {
  return {
    "@type": "CreativeWorkSeries",
    "@id": `${absoluteUrl(`/writing/${series.slug}`)}#series`,
    name: series.title,
    description: series.description,
    url: absoluteUrl(`/writing/${series.slug}`),
    inLanguage: "en-US",
    author: { "@id": PERSON_ID },
    ...(series.source ? { codeRepository: series.source.href } : {}),
    hasPart: parts.map((p) => ({
      "@type": "BlogPosting",
      "@id": `${absoluteUrl(`/writing/${series.slug}/${p.slug}`)}#article`,
      headline: p.metadata.title,
      url: absoluteUrl(`/writing/${series.slug}/${p.slug}`),
      datePublished: p.metadata.publishedAt,
      ...(p.metadata.part ? { position: p.metadata.part } : {}),
    })),
  };
}

/**
 * One thing.
 *
 * `SoftwareSourceCode` when a public repository exists and `CreativeWork` when
 * one does not. The type is not chosen by hand per entry: a
 * `SoftwareSourceCode` with no `codeRepository` is the shape that gets flagged,
 * and the registry already knows which is which.
 */
export function thingSchema(thing: Thing): Json {
  return {
    "@type": thing.repo ? "SoftwareSourceCode" : "CreativeWork",
    "@id": `${absoluteUrl(`/things/${thing.slug}`)}#work`,
    name: thing.title,
    description: thing.description,
    url: absoluteUrl(`/things/${thing.slug}`),
    image: absoluteUrl(thing.poster.src),
    dateCreated: thing.shipped,
    inLanguage: "en-US",
    author: { "@id": PERSON_ID },
    creator: { "@id": PERSON_ID },
    ...(thing.repo ? { codeRepository: thing.repo } : {}),
    ...(thing.tech?.length
      ? { programmingLanguage: [...thing.tech], keywords: thing.tech.join(", ") }
      : {}),
  };
}

/**
 * A trail, from the site root to the current page.
 *
 * Takes the crumbs the page already renders rather than deriving them from the
 * URL: `/writing/inference/paged` has "Building an inference engine" at depth
 * two, which no path parser can recover.
 */
export function breadcrumbSchema(
  crumbs: readonly { name: string; path: string }[]
): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/** Wrap one or more nodes in a single `@graph`. One script tag per page: a
 *  consumer reading four separate tags has to join them itself, and the `@id`
 *  references above are exactly what a graph is for. */
export function graph(...nodes: Json[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes });
}
