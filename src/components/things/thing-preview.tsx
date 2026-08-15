"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { WebglBoundary } from "@/components/planet/webgl-boundary";
import { LIVE } from "@/components/things/loaders";
import type { Thing } from "@/data/things";
import { canAutoActivate } from "@/lib/device";
import { useLiveSlot } from "@/lib/things/live-budget";
import { cn } from "@/lib/utils";

/**
 * A thing's visual, in three layers.
 *
 *   1. the poster, ALWAYS rendered and always present in the server HTML. This
 *      is the no-JS state and it is complete and correct on its own.
 *   2. the live layer, mounted only while this tile holds a slot from the live
 *      budget, cross-faded over the poster.
 *   3. a Play control, always present and always focusable. That is the whole
 *      accessibility story: reduced-motion, touch, and low-power visitors never
 *      get automatic motion but can always ask for it.
 *
 * Nothing here ever sets opacity 0 on the poster. See the invariant above
 * @keyframes reveal in globals.css.
 */

interface Props {
  thing: Thing;
  /** The featured tile activates on scroll; rows activate on hover. */
  placement: "featured" | "row";
  className?: string;
  priority?: boolean;
  sizes?: string;
}

const ENTER_DWELL_MS = 120;
const LEAVE_GRACE_MS = 400;
const VIEW_DWELL_MS = 250;

export function ThingPreview({
  thing,
  placement,
  className,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 700px",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Server render and first client render must match, so nothing beyond the
  // poster exists until after mount.
  const [mounted, setMounted] = useState(false);
  const [auto, setAuto] = useState(false);
  const [manual, setManual] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAuto(canAutoActivate());
  }, []);

  const canBeLive = thing.preview !== "none" && !failed;
  const wanted = mounted && canBeLive && (manual || (auto && triggered));
  const granted = useLiveSlot(
    thing.slug,
    thing.weight === "heavy" ? "heavy" : "light",
    wanted
  );

  const arm = useCallback((on: boolean, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTriggered(on), delay);
  }, []);

  // Featured tiles wake when they are properly on screen.
  useEffect(() => {
    if (placement !== "featured" || !mounted || !auto) return;
    const el = hostRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => arm(entry.isIntersecting, entry.isIntersecting ? VIEW_DWELL_MS : 0),
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [placement, mounted, auto, arm]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const hoverProps =
    placement === "row" && auto
      ? {
          onPointerEnter: () => arm(true, ENTER_DWELL_MS),
          onPointerLeave: () => arm(false, LEAVE_GRACE_MS),
        }
      : {};

  const Live = thing.preview === "live" ? LIVE[thing.slug] : undefined;
  const showLive = granted && !failed;

  return (
    <div
      ref={hostRef}
      className={cn("relative overflow-hidden bg-muted", className)}
      {...hoverProps}
    >
      <Image
        src={thing.poster.src}
        alt=""
        width={thing.poster.width}
        height={thing.poster.height}
        sizes={sizes}
        priority={priority}
        className="h-full w-full object-cover"
      />

      {showLive && (
        <div className="absolute inset-0 animate-[reveal_400ms_ease-out_both]">
          <WebglBoundary onError={() => setFailed(true)}>
            {thing.preview === "video" ? (
              <video
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster={thing.poster.src}
                onError={() => setFailed(true)}
              >
                <source src={`/things/${thing.slug}/preview.webm`} type="video/webm" />
                <source src={`/things/${thing.slug}/preview.mp4`} type="video/mp4" />
              </video>
            ) : Live ? (
              <Live />
            ) : null}
          </WebglBoundary>
        </div>
      )}

      {/* No play/live chip. Hovering a tile and watching it come alive is its
          own affordance, and a "live" badge sat on top of the very thing it was
          announcing. Devices that cannot auto-activate (touch, reduced motion,
          low power) simply keep the poster, which is a complete state. */}
    </div>
  );
}
