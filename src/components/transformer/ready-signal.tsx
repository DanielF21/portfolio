"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

import { useTransformerStore } from "@/lib/transformer/store";

/**
 * Flips `ready` after a frame has actually rendered.
 *
 * Not on mount: the stage cross-fades on this, and mounting is not the same as
 * having drawn anything. Flipping at mount shows an empty canvas for however
 * long the first frame takes, which is exactly the flash the fade exists to
 * prevent.
 */
export function ReadySignal() {
  const seen = useRef(0);

  useFrame(() => {
    if (seen.current >= 2) return;
    seen.current += 1;
    // Two frames, not one: the first can render before the instanced matrices
    // written in a layout effect have been uploaded.
    if (seen.current === 2) useTransformerStore.getState().setReady(true);
  });

  return null;
}
