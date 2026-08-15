import fs from "fs";
import matter from "gray-matter";
import path from "path";
import { cache } from "react";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/**
 * Markdown loading, parameterised by directory.
 *
 * This module knows about files and markdown and nothing else. What a series
 * is, which document is a part of one, and how parts are ordered all live in
 * `writing.ts`, one layer up, which is the only place that needs that
 * vocabulary.
 *
 * Two things about the shape of this module are load bearing:
 *
 * 1. **Listing is separate from compiling.** `listDocs` reads frontmatter and
 *    stops. Every index, the sitemap and both `generateStaticParams` need
 *    titles and dates and nothing else, and compiling a document is expensive:
 *    Shiki highlights every code block. The previous version had one function
 *    that always compiled, so rendering a list of three titles compiled three
 *    full articles.
 * 2. **`getDoc` never descends.** It takes explicit path segments. A recursive
 *    scan would sweep series parts into the one-off index, which is exactly the
 *    distinction `writing.ts` exists to keep.
 *
 * Generalised from the old `blog.ts`, which hardcoded `content/`. Two bugs came
 * with it and are fixed here:
 *
 * 1. `getPost` called `readFileSync` with no existence check, so an unknown
 *    slug threw and produced a 500. The `if (!post) notFound()` guard at the
 *    call site was unreachable. It now returns null and the caller can 404.
 * 2. `getPost` resolved paths relative to the process cwd while `getAllPosts`
 *    used `process.cwd()` explicitly. Both now go through `resolveDir`.
 */

export interface DocMeta {
  title: string;
  publishedAt: string;
  summary?: string;
  image?: string;
  /** Drafts are excluded from every index and from prev/next, but stay
   *  reachable by direct URL so they can be previewed. */
  draft?: boolean;
  /** Set on a part. Must match the directory the file sits in. */
  series?: string;
  /** 1-based position within a series. Orders the parts. */
  part?: number;
  /** The one line measured takeaway, shown beside a part on the series hub and
   *  on the home card. Written by hand from results that exist. Nothing
   *  derives it and nothing may invent one. */
  result?: string;
  /** URL of the code this part is about, shown under the byline.
   *
   *  Explicit rather than derived from the slug. `infer/engines/<slug>` happens
   *  to hold for the engines written so far, but a convention that is only
   *  usually right produces a link that is confidently wrong, and a 404 dressed
   *  as a source link is worse than no link. Falls back to the series' own
   *  source when absent. */
  code?: string;
}

export interface Heading {
  depth: number;
  id: string;
  text: string;
}

/** Frontmatter without the cost of compiling the body. */
export interface DocSummary {
  slug: string;
  metadata: DocMeta;
}

export interface Doc extends DocSummary {
  /** Rendered HTML, injected with dangerouslySetInnerHTML. */
  source: string;
  /** Every heading that got an id, in document order. Collected during the
   *  same pass that renders the HTML rather than by re-parsing the output. */
  headings: Heading[];
}

/** Minimal structural view of a hast node. The local plugins below only need
 *  `tagName`, `properties` and `children`, so this keeps `@types/hast` out of
 *  the dependency list. */
interface HNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
  value?: string;
}

/** Depth first walk over element children. */
function walk(node: HNode, visit: (node: HNode) => void) {
  for (const child of node.children ?? []) {
    visit(child);
    walk(child, visit);
  }
}

/**
 * Put every table inside a scrollable wrapper.
 *
 * The results tables in the writing run to eight columns. They should fit the
 * prose column once the cells are mono and tight, and this is the safety net
 * for when they do not. The scroll has to live on a WRAPPER: `display: block`
 * on the table itself stops it being a table for layout and every column comes
 * out the same width. See .table-scroll in globals.css.
 *
 * Children are visited BEFORE the wrap, so the walk never descends into a
 * wrapper it just created and wrap the same table forever.
 *
 * The wrapper is focusable and labelled on purpose: a region that scrolls has
 * to be reachable by keyboard, or its right hand columns are unreachable
 * without a pointer.
 */
function wrapTables() {
  return (tree: HNode) => {
    const wrap = (node: HNode) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        wrap(child);
        if (child.tagName !== "table") return child;
        return {
          type: "element",
          tagName: "div",
          properties: {
            className: ["table-scroll"],
            role: "region",
            tabIndex: 0,
            "aria-label": "Table",
          },
          children: [child],
        };
      });
    };
    wrap(tree);
  };
}

/** Record every heading that has an id. Must run after rehypeSlug. */
function collectHeadings(acc: Heading[]) {
  const textOf = (node: HNode): string =>
    node.type === "text"
      ? node.value ?? ""
      : (node.children ?? []).map(textOf).join("");

  return (tree: HNode) => {
    walk(tree, (node) => {
      const level = /^h([1-6])$/.exec(node.tagName ?? "");
      const id = node.properties?.id;
      if (level && typeof id === "string") {
        acc.push({ depth: Number(level[1]), id, text: textOf(node) });
      }
    });
  };
}

