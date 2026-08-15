/**
 * All sound on the planet, synthesised rather than sampled.
 *
 * WHY SYNTHESIS. Every alternative meant shipping audio files, and files cost
 * three things this project is deliberately careful about: download payload
 * (the models are already ~740KB), decoded memory (`decodeAudioData`
 * resamples to the context rate, so a 60s stereo track is ~23MB of float32 no
 * matter how well it was compressed), and licence bookkeeping in
 * ATTRIBUTION.md. Filtered noise and a few oscillators cost none of those, and
 * the rest of this world is procedural anyway: the mountains, the ship and
 * every scatter prop are built from primitives in code.
 *
 * The only buffer is four seconds of white noise, shared by every bed and
 * one-shot. At a 22.05kHz context that is ~353KB, and it is the entire memory
 * footprint of the audio system.
 *
 * COST. Web Audio runs on its own thread, so none of this touches the render
 * loop or the GPU. The beds are about twenty nodes total, all `equalpower`
 * or unpanned, with no convolution anywhere.
 *
 * This file must never import `three`. It is imported by the DOM overlay for
 * the mute button.
 */

const STORAGE_KEY = "planet:muted";

/** 22.05kHz halves both memory and filter cost against the usual 48kHz, and
 *  nothing here lives above ~8kHz. Not all browsers honour the request, so
 *  everything downstream reads `ctx.sampleRate` rather than assuming. */
const PREFERRED_RATE = 22050;

/** Seconds of white noise. Long enough that the loop point is inaudible once
 *  it has been through a lowpass, short enough to stay small. */
const NOISE_SECONDS = 4;

export const audio = {
  /** False when the visitor has muted. Persisted. */
  enabled: true,
  /** True once the context exists and the graph is wired. */
  ready: false,
};

interface Bed {
  gain: GainNode;
  /** Last requested level, so a per-frame caller does not restart the ramp on
   *  every frame and stall the convergence. */
  target: number;
  /** Exposed so the surf can sweep its own cutoff. */
  filterFreq?: AudioParam;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let beds: Record<"surf" | "wind" | "sub" | "night", Bed> | null = null;
let chirpAt = 0;
/** Mirrors what the render loop last pushed, read by the chirp scheduler. */
const world = { land: 0, night: 0, inWater: false };

// ---------------------------------------------------------------- helpers

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode; the preference just does not survive the session.
  }
}

/**
 * Pink-ish noise: mostly brown, with a little white mixed back in.
 *
 * NOT WHITE NOISE, and the difference is the whole character of the ambience.
 * White noise has equal energy per hertz, so most of its power sits in the top
 * octaves where the ear is most sensitive, and putting it through a wide
 * filter produces a flat aggressive roar rather than anything natural. Brown
 * noise falls at 6dB/octave, which is what wind, surf and distance actually
 * sound like. The white left in the mix keeps enough top end for the splash
 * and footstep bursts, which would otherwise be muffled thuds.
 *
 * xorshift32 rather than the `frac(sin(x) * 43758)` hash used elsewhere in
 * this project, but only on principle: that hash is built for 2D UV
 * coordinates and this is a 1D integer ramp, which is outside what it is
 * designed for. It was suspected of imprinting a tone and it does NOT: a
 * 32768-point FFT puts the worst bin of each generator at 3.7x and 3.5x the
 * median respectively, which is ordinary periodogram variance for noise and
 * indistinguishable between them. Recorded so nobody re-investigates it.
 * The audible harshness was the wind bed's filter, not this.
 */
function makeNoise(c: AudioContext): AudioBuffer {
  const len = Math.floor(c.sampleRate * NOISE_SECONDS);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);

  let seed = 0x9e3779b9;
  const rand = () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 0x100000000;
  };

  let brown = 0;
  for (let i = 0; i < len; i++) {
    const white = rand() * 2 - 1;
    // Leaky integrator: the leak stops it wandering off into DC over four
    // seconds, which would click at the loop point.
    brown = (brown + 0.02 * white) / 1.02;
    const v = brown * 11 * 0.88 + white * 0.12;
    data[i] = Math.max(-1, Math.min(1, v));
  }
  return buf;
}

interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  q: number;
}

/** A looping noise source through a chain of filters, which is the shape every
 *  noise-based ambient bed in here takes. `filterFreq` is the FIRST filter's
 *  cutoff, which is the one worth sweeping. */
