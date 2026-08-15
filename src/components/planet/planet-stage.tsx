"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { probeLowPower } from "@/lib/device";
import { clearMovement } from "@/lib/planet/input";
import { usePlanetStore } from "@/lib/planet/store";
import { SPAWN } from "@/lib/planet/world-layout";

import { Hud } from "./overlay/hud";
import { LoadingProgress } from "./overlay/loading-progress";
import { TouchControls } from "./overlay/touch-controls";
// Imported statically, not via next/dynamic. This module is itself only ever
// reached through a `dynamic(..., { ssr: false })` in things/loaders.tsx, so
// three.js still never enters the server bundle or the initial chunk. Nesting a
// second dynamic boundary inside a portal bought nothing and made the mount
// timing harder to reason about.
import Scene from "./scene";
import { WebglBoundary } from "./webgl-boundary";

/**
 * The planet, full screen.
 *
 * This is the "immersive" stage: /things/planet renders a poster and an Enter
 * button, and pressing it mounts this. Mounted only while open, so closing
 * genuinely tears the WebGL context down rather than hiding it.
 *
 * Portalled to <body>. Originally that was a fix for a framer-motion wrapper
 * whose `transform` became the containing block for `position: fixed`; that
 * wrapper is gone, but a fullscreen overlay should not depend on every ancestor
 * staying transform-free, and any future `transform`, `filter`, or `contain`
 * above it would silently reintroduce the bug.
 */

interface Props {
  onClose: () => void;
}

export default function PlanetStage({ onClose }: Props) {
  const [lowPower, setLowPower] = useState(false);
  const sceneReady = usePlanetStore((s) => s.sceneReady);

  useEffect(() => {
    setLowPower(probeLowPower());
  }, []);

  const close = useCallback(() => {
    // A held key must not survive the stage closing, or it stays latched for
    // whenever the planet is opened again.
    clearMovement();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Planet"
      className="fixed inset-0 z-50 overflow-hidden overscroll-none bg-[#070b1c]"
    >
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
