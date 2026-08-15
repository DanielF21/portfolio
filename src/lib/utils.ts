import { type CSSProperties } from "react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Steps of the entrance stagger, in ms. */
const REVEAL_STEP_MS = 60;
/** Hard cap on the stagger. The previous implementation reached 650ms of delay
 *  before the last item even started, which is why the page assembled slowly
 *  enough to watch. Six steps is 360ms, and everything is settled well inside
 *  half a second. */
const REVEAL_MAX_STEPS = 6;

/**
 * Style object for a staggered `.reveal`. Pair with `className="reveal"`.
 *
 * Returns a plain custom property rather than an opacity, deliberately: see the
 * invariant documented above @keyframes reveal in globals.css. Nothing here may
 * ever hide content.
 */
export function revealDelay(index: number): CSSProperties {
  const step = Math.min(Math.max(index, 0), REVEAL_MAX_STEPS);
  return { "--reveal-delay": `${step * REVEAL_STEP_MS}ms` } as CSSProperties;
}

export function formatDate(date: string) {
  let currentDate = new Date().getTime();
  if (!date.includes("T")) {
    date = `${date}T00:00:00`;
  }
  let targetDate = new Date(date).getTime();
  let timeDifference = Math.abs(currentDate - targetDate);
  let daysAgo = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

  let fullDate = new Date(date).toLocaleString("en-us", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (daysAgo < 1) {
    return "Today";
  } else if (daysAgo < 7) {
    return `${fullDate} (${daysAgo}d ago)`;
  } else if (daysAgo < 30) {
    const weeksAgo = Math.floor(daysAgo / 7);
    return `${fullDate} (${weeksAgo}w ago)`;
  } else if (daysAgo < 365) {
    const monthsAgo = Math.floor(daysAgo / 30);
    return `${fullDate} (${monthsAgo}mo ago)`;
  } else {
    const yearsAgo = Math.floor(daysAgo / 365);
    return `${fullDate} (${yearsAgo}y ago)`;
  }
}
