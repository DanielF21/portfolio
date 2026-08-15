# dsf-portfolio

Next 14 App Router portfolio. Most of it is ordinary; the planet is not, and
almost everything below is about the planet.

## Verifying changes

**Never run `next build` in this repo.** Verify with:

```
npx tsc --noEmit
pnpm lint
pnpm dev          # then open the page and actually look at it
```

## The planet

A walkable low-poly world at `/things/planet`, reached through a poster and an
Enter button (`stage: "immersive"` in `src/data/things.ts`). It is a creative
piece, not a portfolio device: it used to carry 14 content markers built from
the resume, and those were deliberately removed. `PlanetStage` and
`PlanetPreview` both pass `markers={[]}`, and the marker subsystem is kept
dormant for future interactive set pieces rather than deleted.

### The three-free rule

Nothing in `src/lib/planet/` or `src/components/planet/overlay/` may import
`three`. Those modules are pulled in by the eagerly-loaded DOM overlay, so a
value import of three there hoists the entire library out of the lazy chunk and
into the shared bundle. three enters only through the
`dynamic(..., { ssr: false })` boundary in `src/components/things/loaders.tsx`.

Every affected file says so in its header. Keep saying so.

### Colour space

The terrain and every scatter prop write LINEAR values straight from
`biomeColor` (around 0.35). A hex string like `color="#5c5f6e"` goes through the
sRGB decode and lands at linear 0.11, roughly three times darker than
everything around it, which reads as a hole cut in the world rather than as a
dark object. This has caused two separate bugs.

- Procedural scenery bakes linear vertex colours (see `Mountain` in
  `scenery.tsx`, and the `tint` field on `SceneryItem`).
- GLTF models go through `fixGltfMaterials` in `components/planet/gltf-fixup.ts`,
  which lifts near-black base colours and clamps the glTF
  metallicFactor-defaults-to-1 case (fully metallic renders black with no
  environment map).

### Collision

Colliders are angular caps on the sphere: a direction plus an angular radius
(`components/planet/colliders.ts`). The pushout in `player.tsx` is applied as a
ROTATION of the whole frame, not a displacement of `posDir`. That is what keeps
`faceDir`, `camDir`, `moveFrame` and `moveDir` tangent, and it is why
`window.__planet.tangentErr` must stay at exactly 0. If you change collision,
check that number first.

Caps model long thin things (the bridge) and concave things (the pavilion)
badly. The fix when it matters is more caps per object, not a different
primitive: that keeps the closed-form pushout and the single-rotation property.
`extraCaps` on a `SceneryItem` is that fix, and the mill house uses it: offsets
in world units in the item's own tangent frame, so they are the same numbers the
geometry is authored with.

`COLLIDE_WITH_SCATTER` in `config.ts` toggles whether scattered props collide.
Currently off, so only the 30 authored landmarks do.

### Flat things on a round world

Authored scenery is built in a tangent frame, which is a lie that only holds
near the origin: a point `d` units out sits `d^2 / (2R)` above the sphere, which
is 8cm at 1.6 units and 70cm at 4.7. A house can be built flat. A fenced field
cannot, and built flat its far corner hangs in the air.

`components/planet/surface-bend.ts` is the fix, and it is placement, not
deformation: each PART is built at the local origin and carried out to its spot
by a rotation about the planet's centre, which is the same "moving is rotating"
rule the walk, the collision pushout and the ship all follow. `MillHouse` places
every piece that way, and the ship's wake is built vertex by vertex with
`bendPoint` for the same reason (it runs 9 units astern).

### Assets

Models live in `public/models/`, normalised with gltf-transform so the origin
sits at bottom centre. Sources and licences are in
`public/models/ATTRIBUTION.md`, and **that file is required**: five of the
models are CC-BY 3.0, not CC0. Do not remove it. Add a row for every new model.

`collideHeight` values in `world-layout.ts` are measured off each GLB's
accessor min/max, not estimated. Re-measure rather than guess if you rescale
something.

### The sky