function makeBed(
  c: AudioContext,
  out: GainNode,
  specs: readonly FilterSpec[]
): Bed {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;

  let node: AudioNode = src;
  let first: BiquadFilterNode | null = null;
  for (const spec of specs) {
    const f = c.createBiquadFilter();
    f.type = spec.type;
    f.frequency.value = spec.freq;
    f.Q.value = spec.q;
    node = node.connect(f);
    if (!first) first = f;
  }

  const gain = c.createGain();
  gain.gain.value = 0;

  node.connect(gain).connect(out);
  src.start();

  return { gain, target: 0, filterFreq: first?.frequency };
}

/**
 * Night insects as a pair of detuned oscillators under a fast tremolo, rather
 * than a filtered noise band.
 *
 * Filtering crickets out of noise means a very high Q at ~4kHz, and on pink
 * noise there is almost no energy left up there to filter, so it has to be
 * boosted enormously and arrives as hiss. Crickets are nearly tonal anyway, so
 * generating the tone directly is both cheaper and more convincing.
 */
function makeNightBed(c: AudioContext, out: GainNode): Bed {
  // Two stages: `trem` pulses between 0 and 1 forever, `level` is what the
  // world state actually turns up. Two stages rather than an LFO added
  // straight onto one gain, because an additive LFO on a bed sitting at zero
  // would still chirp audibly on a daylit island.
  const level = c.createGain();
  level.gain.value = 0;
  level.connect(out);

  const trem = c.createGain();
  trem.gain.value = 0.5;
  trem.connect(level);

  for (const f of [4300, 4380]) {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    osc.connect(trem);
    osc.start();
  }

  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 7;
  const depth = c.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(trem.gain);
  lfo.start();

  return { gain: level, target: 0 };
}

/** Slowly sweeps a filter so a bed breathes instead of sitting still. A
 *  constant-amplitude noise bed is the thing that reads as tape hiss. */
function sway(c: AudioContext, param: AudioParam, depth: number, hz: number) {
  const lfo = c.createOscillator();
  lfo.frequency.value = hz;
  const amt = c.createGain();
  amt.gain.value = depth;
  lfo.connect(amt).connect(param);
  lfo.start();
}

// ---------------------------------------------------------------- lifecycle

/**
 * Builds the graph. Must be called from a user gesture, or from a page that
 * has already had one: browsers refuse to start an AudioContext otherwise.
 *
 * Safe to call repeatedly. The context is created ONCE and thereafter only
 * suspended and resumed, because Safari caps live contexts and this stage
 * mounts and unmounts every time the visitor enters and leaves.
 */
export async function unlockAudio(): Promise<void> {
  if (typeof window === "undefined") return;

  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    try {
      ctx = new Ctor({ sampleRate: PREFERRED_RATE });
    } catch {
      // Some browsers reject an explicit rate; the default is fine, it just
      // costs more memory.
      ctx = new Ctor();
    }

    audio.enabled = !readMuted();

    noise = makeNoise(ctx);
    master = ctx.createGain();
    master.gain.value = audio.enabled ? 1 : 0;
    master.connect(ctx.destination);

    beds = {
      // Surf: low and soft, the bed you hear everywhere on an ocean planet.
      surf: makeBed(ctx, master, [{ type: "lowpass", freq: 360, q: 0.6 }]),
      // Wind: BOTH ends closed. A lone highpass passes everything above its
      // cutoff all the way to Nyquist, and that top octave is exactly where
      // hiss and sibilance live, so it stayed harsh even after the roar was
      // fixed. Rolling the top off at 1.6kHz leaves only the soft airy band.
      wind: makeBed(ctx, master, [
        { type: "highpass", freq: 500, q: 0.5 },
        { type: "lowpass", freq: 1600, q: 0.5 },
      ]),
      // Submerged: everything above a couple of hundred hertz gone, which is
      // most of what being underwater sounds like.
      sub: makeBed(ctx, master, [{ type: "lowpass", freq: 200, q: 0.8 }]),
      // Night insects: not noise at all. See `night` below.
      night: makeNightBed(ctx, master),
    };

    // Waves. Sweeping the FILTER rather than the gain is what makes this read
    // as water arriving and receding instead of as a volume knob being turned.
    sway(ctx, beds.surf.filterFreq!, 150, 0.055);
    // Wind gusts, gently, and at a rate that does not line up with the surf.
    sway(ctx, beds.wind.gain.gain, 0.006, 0.083);

    audio.ready = true;
  }

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // Gesture requirement not satisfied yet; the next one will get it.
    }
  }
}

