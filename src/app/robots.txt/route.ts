import { SITE } from "@/data/site";
import { absoluteUrl } from "@/lib/seo";

/**
 * robots.txt, as a route handler rather than Next's `robots.ts` convention.
 *
 * The convention emits a typed object and has no way to write a COMMENT, and
 * two of the lines below are comments: the attribution terms, and the note
 * saying where the plain text lives. A file that AI crawlers read is the right
 * place to tell them both, and neither belongs in a `Disallow` rule.
 *
 * **Every group here is an ALLOW.** Nothing on this site is blocked, and the
 * wildcard at the top already permits all of them. Naming them is a statement
 * rather than a mechanism: a crawler operator, or a person auditing this file,
 * can see that the omission of a `Disallow` was deliberate, and a future
 * tightening of the wildcard cannot silently take these with it.
 *
 * The tokens were read off each operator's own documentation in August 2026,
 * not recalled:
 *   OpenAI      https://developers.openai.com/api/docs/bots
 *   Anthropic   https://support.claude.com/en/articles/8896518
 *   Perplexity  https://docs.perplexity.ai/docs/resources/perplexity-crawlers
 *   Google      https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
 * Re-check them before adding one from memory; these change.
 */

/** Answer engines and AI crawlers, grouped by operator. */
const AI_AGENTS = [
  // OpenAI. GPTBot trains, OAI-SearchBot powers ChatGPT search, ChatGPT-User
  // fetches on a person's explicit request, OAI-AdsBot checks ad landing pages.
  ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "OAI-AdsBot"],
  // Anthropic. ClaudeBot trains, Claude-SearchBot indexes for search, and
  // Claude-User fetches when someone asks Claude about a page.
  ["ClaudeBot", "Claude-SearchBot", "Claude-User"],
  // Perplexity. PerplexityBot indexes, Perplexity-User fetches on request.
  ["PerplexityBot", "Perplexity-User"],
  // Google. Googlebot is covered by the wildcard and is what Search and AI
  // Overviews use; Google-Extended is the separate opt-in for Gemini and
  // Vertex AI grounding and training, and is the one that has to be named.
  ["Google-Extended"],
  // Apple and Microsoft, the other two answer engines with their own token.
  ["Applebot", "Applebot-Extended"],
  ["Bingbot"],
];

export const dynamic = "force-static";

export function GET() {
  const lines: string[] = [
    `# ${SITE.name} (${SITE.url})`,
    `#`,
    `# ${SITE.attribution}`,
    `#`,
    `# Plain text for machines: ${absoluteUrl("/llms.txt")}`,
    `# Every article is also served as markdown at its own path plus ".md".`,
    ``,
    `User-agent: *`,
    `Allow: /`,
    ``,
    `# Answer engines and AI crawlers, allowed explicitly.`,
  ];

  for (const group of AI_AGENTS) {
    lines.push(``);
    for (const agent of group) lines.push(`User-agent: ${agent}`);
    lines.push(`Allow: /`);
  }

  lines.push(``, `Sitemap: ${absoluteUrl("/sitemap.xml")}`, ``);

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