The sun does not orbit; the **planet turns**. So the sun, moon, stars, gas
giant and constellations all live in ONE group in `sky.tsx` that rotates about
`SPIN_AXIS` (`lib/planet/daylight.ts`) by `2 * PI * phase`. The sun's world
position falls out of the group rotation rather than being set separately,
which is what keeps it consistent with the key light by construction.

`SPIN_AXIS` is the normal of the plane `sunDirection` sweeps. **Change one and
you must change the other**, or the constellations will drift against the sun.

Constellations (`lib/planet/constellations.ts`) are authored as flat 2D plates
placed at a direction, not as right ascension and declination. Real coordinates
would buy nothing: this is not Earth's sky, only the shapes need to be
recognisable.

The telescope is the payoff for the sky being a real system. It picks whichever
constellation is highest over where it stands, so the view changes with the hour
and never aims at the ground. Two things about it are worth keeping:

- **The camera is not rewritten, only re-aimed.** Looking through it changes
  the look TARGET and narrows the fov, and the orbit, the damping and every
  invariant the walk expresses through the camera are untouched. The swing up
  to the sky and back is `CAM_LOOK_SMOOTH` doing it for free.
- **The look target is built from the camera, not from the character.** A point
  90 units out from the character's head, viewed from 13.5 units behind it, is
  8.8 degrees off the star, which at a 22 degree fov is most of the way to the
  edge of the frame. Measured, then fixed to 0.0 by using `desired`.

The stars brighten while you are at the eyepiece (`sky.tsx` reads
`telescope.at`). Without it the instrument honestly shows nothing for most of
the day, since the sky it points at is real.

### Interactables

`lib/planet/interactables.ts` revives the proximity machinery left over from
the removed portfolio markers: `player.tsx` still had the enter/exit
hysteresis, `input.ts` still bound E, the store still had `nearbyId`. Positions
come from `SCENERY` rows (matched by `id`) so an interactable cannot drift from
the object it belongs to. `dynamic: true` on a scenery row means "a dedicated
component draws this"; the row still supplies placement, keep-out and collider.

Set-piece timing lives in `lib/planet/setpieces.ts` as pure functions of the
r3f clock, so there is no animation state to desync and unmounting mid-flight
leaves nothing behind.

The helm and the knight are the exceptions to "positions come from `SCENERY`":
both move, so their interactables resolve a direction per call (`dirAt`) out of
`ship-state.ts` and `knight.ts`. Anchoring a prompt to the row instead leaves it
behind the thing it belongs to.

What answers E, in precedence order: a snowball in hand throws it first (see
`HELD_SNOWBALL_ID`), then the wheel or the eyepiece if you are at one, then
whatever you are standing next to. Anything that takes the movement keys must
also be offered unconditionally while it holds them, or there is no way out of
it: the helm and the telescope both do this.

Each set piece keeps its state in a three-free module of its own
(`piano`, `knight`, `mill`, `telescope`, `snowballs`, `targets`, `setpieces`),
and `player.tsx` clears them all on mount as well as on unmount, since those
modules outlive the stage.

`targets.ts` is what a snowball can hit. The reaction is a WOBBLE rather than
anything coming apart, because every candidate is a single merged GLB mesh: the
snowman's head is not a separate node. Pressing a key on the piano registers a
hit on itself through the same registry, which is why the instrument nods when
it sounds.

### The ship

`lib/planet/ship.ts` holds what is authored and constant (dimensions, deck
heights, where it starts). `lib/planet/ship-state.ts` holds the live pose,
because the wheel makes the ship's position a variable. `pirate-ship.tsx` (the
hull), `player.tsx` (the deck you stand on, and the helmsman's position) and
the helm interactable all read that one state, so they cannot disagree.

Three things worth knowing before changing it:

- **The bow tangent is carried, not derived.** `shipState.fwd` is transported
  every frame, exactly as the player's `faceDir` is. The obvious alternative,
  a scalar heading measured against `tangentToward(dir, continent)`, has a
  singularity at the reference point and its antipode, and unlike the player
  the ship can sail into it.
- **Grounding is tested at the BOW**, against the same island-weight field that
  paints the shoreline, so the water the ship refuses to leave is the water you
  can see. Turning still works aground, which is why grounding refuses the
  step rather than freezing the ship: you can always steer off.
- **Deck riders are carried by the ship's own rigid motion** (`yawAxis` /
  `stepAxis` on `shipState`), applied through the same `transportFrame` the
  walk and the collision pushout use. Never displace `posDir` on its own.

