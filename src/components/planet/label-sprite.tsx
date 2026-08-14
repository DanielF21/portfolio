"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * In-world text labels drawn to a 2D canvas and used as a sprite texture.
 *
 * The obvious alternative, drei's <Text>, pulls troika (~90KB) and fetches a
 * font from a CDN at runtime. This has no extra dependency, no network
 * request, and sprites face the camera for free.
 */

const FONT_PX = 64;
const PAD_X = 28;
const PAD_Y = 16;

interface Built {
  texture: THREE.CanvasTexture;
  aspect: number;
}

function buildLabel(text: string, muted: boolean): Built | null {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;

  const font = `600 ${FONT_PX}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  measure.font = font;
  const textWidth = measure.measureText(text).width;

  const w = Math.ceil(textWidth + PAD_X * 2);
  const h = Math.ceil(FONT_PX + PAD_Y * 2);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.arcTo(w, 0, w, r, r);
  ctx.lineTo(w, h - r);
  ctx.arcTo(w, h, w - r, h, r);
  ctx.lineTo(r, h);
  ctx.arcTo(0, h, 0, h - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();

  ctx.fillStyle = muted ? "rgba(9, 12, 28, 0.55)" : "rgba(9, 12, 28, 0.82)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = muted
    ? "rgba(148, 178, 255, 0.28)"
    : "rgba(168, 200, 255, 0.75)";
  ctx.stroke();

  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = muted ? "rgba(226, 234, 255, 0.7)" : "#ffffff";
  ctx.fillText(text, w / 2, h / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return { texture, aspect: w / h };
}

interface Props {
  text: string;
  /** World height of the label in units. */
  height?: number;
  muted?: boolean;
  position?: [number, number, number];
  renderOrder?: number;
}

export function LabelSprite({
  text,
  height = 0.42,
  muted = false,
  position = [0, 0, 0],
  renderOrder = 10,
}: Props) {
  const built = useMemo(() => buildLabel(text, muted), [text, muted]);

  useEffect(() => {
    return () => {
      built?.texture.dispose();
    };
  }, [built]);

  if (!built) return null;

  return (
    <sprite
      position={position}
      scale={[height * built.aspect, height, 1]}
      renderOrder={renderOrder}
    >
      {/* depthTest stays on so labels on the far side of the planet are
          correctly occluded rather than floating over the horizon. */}
      <spriteMaterial
        map={built.texture}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