export function suspendAudio() {
  if (ctx && ctx.state === "running") void ctx.suspend();
}

export function resumeAudio() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function isMuted(): boolean {
  return !audio.enabled;
}

export function setMuted(muted: boolean) {
  audio.enabled = !muted;
  writeMuted(muted);
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.08);
  }
}

export function toggleMuted(): boolean {
  setMuted(audio.enabled);
  return !audio.enabled;
}

// ---------------------------------------------------------------- per-frame

/**
 * Smallest change worth sending to an AudioParam.
 *
 * MUST STAY WELL UNDER THE QUIETEST BED'S FULL RANGE. This was 0.02, which was
 * fine until the wind was rebalanced down to a 0.018 maximum: the very first
 * request was smaller than the threshold, so it was skipped, and the bed
 * silently never turned on at all. The quietest bed now peaks at 0.014, so
 * anything at or above ~0.007 would reintroduce the same class of bug.
 */
const RAMP_EPSILON = 0.002;

function ramp(bed: Bed, target: number) {
  // Only touch the AudioParam when the request actually moves. Restarting
  // setTargetAtTime every frame at 120fps never lets the exponential arrive.
  if (Math.abs(bed.target - target) < RAMP_EPSILON) return;
  bed.target = target;
  bed.gain.gain.setTargetAtTime(target, ctx!.currentTime, 0.35);
}

/**
 * Pushed from the render loop each frame. Cheap by construction: it compares
 * four numbers and usually returns without touching Web Audio at all.
 */
export function setAudioState(s: {
  /** 0 at sea, 1 well inland. */
  land: number;
  /** 0..1 darkness where the player is standing. */
  night: number;
  inWater: boolean;
  /** 0..1 of full walking speed. */
  speed: number;
}) {
  if (!ctx || !beds || !audio.ready) return;

  world.land = s.land;
  world.night = s.night;
  world.inWater = s.inWater;

  // Underwater swallows the airborne beds rather than layering over them.
  const wet = s.inWater ? 1 : 0;
  const dry = 1 - wet;

  // Levels are deliberately low. This is ambience under a scene with no music
  // and no dialogue, so it only has to sit at the edge of notice; the first
  // pass ran the beds three to four times hotter and the result was less
  // "windy island" than "wind tunnel".
  ramp(beds.surf, (0.05 + (1 - s.land) * 0.09) * dry);
  ramp(beds.wind, (0.005 + s.land * 0.013) * dry);
  ramp(beds.sub, 0.13 * wet);
  ramp(beds.night, 0.014 * s.night * s.land);
}

// ---------------------------------------------------------------- one-shots

/** A noise burst through a swept bandpass: the generic "impact" shape that
 *  covers footsteps, splashes and everything else percussive here. */
function burst(
  freq: number,
  endFreq: number,
  q: number,
  level: number,
  decay: number
) {
  if (!ctx || !master || !noise || !audio.enabled) return;
  const now = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = noise;
  // Start somewhere random in the noise so repeated steps are not identical.
  const offset = Math.random() * (NOISE_SECONDS - decay - 0.05);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + decay);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(level, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0005, now + decay);

  src.connect(filter).connect(gain).connect(master);
  src.start(now, offset, decay + 0.05);
  // Nodes are single-use; letting them fall off the graph on their own is
  // what keeps this from leaking one filter per footstep.
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

export type Surface = "land" | "water" | "deck";

export function footstep(surface: Surface) {
  if (!audio.ready) return;
  const v = 0.9 + Math.random() * 0.25;
  if (surface === "water") {
    burst(900 * v, 300, 1.1, 0.1, 0.22);
  } else if (surface === "deck") {
    // Hollow and woody: a lower band with a longer tail than soil.
    burst(320 * v, 150, 3.5, 0.11, 0.16);
  } else {
    burst(620 * v, 220, 1.6, 0.075, 0.1);
  }
}

/** `strength` 0..1, from how hard the water was entered. */
export function splash(strength: number) {
  if (!audio.ready) return;
  burst(1700, 400, 0.8, 0.1 + strength * 0.18, 0.35 + strength * 0.25);
}

export function landThud() {
  if (!audio.ready) return;
  burst(240, 90, 2.2, 0.14, 0.2);
}

/** The throw: a short upward whoosh, quiet, because it is your own arm. */
export function snowThrow() {
  if (!audio.ready) return;
  burst(700, 2200, 0.7, 0.06, 0.16);
}

