# dsf-portfolio

Next 14 App Router portfolio. Most of it is ordinary. Two things are not: the
planet, and the transformer, and almost everything below is about those two.

## Verifying changes

**Never run `next build` in this repo.** Verify with:

```
npx tsc --noEmit
pnpm lint
pnpm dev          # then open the page and actually look at it
```

## Writing

Two shapes live under `content/writing/`, and they stay disjoint by structure
rather than by filtering:

```
content/writing/
  <slug>.mdx              a one-off        -> /writing/<slug>
  <series>/index.mdx      the hub's prose  -> /writing/<series>
  <series>/<part>.mdx     a part           -> /writing/<series>/<part>
```

A subdirectory is a series and its name must match a `slug` in
`src/data/series.ts`. Inside it, **a file with a `part` number is a part and a
file without one is an appendix**: supporting material the parts link into,
reachable at its own URL, listed under "Supporting", and absent from the
sequence and the prev/next pager. That one field is the whole distinction, so
there is no second flag to keep in sync with it.

`/writing/<series>` and `/writing/<one-off>` are the same route. Next refuses
two differently named dynamic segments at one position, so `[slug]/page.tsx`
resolves the series registry first and falls through to a one-off. `oneOffs()`
throws if a top-level file name collides with a series directory, because the
series would silently win and the article would be unreachable.

### Nothing describes unwritten parts

There is no `parts` list, no `totalParts`, and no status field in
`series.ts`. A series is exactly as long as its directory. "Part N of M" takes M
from what exists, and the end of a series renders no next link rather than a
disabled one. A count in the registry is a roadmap in disguise, and it goes
stale the moment a planned engine is dropped.

### Pipeline order

`markdownToHTML` in `src/data/mdx.ts`. Two orderings bind and the rest is free:
`remarkGfm` before `remarkRehype` (it extends the grammar), and `rehypeSlug`
before `collectHeadings` (it reads the ids). **Without `remarkGfm` every table
renders as literal pipe characters**, and the tables are most of the substance.

Listing is deliberately separate from compiling. `listDocs` reads frontmatter
and stops; `getDoc` compiles. Indexes, the sitemap and both
`generateStaticParams` need only the former, and compiling means Shiki over
every block.

Tables are wrapped in `.table-scroll` by a local plugin. The scroll must live on
the wrapper: `display: block` on a `<table>` stops it being a table for layout
and all columns come out equal width, which is exactly what a column of
measurements must not do.

### Code blocks and prose CSS

Three things in `globals.css` bit, all from `@tailwindcss/typography` defaults
meeting `rehype-pretty-code`:

- **`keepBackground: false`** means Shiki does not paint a background, so
  typography's `--tw-prose-pre-bg` showed through. It is dark in both themes,
  and the light palette supplies dark text, so every block was dark on dark.
  `.prose pre` now uses `bg-muted`, which flips with the theme.
- **A fence with no language is never highlighted**, so it keeps typography's
  pale `--tw-prose-pre-code`, which is invisible on a light surface. Not an
  edge case: none of the fences in the writing declare a language, because they
  hold arithmetic and directory trees. `.prose pre code:not([data-theme])`
  fixes it without touching highlighted blocks.
- Typography puts **literal backticks** around inline code via `::before` and
  `::after`. Prose that names an identifier every other sentence gets two stray
  glyphs per mention.

Line numbers are opt in via `[data-line-numbers]`. An unscoped rule used to
number every block on the site.

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

## The transformer

An orbitable Qwen2.5-1.5B at `/things/llm`, titled "Language Model", same
immersive stage pattern as the planet. Three-free rule applies identically:
nothing in `src/lib/transformer/` or `src/components/transformer/overlay/` may
import `three`.

**The URL and the source tree disagree on purpose.** The slug, the title and
`public/things/llm/` say language model, because the thing on screen is a whole
model: an embedding, 28 blocks, and the embedding again. The code directories say
transformer, because the subject of almost every file in them is the block. Only
three places bridge the two, and all three are commented: the registry entry in
`things.ts`, the `llm` key in `loaders.tsx` (keyed by slug, loading a module
named for the block), and the capture URL.

### Every number is derived

`config.ts` holds the real `config.json` and nothing else. `model.ts` turns it
into a graph of named tensors and computes every shape, parameter count and byte
figure from it. Labels, the inspector and the geometry all read that one source,
so a label cannot disagree with the box beside it.

Nothing is hard-coded that could be derived, and nothing is invented. Check:
non-embedding params come out at 1.31B, which is what Qwen's own model card
publishes, so the biases and the tied embedding are being counted correctly.

