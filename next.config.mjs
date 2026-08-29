/**
 * Origin of the backend API.
 *
 * SERVER ONLY. No `NEXT_PUBLIC_` prefix, so Next never inlines it into the
 * client bundle. The browser talks to `/api/backend/*` on this domain and this
 * rewrite forwards it; visitors never learn where the backend actually lives.
 *
 * Trailing slash stripped so the template below cannot produce a double slash.
 */
const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Same-origin proxy to the backend.
   *
   * Everything under /api/backend/ is forwarded, so the client calls
   * /api/backend/chess/move and /api/backend/scheme/eval. Two consequences
   * worth knowing: the backend origin stays out of the shipped JavaScript, and
   * the requests become same-origin, so CORS stops being involved at all.
   *
   * The cost is a hop through Vercel on every request.
   */
  async rewrites() {
    /**
     * A plain markdown copy of every article, at its own URL plus ".md".
     *
     * The extension is spelled HERE and nowhere else. It cannot live in a
     * dynamic segment: `[part]` would capture "paged.md", and the segment
     * validator in `data/mdx.ts` rejects a dot, which is the behaviour that
     * keeps a URL from climbing out of the content directory. So the public
     * `.md` URL is rewritten onto a handler that takes the same clean segments
     * the page does.
     *
     * Rewrites, not redirects: the markdown is served AT the .md URL rather
     * than bouncing to a different one, which is what a consumer fetching it
     * expects, and it keeps `/writing/<x>` and `/writing/<x>.md` as two
     * representations of one document rather than two pages.
     */
    const markdown = [
      {
        source: "/writing/:slug.md",
        destination: "/api/writing-md/:slug",
      },
      {
        source: "/writing/:slug/:part.md",
        destination: "/api/writing-md/:slug/:part",
      },
    ];

    if (!BACKEND_URL) {
      console.warn(
        "[next.config] BACKEND_URL is not set. /api/backend/* will 404 and the " +
          "chess and scheme things will report that the backend is unreachable."
      );
      return markdown;
    }
    return [
      ...markdown,
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },

  /**
   * Every one of these URLs was live and is likely indexed, linked from a
   * resume PDF, or both. They redirect rather than 404.
   *
   * 308 (permanent) is the default for `redirects()` without `permanent: false`.
   */
  async redirects() {
    return [
      // The old duplicate of the homepage.
      { source: "/classic", destination: "/", permanent: true },

      // Toys, now first-class things.
      { source: "/chess", destination: "/things/chess", permanent: true },
      {
        source: "/scheme-interpreter",
        destination: "/things/scheme",
        permanent: true,
      },

      // Blog became writing.
      { source: "/blog", destination: "/writing", permanent: true },
      { source: "/blog/:slug", destination: "/writing/:slug", permanent: true },

      // Coursework writeups are evidence on the work page now, not their own
      // pages. Both were only ever a heading and a PDF in an iframe.
      { source: "/NBA-clustering", destination: "/work", permanent: true },
      { source: "/SD-ControlNet", destination: "/work", permanent: true },
    ];
  },
};

export default nextConfig;