The wake is not decoration. While you have the wheel the camera is carried by
the ship, so the hull, the deck and the helmsman are all motionless in frame and
the foam is the only thing on screen that says the ship is moving. That is also
why `SHIP_MAX_SPEED` is faster than a walk: at the original 4.2 with a 2.6s
ramp, one second of full helm moved the ship 0.72 units and the throttle looked
broken, while the turn at 31 degrees a second looked fine.

The ship's anchorage sits nearly on the pole of the sun's path, so it is in
permanent twilight there. That is a consequence of `SPIN_AXIS`, not a bug, and
it makes the ship awkward to inspect in a screenshot; freezing `?time=0.7964`
is as light as it gets at that spot.

### Audio

All synthesised in `src/lib/planet/audio.ts`, no sample files: filtered noise
beds plus a few oscillators. The only buffer is four seconds of pink-ish noise
(~353KB at the 22.05kHz context), which is the whole memory footprint.

Things that bit, and will again if changed carelessly:

- **Use pink/brown noise, not white.** White has equal energy per hertz, so a
  wide filter on it produces a flat aggressive roar. The first wind bed was a
  bandpass at 430Hz on white noise and sounded like a tornado.
- **Levels belong near the edge of notice.** The beds sit at 0.01 to 0.14.
- **One AudioContext, ever.** Suspend and resume it; never close and recreate.
  Safari caps live contexts and the stage mounts on every entry, the same trap
  `hasWebgl2` guards against for WebGL.
- **Unlock only from a gesture.** `PlanetStage` mounting is downstream of the
  Enter button, which is why unlocking there always works.
- **Do not restart `setTargetAtTime` every frame** or the exponential never
  arrives. `ramp()` only touches an AudioParam when the request actually moves.

### Dev hooks

| Hook | What it does |
|---|---|
| `?lowpower` | Forces the reduced-quality path on any machine |
| `?colliders` | Draws every collider as a ring (green = clearable by a jump, salmon = solid) |
| `window.__planet` | Per-frame readout: posDir, faceDir, tangentErr, radius, alt, fps |
| `window.__planet.shipDir` / `.helmDir` | Where the ship and its wheel are right now; feed either to `__planetSetPos`, since it is a long swim out and the wheel is a small target |
| `?time=` | Pins the day/night cycle to a phase in 0..1 |
| `window.__planetDraws` | Renderer draw calls and triangle count |
| `window.__planetColliders` | The live collider list |
| `window.__planetSetPos(x, y, z, [facing])` | Teleport, for testing poles and edge cases |

### Testing the planet in a browser

A backgrounded Chrome tab throttles `requestAnimationFrame`, so the render loop
only advances when a screenshot forces a frame, and `await requestAnimationFrame`
hangs outright. Drive the simulation with `__planetSetPos` plus synthetic
`KeyboardEvent`s, and step frames by taking screenshots.

## Potential next path: terrain elevation

Not built, recorded here so the option stays on the table.

Displace the sphere so the islands have hills, cliffs, a volcano crater and
valleys instead of being a perfectly smooth ball. This is the single biggest
change available and it is not a local one: the walk, the camera clearance,
prop placement and collision all currently assume a constant radius, and every
one of them would have to read a height field instead.

It would also unlock things that are currently faked. The water shell fades out
across the beach band because land and sea sit at exactly the same radius
(`WATER_HEIGHT` is only enough to lift the surface to shin height); with real
elevation the coastline becomes geometry rather than a colour boundary, and
coves, cliffs and genuinely deep water become possible.