**The colour convention is the OPPOSITE of the planet's.** Every colour here is
an sRGB hex string and goes through R3F's colour management. The planet writes
linear values into vertex colours. Both are internally consistent; mixing them
is the bug. Never hand-write a linear vertex colour in this scene.

### Area is parameter count

Both axes go through one scale: `widthFor` takes a tensor's OUTPUT dimension and
`heightFor` its INPUT one. Since `area = out * in * WIDTH_SCALE^2` and
`params = in * out`, **a weight slab's on-screen area is its parameter count**,
with no tuning. Biases put it 0.07% out; the constant is `3.8147e-6` units per
parameter.

What that buys, none of it composed: gate and up come out 17.5 wide and down
17.5 tall, so a matrix and its transpose-shaped inverse are perpendicular
because they are, and all three have the same area because all three have
13,762,560 parameters. K and V are a sixth of Q's width and therefore a sixth of
its area. Every projection is the same height because they all read the same
1,536 wide stream.

**Which axis is which is not free.** `tensor-slab` maps columns across the face
and rows up it, and every caller passes `rows = input, cols = output`. Swapping
them transposes every matrix in the scene AND turns the Q/K/V comparison from a
width comparison into a height one, which is the reading its camera pose exists
to make.

Three documented departures, all deliberate and all commented at the constant:

- **`CONDUIT_W`**: the long run of residual stream between blocks is schematic.
  At true section a 40-unit bar has more surface area than everything else
  combined and renders as a girder with small dark fins attached. The comparison
  that matters is local, and the MLP taper still starts at the true width.
- **The vocabulary axis** is 297 units against a 3 unit stream, so the embedding
  wall is drawn with a VISIBLE break and the true count on the label. A silent
  squash would make 151,936 rows look like a few dozen.
- **The intermediate axis**, since Daniel asked for the MLP closer in size to the
  parts around it. `widthFor(8960)` is 17.5 and that is the truth: gate, up and
  down hold 13,762,560 parameters each, 5.8x Q, and to scale the MLP towers over
  everything near it. It is drawn at `INTERMEDIATE_DRAWN` (7.0) with the SAME
  device the vocabulary axis gets: real cells at the real pitch, a visible break,
  the true count on the label. A silent squash was not available, because the key
  on screen states the rule in parameters per square unit.

**Elision breaks area proportionality**, so the on-screen key names the exception
itself: "Where an axis is too long to draw it is broken, not squashed." Area is
parameter count for every weight whose axes are drawn whole.
- **`MIN_AXIS`**, the bottom end of the rule and the mirror of `ELIDE_ABOVE`. A
  [1536] vector's second axis is `heightFor(1)` = 0.002 units, sub-pixel at every
  distance. Floored slabs are drawn at `MIN_AXIS` **and outlined**, and the detail
  panel says why. A marked overstatement is honest; the silent 270x one this
  replaced was not.

### One vertical grammar

**Two levels exist and nothing sits between them.** The stream at y = 0 is the
datum: the bus, the 28 collapsed plates and both ends of the model. The branch at
`BRANCH_Y` exists only inside an open block, and everything there is bottom
aligned on it and grows upward.

**Nothing in a block may straddle the baseline.** `layout.ts` declared that rule
and five things broke it: the RoPE bank, both head rows, the fan and the score
grid were centred on the branch, so half of each hung below the line the
projections feeding them grew up from, and the whole key/value row sat under it.
Measured, the station centres ran 1.04, 2.50, 3.58, 4.00, 7.34 and 11.38. That
column is what "the individual items are different sizes centred at different
points" was describing. Stations share an EDGE, not a centre; the difference
between their centres is the parameter counts and is meant to be read as size.

**A collapsed block stands ON the stream**, its underside on the conduit's top
face. It used to float a branch height above on a 0.5 wide post, 5.95% of the
plate's silhouette and the *bright* element against a near-background plate. The
open block still lifts its machinery onto the branch, and that needs no code:
`OnBranch` is a child of the group `Block` scales by `view.explode`, so the
branch height is 0 when shut and `BRANCH_Y` when open.

Two things had to come with that, and both are load bearing:

- **The hero plate collapses toward the block's ORIGIN**, not its own centre.
  The interior grows from y = 0, so a plate shrinking about its own centre
  vanishes to a point 2.8 units above where its contents appear and the bloom
  visibly tears.
- **The contact lip.** A plate is 4.2 wide over a 1.0 conduit, so standing them
  on it hides nearly all of the stream. And the deleted taps were the one bright,
  easily hit thing at the overview, which is exactly what "clicking a block does
  nothing" hinged on. A lip at the plate's FULL width does both jobs and says
  something truer than a 0.5 spike: a block touches the bus across its footprint.