/** The landing: dead and dry, with no ring. Snow does not ping. */
export function snowImpact() {
  if (!audio.ready) return;
  burst(1100, 260, 0.9, 0.07, 0.12);
}

/** The trampoline: a low boing, which is the springs rather than the mat. */
export function bounceSound() {
  if (!audio.ready) return;
  burst(180, 640, 3.2, 0.12, 0.3);
}

/**
 * One piano note.
 *
 * Three partials at 1x, 2x and 3x with the upper two much quieter, a very fast
 * attack, and a decay that is longer for low notes than high ones. That last
 * part is what stops a synthesised note reading as an organ: on a real string
 * the top of the keyboard dies away in under a second while the bottom rings
 * for several.
 *
 * `hertz` rather than a note name, because the caller owns the tune and this
 * owns the timbre.
 */
export function pianoNote(hertz: number, level = 1) {
  if (!ctx || !master || !audio.enabled || !audio.ready) return;
  const now = ctx.currentTime;
  const decay = Math.min(2.6, 150 / hertz);

  for (const [mult, amp] of [
    [1, 0.09],
    [2, 0.03],
    [3, 0.012],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = mult === 1 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(hertz * mult, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(amp * level, now + 0.006);
    // Upper partials fade first, as they do on a string.
    g.gain.exponentialRampToValueAtTime(0.0004, now + decay / mult);

    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + decay + 0.05);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
}

/** Wood under strain: the mill starting, and the mill giving up. */
export function millCreak(starting: boolean) {
  if (!audio.ready) return;
  if (starting) burst(140, 420, 2.4, 0.09, 0.55);
  else burst(420, 130, 2.4, 0.07, 0.7);
}

/** A snowball finding something solid. Duller and heavier than the sound of
 *  one hitting the ground. */
export function snowSmack() {
  if (!audio.ready) return;
  burst(520, 150, 1.2, 0.11, 0.22);
}

/** The knight landing on its next square: stone on stone. */
export function chessClack() {
  if (!audio.ready) return;
  burst(1500, 380, 2.6, 0.08, 0.14);
}

/**
 * Rocket launch: a long low roar that swells and then recedes.
 *
 * Deliberately not a `burst`, which is shaped for impacts with an instant
 * attack and an exponential tail. An engine does the opposite: it builds over
 * the ignition hold and then fades as the thing climbs away, so this rides a
 * gain envelope of its own across the full flight.
 */
export function rocketLaunchSound() {
  if (!ctx || !master || !noise || !audio.enabled) return;
  const now = ctx.currentTime;
  const DUR = 9;

  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(180, now);
  lp.frequency.linearRampToValueAtTime(620, now + 2.2);
  lp.frequency.linearRampToValueAtTime(120, now + DUR);
  lp.Q.value = 1.4;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 1.6); // ignition hold
  gain.gain.setValueAtTime(0.3, now + 2.4);
  gain.gain.exponentialRampToValueAtTime(0.0005, now + DUR); // climbing away

  src.connect(lp).connect(gain).connect(master);
  src.start(now);
  src.stop(now + DUR + 0.1);
  src.onended = () => {
    src.disconnect();
    lp.disconnect();
    gain.disconnect();
  };
}

/**
 * A bird: two or three quick tones with a rising then falling pitch. Called
 * on a timer rather than tied to any particular bird on screen, because the
 * flock is decoration and the point is only that the daytime sounds inhabited.
 */
function chirp() {
  if (!ctx || !master || !audio.enabled) return;
  const now = ctx.currentTime;
  const base = 1900 + Math.random() * 1400;
  const notes = 2 + Math.floor(Math.random() * 2);

  for (let i = 0; i < notes; i++) {
    const t = now + i * (0.075 + Math.random() * 0.05);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const g = ctx.createGain();

    const f = base * (1 + i * 0.12);
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.03);
    osc.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.09);

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.1);

    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.12);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
}

/**
 * Scheduler for the ambient birds, driven from the render loop's clock so it
 * needs no timer of its own and stops dead when the scene unmounts.
 *
 * Birds only in daylight, only near land, and never with your head underwater.
 */
export function tickAmbience(elapsed: number) {
  if (!ctx || !audio.ready || !audio.enabled) return;
  if (elapsed < chirpAt) return;

  const daylight = 1 - world.night;
  const likely = world.land * daylight * (world.inWater ? 0 : 1);
  // Reschedule regardless, so the next check is cheap even when silent.
  chirpAt = elapsed + 1.6 + Math.random() * 4.5;
  if (likely > 0.25 && Math.random() < likely) chirp();
}
