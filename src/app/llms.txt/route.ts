import { SITE } from "@/data/site";
import { THINGS } from "@/data/things";
import { allSeries, oneOffs } from "@/data/writing";
import { absoluteUrl } from "@/lib/seo";

/**
 * /llms.txt: a markdown index of the site for a model that has landed here and
 * needs to know what is on it without crawling.
 *
 * Generated from the same registries every page renders from, so it cannot
 * describe a post that has been unpublished or miss one that shipped this
 * morning. Nothing in it is written twice: every title, date and one-line
 * description below is the document's own frontmatter.
 *
 * It is an index, not a corpus. The full text is one file over at
 * /llms-full.txt, and every entry here is a link, because a model that only
 * needs one part should be able to fetch only that part.
 */

export const dynamic = "force-static";

/**
 * Drop a leading "Part 3: " from a description.
 *
 * The meta descriptions open with the part number because they have to stand
 * alone in a search result. Here the link label already says "Part 3", so the
 * prefix would print twice on the same line.
 */
const unprefixed = (text: string) => text.replace(/^Part \d+: /, "");

export async function GET() {
  const [series, singles] = await Promise.all([allSeries(), oneOffs()]);

  const L: string[] = [];
  const push = (...lines: string[]) => L.push(...lines);

  push(
    `# ${SITE.name}`,
    ``,
    `> ${SITE.description}`,
    ``,
    `Daniel Fleming is a software engineer in San Francisco, California. He`,
    `holds a Bachelor of Science in Computer Science and Engineering from the`,
    `Massachusetts Institute of Technology (MIT), and was a founding engineer`,
    `and the second engineering hire at Netic AI. He is currently building a`,
    `large language model (LLM) inference engine from scratch for Qwen2.5-1.5B`,
    `on a single NVIDIA A10 GPU, and writing down what each version measures.`,
    ``,
    `${SITE.attribution}`,
    ``,
    `## Key pages`,
    ``,
    `- [Work](${absoluteUrl("/work")}): employment history, education, research writeups.`,
    `- [Writing](${absoluteUrl("/writing")}): index of every article and series.`,
    `- [Things](${absoluteUrl("/things")}): interactive pieces, each with a written explanation.`,
    ``,
    `Every article below is also served as plain markdown at its own URL plus`,
    `".md", for example ${absoluteUrl("/writing/inference/paged.md")}. The`,
    `complete text of the writing, concatenated in reading order, is at`,
    `${absoluteUrl("/llms-full.txt")}.`
  );

  for (const s of series) {
    push(
      ``,
      `## ${s.series.title}`,
      ``,
      `${s.series.description}`,
      ``,
      `Hub: ${absoluteUrl(`/writing/${s.series.slug}`)}`
    );
    if (s.series.source) push(`Source code: ${s.series.source.href}`);
    push(``, `Parts, in reading order:`, ``);

    for (const p of s.parts) {
      const at = absoluteUrl(`/writing/${s.series.slug}/${p.slug}`);
      push(
        `- [Part ${p.metadata.part}: ${p.metadata.title}](${at}) (${p.metadata.publishedAt}): ${unprefixed(
          p.metadata.description ?? p.metadata.summary ?? ""
        )}`
      );
    }

    if (s.appendices.length) {
      push(``, `Supporting documents, referenced by the parts above:`, ``);
      for (const p of s.appendices) {
        const at = absoluteUrl(`/writing/${s.series.slug}/${p.slug}`);
        push(
          `- [${p.metadata.title}](${at}): ${
            p.metadata.description ?? p.metadata.summary ?? ""
          }`
        );
      }
    }
  }

  if (singles.length) {
    push(``, `## Other writing`, ``);
    for (const d of singles) {
      push(
        `- [${d.metadata.title}](${absoluteUrl(`/writing/${d.slug}`)}) (${
          d.metadata.publishedAt
        }): ${d.metadata.description ?? d.metadata.summary ?? ""}`
      );
    }
  }

  push(``, `## Things`, ``);
  for (const t of THINGS) {
    push(
      `- [${t.title}](${absoluteUrl(`/things/${t.slug}`)}) (${t.shipped}): ${t.description}${
        t.repo ? ` Source: ${t.repo}` : ""
      }`
    );
  }

  push(
    ``,
    `## Optional`,
    ``,
    `- [RSS feed](${absoluteUrl("/rss.xml")})`,
    `- [Sitemap](${absoluteUrl("/sitemap.xml")})`,
    ...SITE.socials.map((s) => `- [${s.name}](${s.url})`),
    ``
  );

  return new Response(L.join("\n"), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
