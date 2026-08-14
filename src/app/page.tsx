import { ClassicHome } from "@/components/classic-home";

/**
 * Server component on purpose: the whole page is static content, so it renders
 * into the HTML for crawlers and works with no JS.
 *
 * The WebGL planet used to mount over this as a progressive enhancement. It
 * now lives behind an explicit launcher in the Playground tab, so nothing here
 * pulls in three.js and the landing page is just the portfolio.
 */
export default function Page() {
  return <ClassicHome />;
}
