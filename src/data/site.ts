/**
 * Site identity. Everything that is true about the site rather than about a
 * thing, a role, or a post.
 *
 * This is what is left of the old `resume.tsx`, which had grown into a single
 * object holding identity, nav, socials, skills, education, and ten projects,
 * half of which nothing rendered. The rest of it now lives in `work.ts` and
 * `things.ts`.
 */
/**
 * The one nav list. The header and the footer both map it, so they cannot drift
 * apart the way they had (three hardcoded links in each, in different orders,
 * with different visibility rules).
 */
export const NAV = [
  { href: "/writing", label: "Writing" },
  { href: "/things", label: "Things" },
  { href: "/work", label: "Work" },
] as const;

export const SITE = {
  name: "Daniel Fleming",
  initials: "DF",

  /**
   * The canonical host, and the ONE thing that decides what every canonical
   * link, every `og:url`, every sitemap `<loc>` and the feed's `<link>` say.
   *
   * It is `www`, not the apex, because the apex 308-redirects to `www` at the
   * edge. Every self-reference on the site used to name the apex, so every
   * canonical pointed at a host that immediately redirected somewhere else.
   * Flipping this constant is the whole fix; do not hardcode a host anywhere
   * else.
   */
  url: "https://www.danielfleming.xyz",

  /** The home page's meta description, and the fallback for anything without
   *  one of its own. Names the person, the place, and the work, in that order,
   *  because this string is what a search result prints under the name. */
  description:
    "Daniel Fleming is an engineer in San Francisco building an LLM inference engine from scratch. MIT computer science, founding engineer at Netic AI.",

  socials: [
    { name: "GitHub", url: "https://github.com/DanielF21/" },
    { name: "LinkedIn", url: "https://www.linkedin.com/in/dannof/" },
  ],

  /**
   * The facts a `Person` needs, kept beside the identity rather than typed into
   * a JSON-LD blob. `schema.ts` is the only reader.
   *
   * `knowsAbout` holds subjects the writing actually covers, derived by reading
   * the posts. Nothing aspirational goes in it: a topic here that the site does
   * not demonstrate is a claim with no page behind it.
   */
  person: {
    jobTitle: "Software Engineer",
    locality: "San Francisco",
    region: "CA",
    country: "US",
    alumniOf: {
      name: "Massachusetts Institute of Technology",
      url: "https://www.mit.edu/",
    },
    knowsAbout: [
      "LLM inference",
      "Inference engines",
      "KV cache",
      "PagedAttention",
      "Continuous batching",
      "Chunked prefill",
      "FlashAttention",
      "GPU performance",
      "PyTorch",
      "CUDA",
      "vLLM",
      "Distributed systems",
    ],
  },

  /**
   * Stated once, read by the footer, `robots.txt` and `llms.txt`, so the three
   * cannot disagree about the terms.
   */
  attribution:
    "Content on this site may be quoted with attribution to Daniel Fleming and a link to the page quoted.",
} as const;
