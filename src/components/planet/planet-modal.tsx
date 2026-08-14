"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { clearMovement } from "@/lib/planet/input";
import { usePlanetStore } from "@/lib/planet/store";
import { SPAWN } from "@/lib/planet/world-layout";

import { Hud } from "./overlay/hud";
import { LoadingProgress } from "./overlay/loading-progress";
import { TouchControls } from "./overlay/touch-controls";
import { WebglBoundary } from "./webgl-boundary";

/**
 * The client boundary for the planet, mounted as an opt-in modal.
 *
 * This used to be `PlanetExperience`: a fixed overlay that took over the
 * landing page automatically, with the 2D portfolio server-rendered underneath
 * as a fallback. That made a first-time visitor solve a 3D scavenger hunt to
 * read a CV. The planet is now launched deliberately from the Playground tab,
 * so the fallback content is gone and the only thing behind this is the normal
 * page.
 *
 * `dynamic(..., { ssr: false })` is a hard build error inside a Server
 * Component in the Next 14 App Router, which is precisely why this file is a
 * client component. Do not inline it back into a page.
 */
const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => null,
});

/** Test hook: `?lowpower` forces the reduced-quality path on any machine. */
function probeLowPower(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const forced = new URLSearchParams(window.location.search).has("lowpower");
  return forced || coarse || cores <= 4 || memory <= 4;
}

interface Props {
  onClose: () => void;
}

/**
 * Mounted only while open. Unmounting is what tears the WebGL context down,
 * so closing genuinely stops the render loop rather than hiding it.
 */
export function PlanetModal({ onClose }: Props) {
  const [lowPower, setLowPower] = useState(false);
  const sceneReady = usePlanetStore((s) => s.sceneReady);

  useEffect(() => {
    setLowPower(probeLowPower());
  }, []);

  const close = useCallback(() => {
    // A held key must not survive the modal closing, or it stays latched for
    // whenever the planet is opened again.
    clearMovement();
    onClose();
  }, [onClose]);

  // Escape closes, matching every other modal on the site. Capture phase so it
  // wins over anything the canvas might do with the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The marker modal owns Escape while it is open. No markers ship in this
      // world today, but the store still drives that path.
      if (usePlanetStore.getState().activeId !== null) return;
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [close]);

  // Lock the page while the canvas owns the viewport, or drag-to-orbit
  // triggers pull-to-refresh and page scroll on iOS and Android.
  useEffect(() => {
    const { body, documentElement: html } = document;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overscrollBehavior;
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = prevBody;
      html.style.overscrollBehavior = prevHtml;
    };
  }, []);

  // Portalled to <body> rather than rendered in place. The launcher sits inside
  // a BlurFade, and framer-motion leaves a `transform` on that wrapper, which
  // makes it the containing block for `position: fixed` descendants: rendered
  // in place, this "fullscreen" overlay is clipped to the tab panel. A portal
  // is immune to whatever the ancestor chain does.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Planet playground"
      className="fixed inset-0 z-50 overflow-hidden overscroll-none bg-[#070b1c]"
    >
      {/* Transparent until sceneReady: models take seconds to fetch, and an
          opaque container here would show a void while they load. */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          sceneReady ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <WebglBoundary onError={close}>
          <Scene
            markers={[]}
            spawn={SPAWN}
            lowPower={lowPower}
            onContextLost={close}
          />
        </WebglBoundary>
        <Hud onExit={close} />
        <TouchControls />
      </div>

      <LoadingProgress />
    </div>,
    document.body
  );
}
