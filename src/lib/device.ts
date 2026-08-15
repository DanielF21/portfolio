/**
 * Client-side capability and preference probes.
 *
 * Everything here reads `window` or `navigator`, so call it from an effect,
 * never during render. All of it is cheap except `hasWebgl2`, which is cached.
 *
 * `probeLowPower` was lifted verbatim out of planet-modal.tsx rather than
 * reimplemented, including its `?lowpower` test hook, so the planet and the
 * preview tiles agree about what a weak device is.
 */

export function probeLowPower(): boolean {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  // Test hook: ?lowpower forces the reduced-quality path on any machine.
  const forced = new URLSearchParams(window.location.search).has("lowpower");
  return forced || coarse || cores <= 4 || memory <= 4;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A real pointer, i.e. hover is meaningful. */
export function pointerFine(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine)").matches;
}

export function saveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  return conn?.saveData === true;
}

let webgl2: boolean | null = null;

export function hasWebgl2(): boolean {
  if (typeof window === "undefined") return false;
  if (webgl2 !== null) return webgl2;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    webgl2 = !!gl;
    // Release it immediately. Safari caps live contexts at around 16, and a
    // leaked probe means a real canvas silently fails to create later.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

/**
 * Whether a preview may start ITSELF. A visitor pressing Play is always
 * honoured regardless of what this returns; this only governs automatic
 * activation on hover or scroll.
 */
export function canAutoActivate(): boolean {
  return (
    !prefersReducedMotion() && !probeLowPower() && !saveData() && pointerFine()
  );
}
