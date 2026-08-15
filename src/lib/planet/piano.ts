/**
 * The piano in the desert.
 *
 * Pressing E plays the NEXT note of Ode to Joy rather than a random one. Same
 * cost either way, and it is the difference between a sound effect and a reason
 * to keep pressing: a random note is exhausted after two presses, where a tune
 * that advances gives every press a different answer and an ending to reach.
 *
 * The sequence resets after a pause, so someone who wanders off and comes back
 * starts the phrase again instead of joining it halfway through.
 *
 * `main` is the opening of the Ode to Joy theme (Beethoven, 1824, public
 * domain), transposed to C so it sits in the middle of the keyboard.
 *
 * This file must never import `three`.
 */

/** Semitones above the tonic, in the order they are played. */
const SEMITONES = [
  4, 4, 5, 7, // E E F G
  7, 5, 4, 2, // G F E D
  0, 0, 2, 4, // C C D E
  4, 2, 2, // E D D
  4, 4, 5, 7, // E E F G
  7, 5, 4, 2, // G F E D
  0, 0, 2, 4, // C C D E
  2, 0, 0, // D C C
];

/** The tonic, in semitones above A4 = 440Hz. +3 puts it on C5, which is high
 *  enough that the notes ring clearly against the wind bed and low enough not
 *  to be shrill. */
const TONIC = 3;

/** Note lengths only matter for the two long ones at the end of each phrase,
 *  which is where a listener hears the shape. Everything else is a beat. */
const HELD = new Set([14, 15 + 14]);

/** Seconds of silence after which the phrase starts again. Long enough to
 *  cross the island and come back to it, short enough that leaving and
 *  returning does not drop you into the middle of a phrase. */
const RESET_AFTER_S = 6;

export const piano = {
  /** Index of the next note. */
  at: 0,
  /** Clock time of the last press. */
  lastAt: -1e9,
};

export interface PianoStrike {
  /** Frequency in hertz. */
  hertz: number;
  /** 0..1, louder for the notes that end a phrase. */
  level: number;
  /** True when this press restarted the tune. */
  restarted: boolean;
  /** True when this press finished it. */
  finished: boolean;
}

/**
 * Advance the tune by one note and report what to play.
 *
 * `now` is the r3f clock, the same one the set pieces use, so nothing here
 * needs a timer of its own or survives an unmount.
 */
export function strikePiano(now: number): PianoStrike {
  const restarted = now - piano.lastAt > RESET_AFTER_S || piano.at >= SEMITONES.length;
  if (restarted) piano.at = 0;
  piano.lastAt = now;

  const i = piano.at;
  piano.at += 1;

  return {
    hertz: 440 * Math.pow(2, (TONIC + SEMITONES[i]) / 12),
    level: HELD.has(i) ? 1.15 : 1,
    restarted,
    finished: piano.at >= SEMITONES.length,
  };
}

/** Reset on leaving the stage, so the next visit starts at the beginning. */
export function resetPiano() {
  piano.at = 0;
  piano.lastAt = -1e9;
}
