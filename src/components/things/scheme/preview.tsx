"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The ambient preview: a typewriter replaying a scripted transcript.
 *
 * Deliberately makes NO network request. Decoration on an index page should
 * never depend on a backend being reachable, and a tile that called the API
 * every time someone scrolled past would put real load on it for no benefit.
 * Keep it that way even though the service is always on now.
 *
 * Input-free by construction: nothing here is focusable and nothing listens for
 * keys. A preview is not the toy.
 */

const SCRIPT: readonly (readonly [string, string])[] = [
  ["(+ 1 2 3)", "6"],
  ["(define (sq x) (* x x))", "sq"],
  ["(sq 12)", "144"],
  ["(map sq '(1 2 3 4))", "(1 4 9 16)"],
  ["(cdr '(a b c))", "(b c)"],
];

const TYPE_MS = 45;
const PAUSE_AFTER_INPUT = 320;
const PAUSE_AFTER_OUTPUT = 900;

export default function SchemePreview() {
  const [lines, setLines] = useState<string[]>([]);
  const [typing, setTyping] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        timers.current.push(t);
      });

    async function run() {
      // Loops forever while mounted. The live budget decides how long that is.
      for (let i = 0; !cancelled; i = (i + 1) % SCRIPT.length) {
        const [input, output] = SCRIPT[i];

        for (let c = 1; c <= input.length; c++) {
          if (cancelled) return;
          setTyping(input.slice(0, c));
          await wait(TYPE_MS);
        }
        if (cancelled) return;
        await wait(PAUSE_AFTER_INPUT);

        if (cancelled) return;
        setTyping("");
        setLines((prev) => [...prev, `in> ${input}`, `out> ${output}`].slice(-8));
        await wait(PAUSE_AFTER_OUTPUT);
      }
    }

    run();
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  return (
    <div
      aria-hidden
      className="h-full w-full overflow-hidden bg-black p-4 font-mono text-[clamp(0.7rem,1.4vw,0.95rem)] leading-relaxed text-green-400"
    >
      {lines.map((line, i) => (
        <div key={`${i}-${line}`} className="truncate">
          {line}
        </div>
      ))}
      <div className="truncate">
        <span className="select-none">in&gt; </span>
        {typing}
        <span className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.15em] bg-green-400" />
      </div>
    </div>
  );
}
