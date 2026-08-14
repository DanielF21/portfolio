/**
 * Every marker body and hero scenery model, keyed by assetId.
 *
 * `url: null` means the asset is procedural by design: `ProceduralBody` in
 * `marker-asset.tsx` builds it from primitives. A non-null URL is fetched with
 * `useGLTF` at runtime; if the fetch fails, a procedural fallback renders, so
 * a missing file degrades one marker instead of the page.
 *
 * Every GLB in `public/models/` has been normalised (gltf-transform) so its
 * origin is at the bottom centre of its bounding box. `scale` sizes the model
 * to marker proportions; `yOffset` is minus half the scaled height, which
 * vertically centres the model on the floating body origin the way the old
 * primitive bodies were centred. `labelHeight` clears the scaled model top.
 *
 * This file must never import `three`. Sources and licences are recorded in
 * `public/models/ATTRIBUTION.md`.
 */

export interface AssetDef {
  /** GLB under /models, or null for a procedural-by-design body. */
  readonly url: string | null;
  /** Uniform scale applied to the model so it reads at marker size. */
  readonly scale: number;
  /** Lift above the body origin, in local units. */
  readonly yOffset: number;
  /** Height of the floating label above the pad for this asset. */
  readonly labelHeight: number;
  /** Grounded bodies sit on the pad with no bob or spin: right for
   *  building-like assets (a hovering greenhouse reads as a bug, not a
   *  pickup). The pad + glow + label still mark them as content. */
  readonly grounded?: boolean;
}

export const ASSETS: Readonly<Record<string, AssetDef>> = {
  // House
  "picture-frame": {
    url: "/models/house/picture-frame.glb",
    scale: 1.2,
    yOffset: -0.35,
    labelHeight: 1.62,
  },
  bookshelf: {
    url: "/models/house/bookshelf.glb",
    scale: 1.0,
    yOffset: -0.44,
    labelHeight: 1.7,
  },
  workbench: {
    url: "/models/house/workbench.glb",
    scale: 1.6,
    yOffset: -0.3,
    labelHeight: 1.62,
  },
  "lectern-document": { url: null, scale: 1, yOffset: 0, labelHeight: 1.62 },
  mailbox: {
    url: "/models/house/mailbox.glb",
    scale: 0.85,
    yOffset: -0.41,
    labelHeight: 1.68,
  },

  // Machine zone
  terminal: {
    url: "/models/machine/terminal.glb",
    scale: 1.4,
    yOffset: -0.45,
    labelHeight: 1.7,
  },
  "food-stand": {
    url: "/models/machine/food-stand.glb",
    scale: 0.9,
    yOffset: -0.56,
    labelHeight: 1.8,
  },
  "satellite-dish": {
    url: "/models/machine/satellite-dish.glb",
    scale: 1.5,
    yOffset: -0.46,
    labelHeight: 1.72,
  },

  // Bio zone
  greenhouse: {
    url: "/models/bio/greenhouse.glb",
    scale: 1.5,
    yOffset: 0,
    labelHeight: 1.5,
    grounded: true,
  },
  microscope: {
    url: "/models/bio/microscope.glb",
    scale: 1.1,
    yOffset: 0,
    labelHeight: 1.45,
    grounded: true,
  },
  "dna-helix": {
    url: null,
    scale: 1,
    yOffset: 0,
    labelHeight: 1.5,
    grounded: true,
  },

  // Gallery
  "chess-knight": {
    url: "/models/gallery/chess-knight.glb",
    scale: 3.2,
    yOffset: -0.44,
    labelHeight: 1.7,
  },
  "lambda-sign": { url: null, scale: 1, yOffset: 0, labelHeight: 1.7 },
  "basketball-hoop": { url: null, scale: 1, yOffset: 0, labelHeight: 1.85 },

  // Hero scenery (rendered by scenery.tsx, inert, no pad or label). Scale in
  // SCENERY overrides; these entries just carry the URL.
  windmill: { url: "/models/house/windmill.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  rocket: { url: "/models/machine/rocket.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  generator: { url: "/models/machine/generator.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  "crystal-large": { url: "/models/bio/crystal-large.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  "mushroom-red": { url: "/models/bio/mushroom-red.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  "mushroom-tan": { url: "/models/bio/mushroom-tan.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  pavilion: { url: "/models/gallery/pavilion.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  piano: { url: "/models/gallery/piano.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  lantern: { url: "/models/gallery/lantern.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  snowman: { url: "/models/gallery/snowman.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  "tree-snow-a": { url: "/models/gallery/tree-snow-a.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  "tree-snow-b": { url: "/models/gallery/tree-snow-b.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  watermill: { url: "/models/wilds/watermill.glb", scale: 1, yOffset: 0, labelHeight: 0 },
  bridge: { url: "/models/wilds/bridge.glb", scale: 1, yOffset: 0, labelHeight: 0 },

  // Auto-placement fallback for markers with no authored placement.
  fallback: { url: null, scale: 1, yOffset: 0, labelHeight: 1.62 },
};