### The model is a loop, because the weights are tied

Qwen ties the output projection to the token embedding, so there is ONE 233M
tensor. It used to be drawn twice, 47 units apart, with the tying stated only in
a caption; two identical walls at opposite ends of a stack read as two tensors
however they are labelled.

Now: the wall stands once at the input end, the stream leaves one of its ROWS,
runs through all 28 blocks, meets the **final norm** at the output end (1,536
parameters `model.ts` has always declared and the geometry never drew), drops to
`RETURN_Y` and comes back underneath to the same wall, where the logits leave the
far face.

- **The wall is seated so a row lands on y = 0**, not the break. `WALL_Y` derives
  that from `GAP_H` and `ROW_H`; a group at y = 0 would have the stream emerging
  from the elision.
- **`END_GAP` is exported and both files read it.** `stack.tsx` placed the wall
  at 4.5 while `residual.tsx` overshot the stack by its own `PAD` of 1.6, leaving
  a 2.9-unit air gap between the end of the bus and the thing it flows out of.
  Two constants that had to agree with no mechanism making them.
- **Two names, one tensor, in the pick layer.** A mesh carries one `nodeId`, so
  the wall gets two invisible `PickBox`es: the model side answers `embed`, the
  far side `lm_head`. That is the tie made hoverable rather than captioned, and
  it costs no draw call and no framing.
- **The return runs in the one band nothing else occupies**, between the stream's
  underside at -0.275 and the ground at -3.2. It is slimmer and dimmer than the
  stream, and that is a real difference: the stream carries [seq, 1536], what
  comes back for the logits is the last position only. If it ever competes with
  the stream, segment it rather than thinning it.

### Nothing is ever shown in isolation

**Focus frames and marks. It does not remove.** Selecting anything points the
camera at that subtree, draws corner brackets round it and opens its block. The
other 27 blocks, the two ends, the stream and every sibling station stay drawn.

This replaced the opposite rule, and the reason is worth keeping. The stations
sit in a line along Z and every tensor face points along ±Z, so a camera square
on to a face looks straight down the line at everything upstream. Hiding the
siblings fixed that and cost the piece its entire explanatory value: clicking
"RMSNorm" produced a bar on a stick in an empty frame, and "Scores, and the mask"
a staircase belonging to nothing. Someone who already knew the answer could read
it; nobody else could.

The line-of-sight problem now lives in the geometry, where it can be solved
rather than hidden:

- **`STATION_SEQUENCE` in `layout.ts`** spaces the stations for an off-axis
  camera. An occluder `u` upstream is thrown `u * sin(theta)` sideways, so two
  stations of half width `wA`, `wB` separate once `u * sin(theta) > wA + wB`.
  Half widths run 1.3 to 1.7, so consecutive stations need about 4.5 units.
- **`IN_BLOCK = 0.8` in `glossary.ts`** is that theta, and every in-block pose
  uses it. Authoring a different azimuth for one shot silently invalidates the
  spacing for that shot. Faces come out at 70% width; foreshortening is a uniform
  scale along one axis, so every ratio the piece claims survives it exactly.
- **A close-up rescues itself.** Anything more than `distance / cos(theta)`
  upstream is behind the camera. That is what the 15 unit gap after the MLP is
  for: `gate` is 17.5 wide against an add junction 1.5 wide, so no azimuth moves
  it aside and the only fix is to get past it. Its `fill` is high for the same
  reason, since standing further back puts more of the MLP in front.
- **An occluder smaller than its subject is tolerated**, deliberately. A 0.16
  tall norm bar silhouetted against the MLP's grid costs nothing and says where
  the two sit relative to each other.

The station span is 49.6 units and the block's full extent a little more, which
is most of the length of the whole 28 block stack. That is not a chosen scale: it is what an exploded view of an
object whose largest part holds 88% of its mass has to look like.

**`branch.tsx` is the rail the stations stand on, and it is the second attempt.**
The first ran CENTRED on `BRANCH_Y` while the stations were bottom aligned at
exactly `BRANCH_Y`, so it cut a 0.17 notch into the underside of every one of
them and passed clean through the interior of the three that were centred rather
than aligned (2 of 8 RoPE dial rows, 4 of 12 fan ribbons, 2 of 12 score rows).
That one was deleted.

Two rules make the second one work, and both are one line each:

- **The rail's TOP FACE is the baseline.** It sits entirely below everything, so
  the stations rest on it instead of being skewered by it. Combined with the
  alignment pass, nothing crosses that line at all any more.
