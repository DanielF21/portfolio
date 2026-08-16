"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { probeLowPower } from "@/lib/device";
import { resetCapture } from "@/lib/transformer/capture";
import { useTransformerStore } from "@/lib/transformer/store";
import { BACKGROUND } from "@/lib/transformer/theme";
import { resetView } from "@/lib/transformer/view";
import { WebglBoundary } from "@/components/planet/webgl-boundary";

import { Hud } from "./overlay/hud";
// Imported statically, not via next/dynamic. This module is itself only ever
// reached through a `dynamic(..., { ssr: false })` in things/loaders.tsx, so
// three still never enters the server bundle or the initial chunk. Nesting a
// second dynamic boundary inside a portal buys nothing and makes the mount
// timing harder to reason about. Same call as the planet's.
import Scene from "./scene";

/**
 * The transformer, full screen.
 *
 * The "immersive" stage: /things/transformer renders a poster and an Enter
 * button, and pressing it mounts this. Mounted only while open, so closing
 * genuinely tears the WebGL context down rather than hiding it.
 *
 * Portalled to <body> so the fullscreen overlay does not depend on every
 * ancestor staying free of `transform`, `filter` and `contain`, any of which
 * would become the containing block for `position: fixed` and silently break
 * it.
 */

interface Props {
  onClose: () => void;
}

export default function TransformerStage({ onClose }: Props) {
  const [lowPower, setLowPower] = useState(false);
  const ready = useTransformerStore((s) => s.ready);

  useEffect(() => {
    setLowPower(probeLowPower());
  }, []);

  // These modules are singletons that outlive the stage, so they are cleared on
  // mount as well as on unmount. Clearing only on unmount leaves the next visit
  // starting mid-flight wherever the last one left the camera. The planet
  // learned this with its set pieces.
  useEffect(() => {
    resetView();
    resetCapture();
    useTransformerStore.getState().reset();
    return () => {
      resetView();
      resetCapture();
      useTransformerStore.getState().reset();
    };
  }, []);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [close]);

  // Lock the page while the canvas owns the viewport, or drag-to-orbit triggers
  // pull-to-refresh and page scroll on iOS and Android.
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
      aria-label="Transformer"
      className="fixed inset-0 z-50 overflow-hidden overscroll-none"
      style={{ background: BACKGROUND }}
    >
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          ready ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <WebglBoundary onError={close}>
          <Scene lowPower={lowPower} onContextLost={close} />
        </WebglBoundary>
        <Hud onExit={close} />
      </div>
    </div>,
    document.body
  );
}
