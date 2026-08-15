import { cn } from "@/lib/utils";

/**
 * The site's only content column.
 *
 * The root layout deliberately sets no width at all. Every page opts into
 * exactly one of these, and they are never nested inside one another. That
 * constraint is the whole point: the previous layout capped width in three
 * different places (the root at max-w-4xl, the hero at max-w-2xl, the project
 * grid at max-w-[800px]), which put the hero's left edge 80px inside the left
 * edge of everything below it on the same page.
 *
 * If you find yourself wanting a fourth width, the answer is almost certainly
 * "full" plus a grid inside it, not a new value here.
 */

type Width = "page" | "measure" | "full";

interface Props {
  width?: Width;
  className?: string;
  id?: string;
  children: React.ReactNode;
  /** Render as <main>, for the one per page that is the primary content. */
  as?: "div" | "main" | "section" | "article" | "header" | "footer";
}

export function Container({
  width = "page",
  className,
  id,
  children,
  as: Tag = "div",
}: Props) {
  // Prose columns are NOT centred independently. A centred 44rem column inside
  // a 64rem page has a different left edge from the header above it, which is a
  // quieter version of the exact misalignment this component exists to remove.
  // Instead the page column is always the one that centres, and a measure
  // column is capped inside it, flush left. Every left edge on the site lines
  // up at every breakpoint as a result.
  if (width === "measure") {
    return (
      <Tag id={id} className="mx-auto w-full max-w-page px-gutter">
        <div className={cn("w-full max-w-measure", className)}>{children}</div>
      </Tag>
    );
  }

  return (
    <Tag
      id={id}
      className={cn(
        "mx-auto w-full px-gutter",
        width === "page" ? "max-w-page" : "max-w-none",
        className
      )}
    >
      {children}
    </Tag>
  );
}