- **It does not overhang.** Each run stops at the outermost geometry it connects
  (`JUNCTION_RUN` upstream of the junction, where the add's branch body is), so
  there is no stub protruding past the end stations into empty space.

Schematic cross section, for the reason set out at `CONDUIT_W`: the tensor on the
branch is [seq, 1536] for most of its length but not inside attention or inside
the MLP, and both of those are drawn at true proportion in the station where you
look at them.

### Clicking

**Everything in the scene is a destination, and the destination is read off the
scene graph.** `usePick` takes the dotted path `Scope` provides through context
and focuses it; the index is keyed by the same paths, so clicking a slab inside
`block.attn.qkv` goes there and cannot drift from it. The alternative was a
hand-written table from node id to index entry, which is a second copy of the
tree. A scope with no index entry simply does not navigate, which is how the
residual stream and the two ends stay hoverable without being destinations.

**Clicking any of the 28 opens a MIDDLE one** (`store.openBlock`). They are the
same structure; the only thing that differs is how much room they have to open
into, and blooming block 0 or block 27 is lopsided for a reason that means
nothing about the model. The layer stepper is still there for a specific one.

**THERE IS NO `onClick` ANYWHERE IN THIS SCENE, AND THAT IS THE WHOLE POINT.**
Selecting used to ride on the browser's `click`, delivered to the canvas and
dispatched by r3f. It took five rounds to fix "clicking a block does nothing"
because four of them tuned a handler that, for a real mouse, was never running.

The mechanism: the controls called `setPointerCapture` on the canvas host, and
**pointer capture retargets the compatibility mouse events**, so `mouseup` and
therefore `click` go to the CAPTURE element rather than to the element under the
cursor. The orbit kept working because it listens on the host, which is the
capture element; the canvas simply stopped receiving clicks. Hover was unaffected
because nothing is captured while merely moving.

It was invisible from the console and invisible to automation, because
CDP-synthesised input does not travel that path. Every round of "verified" was
verified against the one input method that could not reproduce it.

So the click is CONSTRUCTED, not inferred, out of the two events certain to
arrive (`lib/transformer/activate.ts`):

- r3f's `onPointerDown` on an object ARMS an action. Pointerdown is dispatched
  before any capture exists, and picking demonstrably works because hover already
  lights the cursor.
- The controls' own `pointerup`, bound on `window`, FIRES it when the pointer
  travelled less than `CLICK_SLOP`.

`setPointerCapture` is gone entirely; dragging outside the canvas is handled by
listening on `window`, which needs no capture and retargets nothing.

**Three outcomes, decided by what the press landed on.** The capture-phase
handler on the host arms the FALLBACK, "back out to the whole model", before the
event reaches the scene at all; doing that in the bubble-phase `down` would run
after r3f and wipe the arming that just happened. Then:

| Press landed on | What happens |
|---|---|
| a destination | arms that destination, overwriting the fallback |
| something pickable that is not a destination (the stream, the two ends) | disarms, so it is inert rather than an accidental exit |
| empty space | the fallback survives and the release backs out to the stack |

The fallback does nothing at the overview, or pressing the background while
already at the top would re-frame the shot out from under someone who had just
orbited.

**The buttons-are-up self-heal COMPLETES the gesture, it does not abandon it.** A
move with no button held while a press is open means the release was either lost
or is about to arrive; some input paths emit exactly such a move between
pointerdown and pointerup. Treating it as "give up" throws the selection away.
`finish` is idempotent, so a real pointerup arriving afterwards does nothing
twice.

**Two thresholds, not one, and sharing them was a bug of its own.**
`DRAG_THRESHOLD` (4px) starts the orbit; `CLICK_SLOP` (12px) ends the click. When
one number did both, crossing 4px both rotated the camera and cancelled the
click, so a trackpad press, which drifts well past four pixels, cancelled every
click. Between the two the gesture does both, and that is correct: the small
rotation is thrown away by the re-frame the selection asks for.

**`setFocus` early-returns when the focus is unchanged**, so with a block already
open, pressing one of the plates it had pushed aside did nothing at all. Every
activation calls `requestRefit()` too, so pressing what you are already looking
at re-frames it instead of being inert.

Only the plates and taps carry an explicit destination, because they are the one
part of the model outside every `Scope`. The taps get it too: at the overview
those bright spikes are a large share of the model's screen area and much easier
to hit than the dark plates behind them.

**A gesture that never ends is the other way this fails.** With `activeId` stuck
non-null, `move` keeps orbiting on every mouse move with no button held AND
`down` early-returns forever. `endGesture` is the single exit, called from
pointerup, pointercancel, `contextmenu` and window `blur`, and `move` self-heals
by ending the gesture the moment it sees `buttons === 0`. Only the primary button
starts a drag: a right press used to start one and its release goes to the
context menu rather than the page.

**The cursor is the only thing that says any of this can be clicked**
(`CursorHint` in `scene.tsx`). The host used to carry a permanent inline
`cursor: grab`, so the pointer was a grab hand over everything; a grab hand means
"this moves when you pull it", which is precisely the wrong thing to tell a
reader about geometry that is also an index. Three states: `grabbing` while
dragging, `pointer` over anything a press would navigate to, `grab` otherwise.
Driven off `pointer.hot` in the frame loop rather than through React.

### Testing input, and why it kept lying

Three traps, each of which produced a false pass:

- **Synthetic pointer events cannot drive r3f picking.** It builds its ray from
  `event.offsetX/offsetY`, which is 0 on a hand-built `MouseEvent`, so every
  synthetic click raycasts the top-left corner and hits nothing.
- **Synthetic and emulated input moves the pointer exactly zero pixels** between
  press and release, which is the one case a drag threshold cannot see, and it
  does not reproduce pointer-capture retargeting either.
- **The automation's drag sometimes delivers no events at all.** A "verified"
  drag test once logged literally zero events reaching the page.

So: input-layer state machine with synthetic events, picking with real clicks,
and neither result transfers to the other. `window.__transformerArmed()` and
`window.__transformerPointer` split the path in half after one press: armed says
the press landed on something, dragging/dragged say whether the release honoured
it.

Two consequences elsewhere:

- **`auto-frame` measures a SUBTREE, not what is on screen.** It used to measure
  everything visible, which was only correct because focusing removed the rest.
  `Scope` tags its group with `userData.scopePath` and the fit unions only meshes
  whose scope is the focus or below it. Ancestors are excluded: the `block` scope
  physically contains the whole 50 unit run, so counting it while focused on one
  frames the lot.
- **The KV cache stands beside the model** (`KV_ORIGIN`), not on the origin. It
  is the one thing that is neither weight nor activation, and on the origin it was
  drawn with the residual stream running through the middle of it.

### The cache has a capacity, and both modes end

`CACHE_TOKENS` lives in `layout.ts` because TWO things need it: the grid draws
that many columns and the store stops decode at the same number. A capacity known
to only one of them is a capacity the other silently violates, which is what used
to happen: decode incremented forever, so the caption counted tokens that were
nowhere on screen.

`isClearStep(mode, tokens)` decides both what the one button says and what it
does, so the label cannot promise something the press does not do. Prefill clears
to nothing; **decode clears to the PROMPT**, because decode presupposes a
prefilled prompt and there is no such thing as decoding into an empty cache.

### Opening a block is a motion, and the block grows out of its plate

`view.explode` runs 0 to 1 and everything that moves is driven by it:

- `Stack` rewrites its plate, solid and tap matrices each frame while it moves.
- **The hero's plate scales by `1 - explode`** while **`Block` scales its whole
  interior by `explode`**. Because every station's POSITION is a child of that
  one transform as well as its geometry, scaling it collapses the 53 unit run
  back to the block's own origin at the same time as it shrinks the parts. At 0
  the entire interior is a point inside the plate. One line, and it is what makes
  the parts unfold out of the block rather than appear beside it.

`blockZ(i, focused, open)` therefore takes a FRACTION, not a flag. The interior
stays mounted until the bloom has closed, or asking for the overview deletes the
block one frame before the plates start moving back in.

Three things that will bite:

- **Clamp the frame delta.** `damp` is frame-rate independent, which also means
  one long frame swallows the whole animation. After an idle tab or a fresh
  chunk compile the first delta can be hundreds of milliseconds and the bloom
  finishes in that single frame, which is the exact "the items just spawn"
  failure it exists to fix.
- **`auto-frame` waits for the bloom, and then waits one more frame.** A block
  measured mid-bloom is measured at whatever fraction of itself it had reached,
  and the camera lands that fraction too close, so the camera holds still for
  about 0.4s and only then flies. The extra frame is subtler: `useFrame`
  callbacks run in subscription order and `Block` subscribes AFTER `auto-frame`
  because it is mounted conditionally, one commit later, so on any given frame
  the block's world scale is the one applied on the PREVIOUS frame. Measured
  immediately, every fit came out about 1% short. Do not replace the frame
  counter with a check on any particular component: the next thing to write a
  transform in a `useFrame` will hit this too.
- **Recompute the instanced bounding spheres after writing matrices.**
  `InstancedMesh.raycast` rejects against a cached sphere computed once, lazily,
  so the plates stopped being hoverable the moment they moved. It cost nothing
  while they were hidden under focus and broke immediately once they were not.

Testing note: in a backgrounded tab each forced frame advances the simulation by
almost nothing, so the bloom never completes and every in-block fit looks stuck
at the default pose. That is the harness, not the code. Force the end state with
`view.explode = view.explodeTo = 1` and bump `view.refit`.

### The key says what the shapes mean

`overlay/key.tsx`. The reference this piece answers needs no legend, because its
subject exists: a reader who has never seen an H100 still knows a circuit board
from a heatsink, so its geometry arrives already interpreted. Nothing here has a
physical form, so every shape is a choice and the choices have to be stated or a
reader cannot tell a claim from a decoration.

The line that matters is **"a weight's area is its parameter count"**, and it is
computed from `WIDTH_SCALE` rather than typed, so moving `STREAM_WIDTH` moves the
sentence. Everything under it is a colour convention a reader would eventually
infer. `ACTIVATION` and `STREAM` are the same hex and get ONE row: the residual
stream is an activation, and a legend claiming a distinction the scene does not
draw is worse than no legend.

### Blocks branch off the stream

They do not enclose it. Two earlier attempts ran the stream through the middle
of each block and both failed the same way: invisible everywhere except its own
end cap. Branching is also the truth, since a block reads the stream, computes
aside, and adds back.

### Grids are a shader, cells are not

`grid-material.ts` draws a tensor's cell grid in the fragment shader, so every
tensor is ONE draw call and stays sharp at any zoom. **Three** levels are drawn,
each ten times coarser than the last, and **each fades on its own density**. That
fade is not optional: the line test measures distance in pixels, so once cells go
sub-pixel it returns a strong value everywhere and dense tensors render
*brighter*, which reads as a paler object rather than a denser one.

Two levels was not enough. `down_proj` is 8,960 x 1,536 drawn about 75 by 340
pixels at the overview, so even every tenth row lands at 0.4 of a pixel: both
levels faded and the largest object in frame rendered as a blank rectangle.

**All six faces are drawn, but only two are the matrix.** The ±Z faces get the
real 2D grid; the other four are the matrix seen EDGE ON and get 1D lamination
at the row or column pitch, which is what a stack of sheets looks like from the
side. Two things there will bite:

- Faces are classified by **local position**, not by normal. `abs(normal.z) > 0.5`
  works on a plain box and breaks the moment one is bevelled, because a fillet's
  normal sweeps through the threshold.
- `gridLevel1` is a separate function from `gridLevel` on purpose. The 2D one
  takes `min(d.x, d.y)`, so feeding it a dummy second component makes the min
  zero everywhere and the side faces paint **solid**.

Real per-cell instancing is used in exactly one place, `scores.tsx`, because
there the cells are the subject: the causal mask is the upper triangle NOT BEING
THERE, and only geometry can show an absence.

### Framing is measured, never typed

`glossary` carries only the editorial half of a shot: angle, lens, and what
fraction of the frame to fill. `auto-frame` measures the bounding box of whatever
is in scope and computes the target and distance from it.

This is not tidiness. All 14 poses used to carry a hand-tuned distance, and the
moment tensor heights became real every one was wrong at once and in both
directions: the output projection went from 11% of frame height to 67%, the MLP
from 16% to **141%**. Re-tuning fourteen literals by eye against geometry that is
still moving is how a scene ends up with its geometry bent to suit its cameras.

Three things it is easy to get wrong here, all of which happened:

- **Update world matrices before measuring.** `Box3.setFromObject` reads
  `matrixWorld`, and three computes those at RENDER time, so anything mounted
  this commit measures one focus stale. It cost the overview 5 units of height
  while every number involved looked plausible.
- **All three extents project onto screen height.** `screenHalfExtents` uses the
  box support function along the camera's up vector. Taking height as
  `sy * sin(phi)` alone ignores that a 51-unit run along Z rises across the frame
  as it recedes, which was 17 units of uncounted height and a fit out by 2x.
- **A support function is orthographic.** It measures a shadow, and is exact only
  for a flat subject facing the camera. The stack is 43 units deep at a distance
  around 60, so its near end projects a third larger than its centre; solving the
  angular size at the near face instead adds `halfDepth` to the distance. Without
  that the embedding wall sat off the left edge of a frame the arithmetic called
  82% full.
- **Exclude what spans the scene**: the ground plane and the long stream conduit
  carry `userData.noFit`. Measuring the 41-unit stream backed the block shot off to
  78 units for a block 9 units deep.

### The overview opens nothing

Every block is a plate until you ask for one. With the hero open the model is 20
units tall against 52 long, which projects to 1.11:1 and **cannot** fill a 2.1:1
viewport at any angle or distance; closed it projects at 1.91:1. Overview theta
is 0.85 for the same reason, computed from the frame rather than chosen.

Collapsing every block costs the stream its visible connections, so one instanced
tap per block puts them back in one draw call. Without them the stream reads as a
bar lying alongside the stack rather than something all 28 edit, which is exactly
the misreading the branch geometry exists to prevent.

### Labels at exactly your level

There is no projected-label layer. `Anchor` draws a short name as an in-world
sprite, which faces the camera for free, is occluded by geometry correctly, and
cannot drift from what it names. Everything longer lives in the detail column.

**A label shows only when its scope IS the focus.** `Scope` provides its path
through context and `Anchor` reads it. The rule tightened twice: "am I zoomed in
at all" put fifteen labels on the whole-block shot, and "or one level down" fixed
that but broke "Attention", which has five sub-stations carrying twelve labels
between them. A group view needs no in-world labels: the index lists what is
inside it, the detail panel describes what the cursor is on, the status bar says
where you are.

Sprites are excluded from the fit, so **a label placed outside the geometry's
bounding box is outside the frame**. Labels also get lifted toward the camera by
their own height, because an anchor sits on the edge of what it names and depth
testing ate the buried half ("Q projection" rendered as "ection").

### The writing lives in one file, and it has a voice

`reading.ts`, three or four short paragraphs per subject plus the occasional
bulleted term. Nothing in the scene imports it; only the detail panel does.

The prose is written the way Philip Kiely writes *Inference Engineering*:
definition first, then what the thing costs, then why an inference engineer
cares. Short declaratives, real numbers instead of adjectives, no metaphors. If
you add text here, read a few pages of that book first rather than guessing at
the register.

**There is no short form any more.** `model.ts` used to carry a one or two
sentence `note` per node for the hover card, and the panel showed it above a
"Read more". Both described the same tensor, so the note was always a compressed
restatement of the body's first paragraph, and a reader had to ask twice for an
answer the panel was already holding. `model.ts` is shapes and counts again.

**Every figure is interpolated from `CONFIG` and `DERIVED`**, never typed, for
the same reason the geometry derives its dimensions: a sentence that has to be
re-checked by hand against a config file is a sentence that will one day be
wrong.

The three RMSNorms share one body and differ by an opening line, because that is
all that differs about them: same operation, same 1,536 parameters, different
position in the pass.

### The detail panel is a column, and the floating card is gone

`overlay/detail-panel.tsx` is the only surface that describes anything. It is a
permanent third grid column at 1.75x the index (`INDEX_COL` and `DETAIL_COL` in
`shell.tsx`), so the canvas narrows and `auto-frame` re-fits rather than having
text drawn over the model.

**What it replaced, and why, because the failure is not obvious.** There used to
be a card floating in the bottom right of the viewport with a "Read more" button
on it. Reaching that button meant dragging the cursor across the scene, and the
scene is made of pickable objects: the residual stream conduit runs the length of
the frame, so the card had usually rewritten itself to "Residual stream" before
the cursor arrived and the button then belonged to something else. **No timing
fix helps.** `hover` is not null during that trip, it is a different node, so a
grace window (which is what was tried) cannot see the difference between crossing
an object and arriving at one. A docked surface removes the trip.

Two smaller things came with it: the card no longer covers its own subject, which
it did most visibly over the KV cache grid, and the layout claims the space
instead of leaving it over, which is the argument at the top of `shell.tsx`.

**`store.subject` is not `hover`.** Hover goes null constantly and the subject
never does, so the panel keeps describing the last thing pointed at instead of
blinking empty between objects. The earlier rule, that no annotation should show
while nothing is hovered, was about a card floating over the scene; a reference
column beside it is a different object. `setFocus` writes the subject too, for
the cases with no cursor involved: backing out to the stack, and "Reset view".

The overview is a subject like any other, and `reading.ts` has an entry for it
under `OVERVIEW_ID`. It is the only entry with no node behind it, so the panel
takes its heading from `CONFIG` rather than from a tensor, and it is what the
piece opens on.

**No close button and no expand button.** The column is furniture, like the
index, so there is nothing to dismiss, and the writing is what it is for, so it
shows the writing rather than a summary of the writing. Both controls existed for
about an hour and both were the residue of the card this replaced.

The panel scrolls back to its top whenever the subject changes. With a body this
long, pointing at something new while scrolled down would otherwise drop you into
the middle of a paragraph about it.

### Hovering the index navigates

Pointing at an index row goes there. `DWELL_MS` (90ms) is what stops that being
chaos: reaching the key at the bottom of the panel means dragging the cursor down
the whole list, and without a dwell that flies the camera through all fourteen
shots on the way. A click does not wait.

The detail panel, though, updates with no dwell at all. An index row and the
geometry it names are the same destination, so pointing at either has to answer
the same way, and text changing in a docked column costs nothing to undo.

**That works because an index id IS a `model.ts` node id.** Two nodes were added
to the graph rather than mapped around (`block.attn.qkv`, `block.attn.heads`) and
the output projection's scope was renamed from `block.attn.out` to
`block.attn.o`. Keep it that way: the alternative is a table from index entry to
node, which is a second copy of the tree and drifts.

The overview is the one entry with no node, deliberately. It is not a thing in
the model, it is all of them, and the panel handles it as a case of its own.

### Light, and the palette

The old rig was `ambient 0.85` against a key of `1.5`, putting the darkest face
of every box at 57% of its lit face. That one ratio was the largest single cause
of "everything looks blocky": boxes lit that flatly have no readable form, and 28
identical silhouettes in a row is a grey wall.

**The background is the accent hue at 7% lightness**, not a neutral. That is the
reference's own recipe, measured off it, and it is why the accent never looks
pasted on. The first version had a blue-black backdrop (hue 225) under an orange
accent (hue 19), 154 degrees apart.

Weights sit near the background value and read by **silhouette and rim light**
rather than by being a competing colour, so the rim light in `scene.tsx` is load
bearing: remove it and the palette has to move with it.

**Fog is ranged off the camera's distance**, not in world units. The camera
stands 5 units from a projection and 114 from the whole stack, so any absolute
far plane either erases the overview (105 did) or does nothing close up.

Changing exposure means re-tuning emissives. Six materials are
`toneMapped={false}` and will not follow it.

### No postprocessing, and no drei in this chunk

Both deliberate.

`EffectComposer` would break `__transformerRender`, which calls `gl.render`
directly and is the only way to measure anything in a backgrounded tab. And
**bloom is disallowed by this piece's own rule**: it spreads emissive energy onto
neighbouring geometry, painting values where there are none, and re-creates the
exact density-fade failure `grid-material` exists to prevent.

The transformer chunk imports **zero** drei; only `planet/*` does. The ground
grid is hand-rolled off the same `fwidth` trick `grid-material` already uses.

### Budget

63 draw calls in the worst view, 11,330 triangles. The overview is 22 and 1,160.
Every in-block view is around 56 to 59, because they all draw the whole block and
both halves of the stack; that is the cost of the piece making sense and it is
cheap. Deleting the rail and the tap mesh paid for the contact lip and the two
extra segments each elided MLP weight costs.

### Dev hooks

| Hook | What it does |
|---|---|
| `window.__transformer` | Per-frame readout: pose, focus, layer, hover |
| `window.__transformerDraws` | Draw calls and triangles |
| `window.__transformerPose(patch, snap = true)` | Nudge the camera; `snap` writes `current` too |
| `window.__transformerLayer(n)` | Move the hero block |
| `window.__transformerRender()` | Force one frame synchronously, return its cost |
| `window.__transformerTick(n)` | Advance the R3F loop n frames, running every `useFrame` |
| `window.__transformerFit(fill)` | Frame what is in scope, from its measured bbox |
| `window.__transformerView` | The live `view` singleton |
| `window.__transformerPointer` | The live `pointer` singleton: dragging, dragged, hot |

`__transformerRender` exists because a backgrounded tab never fires
`requestAnimationFrame`, and **awaiting rAF there hangs the renderer for 45
seconds**. Without it, measuring a draw-call budget costs one screenshot per
view. Same trap the planet's testing note warns about.

**`__transformerRender` does NOT run `useFrame`.** It calls `gl.render` directly,
which is what makes it side-effect free, and that became a trap once `auto-frame`
started measuring the scene in a `useFrame`: the camera would never move and
every measurement was of a pose that had not been applied. `__transformerTick`
is the one that advances the loop. The working sequence for checking a view in a
backgrounded tab is:

```
click the index entry
await ~100ms                      // let React commit the new scope tree
__transformerTick(3)              // auto-frame measures, writes view.desired
__transformerPose({}, true)       // snap current to desired; no waiting on the chase
__transformerTick(2)              // let DepthCue pick up the new distance
__transformerRender()             // read the cost
screenshot
```

### The capture

`scripts/capture-transformer.py` records one real forward pass to
`public/things/llm/capture.json`, which the score grid uses for real
attention weights. It is NOT required and has not been run: it needs torch,
transformers and a 3.1 GB model download. A missing capture is an ordinary state
and the grid falls back to a flat triangle. **Never substitute an invented
distribution for a missing one.**

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
