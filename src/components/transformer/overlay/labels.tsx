"use client";

import { useEffect, useRef } from "react";

import { LABEL_SLOTS, view } from "@/lib/transformer/view";

/**
 * The label layer.
 *
 * A fixed pool of nodes, rendered once, driven by an rAF loop that mutates
 * `style` directly and never calls setState. `label-tracker` inside the canvas
 * has already done the projection and the declutter; this only moves boxes.
 *
 * Same arrangement, and the same reason, as the planet's compass chevrons: the
 * data changes every frame and amounts to two CSS properties per node.
 */

/** Offset from the anchor point to the label box, in CSS pixels. The leader
 *  line spans this gap. */
const DX = 22;
const DY = -26;

export function Labels() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const boxes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-label-slot]")
    );
    const lines = Array.from(root.querySelectorAll<SVGLineElement>("[data-label-line]"));
    const titles = boxes.map((b) => b.querySelector<HTMLElement>("[data-label-text]"));
    const subs = boxes.map((b) => b.querySelector<HTMLElement>("[data-label-sub]"));

    let raf = 0;
    // Remembered so the DOM is only touched when the text actually changes;
    // writing textContent every frame invalidates layout for nothing.
    const lastText = new Array<string>(LABEL_SLOTS).fill("");
    const lastSub = new Array<string>(LABEL_SLOTS).fill("");

    const tick = () => {
      raf = requestAnimationFrame(tick);

      for (let i = 0; i < boxes.length; i++) {
        const slot = view.labels[i];
        const box = boxes[i];
        const line = lines[i];

        if (!slot || slot.opacity <= 0 || slot.id === null) {
          if (box.style.opacity !== "0") {
            box.style.opacity = "0";
            line.style.opacity = "0";
          }
          continue;
        }

        box.style.opacity = "1";
        line.style.opacity = "0.4";

        // A flipped label hangs off the left of its anchor. translateX(-100%)
        // right-aligns the box on that point without measuring its width, which
        // matters because the width depends on the text.
        const dx = slot.flip ? -DX : DX;
        box.style.textAlign = slot.flip ? "right" : "left";
        box.style.transform = slot.flip
          ? `translate3d(${slot.x + dx}px, ${slot.y + DY}px, 0) translateX(-100%)`
          : `translate3d(${slot.x + dx}px, ${slot.y + DY}px, 0)`;

        line.setAttribute("x1", String(slot.x));
        line.setAttribute("y1", String(slot.y));
        line.setAttribute("x2", String(slot.x + dx + (slot.flip ? 3 : -3)));
        line.setAttribute("y2", String(slot.y + DY + 9));

        if (lastText[i] !== slot.text) {
          lastText[i] = slot.text;
          const t = titles[i];
          if (t) t.textContent = slot.text;
        }
        if (lastSub[i] !== slot.sub) {
          lastSub[i] = slot.sub;
          const s = subs[i];
          if (s) s.textContent = slot.sub;
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-30">
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {Array.from({ length: LABEL_SLOTS }, (_, i) => (
          <line
            key={i}
            data-label-line
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1}
            style={{ opacity: 0 }}
          />
        ))}
      </svg>

      {Array.from({ length: LABEL_SLOTS }, (_, i) => (
        <div
          key={i}
          data-label-slot
          className="absolute left-0 top-0 whitespace-nowrap"
          style={{ opacity: 0, willChange: "transform" }}
        >
          <div
            data-label-text
            className="font-mono text-[11px] leading-4 tracking-[0.06em] text-white"
          />
          <div
            data-label-sub
            className="font-mono text-[10px] leading-4 tracking-[0.04em] text-white/45"
          />
        </div>
      ))}
    </div>
  );
}
