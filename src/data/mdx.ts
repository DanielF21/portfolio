import fs from "fs";
import matter from "gray-matter";
import path from "path";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/**
 * MDX loading, parameterised by directory.
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
  /** Drafts are excluded from indexes and from the nav visibility check, but
   *  remain reachable by direct URL so they can be previewed. */
  draft?: boolean;
  /** Optional grouping, e.g. an engine series. */
  series?: string;
  part?: number;
}

export interface Doc {
  slug: string;
  metadata: DocMeta;
  source: string;
}

function resolveDir(dir: string) {
  return path.join(process.cwd(), dir);
}

function mdxFilesIn(dir: string): string[] {
  const abs = resolveDir(dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => path.extname(f) === ".mdx");
}

export async function markdownToHTML(markdown: string) {
  const p = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypePrettyCode, {
      theme: { light: "min-light", dark: "min-dark" },
      keepBackground: false,
    })
    .use(rehypeStringify)
    .process(markdown);

  return p.toString();
}

/** Returns null rather than throwing when the file is absent, so callers can
 *  render a 404 instead of a 500. */
export async function getDoc(dir: string, slug: string): Promise<Doc | null> {
  // Reject anything that could climb out of the content directory. Slugs come
  // from the URL.
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;

  const filePath = path.join(resolveDir(dir), `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { content, data } = matter(raw);
  return {
    slug,
    metadata: data as DocMeta,
    source: await markdownToHTML(content),
  };
}

/** Newest first, drafts excluded unless `includeDrafts`. */
export async function getDocs(
  dir: string,
  { includeDrafts = false } = {}
): Promise<Doc[]> {
  const docs = await Promise.all(
    mdxFilesIn(dir).map((file) =>
      getDoc(dir, path.basename(file, path.extname(file)))
    )
  );

  return docs
    .filter((d): d is Doc => d !== null)
    .filter((d) => includeDrafts || !d.metadata.draft)
    .sort((a, b) =>
      (b.metadata.publishedAt ?? "").localeCompare(a.metadata.publishedAt ?? "")
    );
}

// ------------------------------------------------------------------- writing

const WRITING_DIR = "content/writing";

export const getWriting = () => getDocs(WRITING_DIR);
export const getWritingPost = (slug: string) => getDoc(WRITING_DIR, slug);

/** Drives whether the nav advertises Writing at all. The route always exists;
 *  it just is not linked while there is nothing behind it. */
export async function hasWriting() {
  return (await getWriting()).length > 0;
}

// -------------------------------------------------------- notes on a `thing`

const THINGS_DIR = "content/things";

export const getThingNotes = (slug: string) => getDoc(THINGS_DIR, slug);
