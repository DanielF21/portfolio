"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * The Playground tab: a single button, nothing else.
 *
 * The planet is opt-in from here rather than being the landing page. It is a
 * toy, not a portfolio: there is nothing to find and nothing to read, so
 * dropping a first-time visitor into it cost them the actual content. Making
 * the launch deliberate means the people who want to walk around a small
 * planet get to, and everyone else gets a normal site. The controls are
 * explained inside the world itself, so there is nothing to say out here.
 *
 * The modal is `dynamic` so none of the three.js chunk is fetched until the
 * button is pressed.
 */
const PlanetModal = dynamic(
  () => import("@/components/planet/planet-modal").then((m) => m.PlanetModal),
  { ssr: false }
);

export function Playground() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-center py-12">
        <Button
          onClick={() => setOpen(true)}
          // No size variant: it would force a fixed height and rounded-md back
          // on. `whitespace-normal` undoes the base `whitespace-nowrap` so the
          // label wraps to two lines inside the circle instead of overflowing.
          className="h-44 w-44 whitespace-normal rounded-full px-6 text-base leading-snug"
        >
          Launch playground
        </Button>
      </div>

      {open && <PlanetModal onClose={() => setOpen(false)} />}
    </>
  );
}
