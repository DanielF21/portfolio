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
 *
 * Writing first: it is the work most worth reading.
 */
export const NAV = [
  { href: "/writing", label: "Writing" },
  { href: "/things", label: "Things" },
  { href: "/work", label: "Work" },
] as const;

export const SITE = {
  name: "Daniel Fleming",
  initials: "DF",
  url: "https://danielfleming.xyz",
  description: "Engineer in Boston. I build interactive things.",
  socials: [
    { name: "GitHub", url: "https://github.com/DanielF21/" },
    { name: "LinkedIn", url: "https://www.linkedin.com/in/dannof/" },
  ],
} as const;