/**
 * Outbound links get `target` and `rel`, and dead relative links get named.
 *
 * Both used to be nobody's job. `CustomLink` in components/mdx.tsx was written
 * to do the first, but this pipeline emits an HTML string rendered through
 * dangerouslySetInnerHTML, so no component map ever ran and that whole file was
 * dead code.
 *
 * The warning matters because the writing is pasted in by hand from a repo
 * where links are relative to the source tree: `mfu_calculation.md`,
 * `../../README.md#hardware`. Those resolve to nothing once the text is on the
 * site. Rather than guess a destination, name the offender at render time so it
 * surfaces the first time the page is opened rather than months later.
 */
function fixLinks(where: string) {
  return (tree: HNode) => {
    walk(tree, (node) => {
      if (node.tagName !== "a" || !node.properties) return;
      const href = node.properties.href;
      if (typeof href !== "string") return;

      if (/^https?:\/\//i.test(href)) {
        node.properties.target = "_blank";
        node.properties.rel = "noopener noreferrer";
        return;
      }

      const resolves =
        href.startsWith("/") || href.startsWith("#") || href.startsWith("mailto:");
      if (!resolves && process.env.NODE_ENV !== "production") {
        console.warn(
          `[mdx] ${where}: relative link "${href}" does not resolve on the ` +
            `site. Rewrite it to a site path or an absolute URL.`
        );
      }
    });
  };
}

function resolveDir(dir: string) {
  return path.join(process.cwd(), dir);
}

/**
 * Join path segments under a content directory, or null if any segment is
 * unacceptable.
 *
 * Segments come from the URL. Each is validated SEPARATELY: one combined test
 * over a joined string would accept a slash and let a request climb out of the
 * content directory.
 */
function safeJoin(dir: string, segments: string[]): string | null {
  if (segments.length === 0 || segments.length > 2) return null;
  if (!segments.every((s) => /^[a-z0-9-]+$/i.test(s))) return null;

  const root = resolveDir(dir);
  const abs = path.join(root, ...segments);
  // Belt and braces. The regex already forbids "." and "/".
  if (!abs.startsWith(root + path.sep)) return null;
  return abs;
}

/** Names of the .mdx files directly in a directory, without extensions. */
export function docNamesIn(dir: string): string[] {
  const abs = resolveDir(dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => path.extname(f) === ".mdx")
    .map((f) => path.basename(f, ".mdx"));
}

/** Names of the immediate subdirectories of a directory. */
export function subdirsIn(dir: string): string[] {
  const abs = resolveDir(dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export async function markdownToHTML(markdown: string, where = "document") {
  const headings: Heading[] = [];

  // Two orderings bind. remarkGfm must precede remarkRehype, since it extends
  // the markdown grammar; without it every GFM table renders as literal pipe
  // characters, and the tables are most of the substance here. rehypeSlug must
  // precede collectHeadings, which reads the ids it assigns.
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(collectHeadings, headings)
    .use(fixLinks, where)
    .use(wrapTables)
    .use(rehypePrettyCode, {
      theme: { light: "min-light", dark: "min-dark" },
      keepBackground: false,
    })
    .use(rehypeStringify)
    .process(markdown);

  return { html: file.toString(), headings };
}

/**
 * Frontmatter for every .mdx directly inside `<dir>/<...prefix>`. Does not
 * compile anything and does not descend.
 */
export const listDocs = cache(
  async (dir: string, ...prefix: string[]): Promise<DocSummary[]> => {
    const rel = path.join(dir, ...prefix);
    const abs = resolveDir(rel);

    return docNamesIn(rel).map((slug) => {
      const raw = fs.readFileSync(path.join(abs, `${slug}.mdx`), "utf-8");
      return { slug, metadata: matter(raw).data as DocMeta };
    });
  }
);

/**
 * Load and compile one document. Segments are joined, so
 * `getDoc(dir, "inference", "naive")` reads `<dir>/inference/naive.mdx`.
 *
 * Returns null rather than throwing when the file is absent, so callers can
 * render a 404 instead of a 500.
 */
export const getDoc = cache(
  async (dir: string, ...segments: string[]): Promise<Doc | null> => {
    const abs = safeJoin(dir, segments);
    if (!abs) return null;

    const filePath = `${abs}.mdx`;
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf-8");
    const { content, data } = matter(raw);
    const { html, headings } = await markdownToHTML(content, segments.join("/"));

    return {
      slug: segments[segments.length - 1],
      metadata: data as DocMeta,
      source: html,
      headings,
    };
  }
);

// -------------------------------------------------------- notes on a `thing`

const THINGS_DIR = "content/things";

export const getThingNotes = (slug: string) => getDoc(THINGS_DIR, slug);
