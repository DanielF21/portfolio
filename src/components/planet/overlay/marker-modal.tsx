"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { usePlanetStore } from "@/lib/planet/store";
import type { MarkerContent, PlanetMarker } from "@/lib/planet/types";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

interface Props {
  markers: readonly PlanetMarker[];
}

/**
 * Subscribes to the store directly rather than taking the active marker as a
 * prop, so the component that hosts both the canvas and this modal never
 * re-renders when a marker opens. That makes the "modal open re-rendered the
 * whole r3f tree" regression structurally impossible.
 */
export function MarkerModal({ markers }: Props) {
  const activeId = usePlanetStore((s) => s.activeId);
  const close = usePlanetStore((s) => s.close);

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  const marker = activeId ? markers.find((m) => m.id === activeId) : undefined;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el.tagName === "IFRAME"
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [close]
  );

  useEffect(() => {
    if (!marker) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    // Capture phase so the global movement key handler never sees these while
    // the modal owns the keyboard.
    window.addEventListener("keydown", onKeyDown, true);

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown, true);
      restoreTo.current?.focus?.();
    };
  }, [marker, onKeyDown]);

  if (!marker) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={marker.title}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-neutral-100 shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">{marker.title}</h2>
          <button
            type="button"
            onClick={close}
            className="-mr-1 rounded-md px-2 py-1 text-sm text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            Esc
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <Panel content={marker.content} />
        </div>
      </div>
    </div>
  );
}

function Panel({ content }: { content: MarkerContent }) {
  switch (content.kind) {
    case "about":
      return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Image
            src={content.avatarUrl}
            alt="Daniel Fleming"
            width={96}
            height={96}
            className="size-24 shrink-0 rounded-full border border-white/15 object-cover"
          />
          <div className="space-y-2">
            {/* Plain text on purpose: none of the copy contains markdown, so
                pulling react-markdown into the client bundle buys nothing. */}
            <p className="text-sm leading-relaxed text-neutral-300">
              {content.summary}
            </p>
            <p className="text-xs text-neutral-500">{content.location}</p>
          </div>
        </div>
      );

    case "education":
      return (
        <ul className="space-y-4">
          {content.entries.map((e) => (
            <li key={e.school} className="flex items-start gap-3">
              <Image
                src={e.logoUrl}
                alt={e.school}
                width={44}
                height={44}
                className="size-11 shrink-0 rounded-full bg-white object-contain p-1"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={e.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  {e.school}
                </Link>
                <p className="text-xs text-neutral-400">{e.degree}</p>
                <p className="text-xs text-neutral-500">
                  {e.start} - {e.end}
                </p>
              </div>
            </li>
          ))}
        </ul>
      );

    case "skills":
      return (
        <div className="flex flex-wrap gap-1.5">
          {content.skills.map((s) => (
            <Badge key={s} className="bg-white/10 text-neutral-100 hover:bg-white/20">
              {s}
            </Badge>
          ))}
        </div>
      );

    case "resume":
      return (
        <div className="space-y-3">
          <iframe
            src={content.pdfUrl}
            title="Daniel Fleming resume"
            className="h-[60vh] w-full rounded-lg border border-white/10 bg-white"
          />
          <Link
            href={content.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-neutral-400 underline hover:text-white"
          >
            Open the PDF in a new tab
          </Link>
        </div>
      );

    case "contact":
      return (
        <div className="space-y-3">
          <p className="text-sm text-neutral-300">
            The fastest way to reach me is on either of these.
          </p>
          <div className="flex flex-wrap gap-2">
            {content.socials.map((s) => {
              const Icon =
                s.name === "GitHub"
                  ? Icons.github
                  : s.name === "LinkedIn"
                    ? Icons.linkedin
                    : Icons.globe;
              return (
                <Link
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm transition hover:bg-white/10"
                >
                  <Icon className="size-4 fill-current" />
                  {s.name}
                </Link>
              );
            })}
          </div>
        </div>
      );

    case "project": {
      const p = content.project;
      return (
        <div className="space-y-4">
          <Image
            src={p.imageSrc}
            alt={p.title}
            width={p.imageWidth}
            height={p.imageHeight}
            className="max-h-40 w-full rounded-lg border border-white/10 object-cover object-top"
          />
          <p className="text-xs text-neutral-500">{p.dates}</p>
          <p className="text-sm leading-relaxed text-neutral-300">{p.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {p.technologies.map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="bg-white/10 px-1.5 py-0 text-[10px] text-neutral-200 hover:bg-white/20"
              >
                {t}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={p.href}
              // Internal routes stay in the tab; external ones open a new one.
              {...(p.isInternal
                ? {}
                : { target: "_blank", rel: "noopener noreferrer" })}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
            >
              {p.isInternal ? "Open the demo" : "Visit"}
            </Link>
            {p.links
              .filter((l) => l.href !== p.href)
              .map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm transition hover:bg-white/10"
                >
                  {l.type}
                </Link>
              ))}
          </div>
        </div>
      );
    }
  }
}
