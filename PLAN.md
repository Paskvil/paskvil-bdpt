# PLAN

Educational bidirectional path tracing (BDPT) demo in TypeScript, shipped as an embeddable bundle.

Status: **milestone 6 done** (interface) - next: documentation. Sections marked _open_ still need a decision.

## goals

- readable, well-factored code over raw speed - the code itself is part of the demo
- one embeddable artifact: drop a `<script>` + a tag on any page, no framework required
- progressive rendering - the image refines live, so it's interesting to watch
- show _why_ BDPT matters: scenes where plain path tracing struggles (small/occluded lights, caustics)

## non-goals (for now)

- production performance, large meshes, BVH tuning
- scene file formats (OBJ/glTF) - scenes are defined in code
- spectral rendering, participating media, textures

## architecture

Layered, so each layer reads on its own:

```
src/
  math/        Vec3, Ray, ONB, sampling helpers (cosine hemisphere, area sampling, ...)
  rng/         seedable PRNG (deterministic renders for tests)
  scene/       shapes (sphere, quad), materials (BSDFs), lights, camera, intersection
  integrators/ path tracer (baseline) + BDPT (subpaths, connections, MIS)
  film/        accumulation buffer, splatting (light-tracing strategy), tone mapping
  render/      progressive render loop, worker pool, tile scheduling
  embed/       custom element `<bdpt-demo>` + public JS API
demo/          dev page (Vite) - not part of the bundle
```

- `integrators/` depends only on `scene/` + `math/` - no DOM, no workers - so it's unit-testable in Node
- the path tracer exists as a baseline for side-by-side comparison _and_ as a correctness check (both must converge to the same image)

## algorithm

- follow Veach's thesis (ch. 10) and PBRT's BDPT chapter for structure
  - vertex records with `pdfFwd` / `pdfRev`, MIS via the "remap" ratio walk - the clean formulation, no ad-hoc special cases
- strategies `(s, t)`: all of them, including `t = 1` (light tracing, splats to arbitrary pixels) and `s = 0` (camera path hits light)
- MIS: balance or power heuristic, switchable - and a "no MIS" mode, for teaching
- delta BSDFs (mirror, glass) handled explicitly - they're where BDPT gets interesting (caustics) and where most bugs live

## CPU only

Decision: **CPU only, in TS, Web Workers for parallelism.** No WebGL/WebGPU backend - GPU optimization would heavily degrade readability, which is the point of the project.

- WebGL is a poor fit anyway - no compute shaders, no scatter writes (the light-tracing strategy `t = 1` splats to arbitrary pixels)
- WebGPU would work, but means a second copy of the integrator in WGSL with fixed-size arrays and no polymorphism
- CPU in workers is plenty for a Cornell-box-sized scene refining over seconds, and it's one codebase, debuggable in DevTools, testable in Vitest

## tooling

- TypeScript (strict), Vite (dev server + library build), Vitest (tests), ESLint + Prettier
- npm
- workers inlined into the bundle (`?worker&inline`) so the output is a single JS file
- build outputs
  - `dist/bdpt.js` - ES module
  - `dist/bdpt.iife.js` - classic `<script>` for plain HTML pages
- not published as a package - the public repo is the reference, the built bundle is what gets embedded elsewhere
- demo page on GitHub Pages _(open, nice-to-have)_

## embedding (sketch - to be designed)

```html
<script type="module" src="https://…/bdpt.js"></script>
<bdpt-demo></bdpt-demo>
```

- custom element with Shadow DOM - style isolation from the host page
- look: paskvil.com's palette and fonts by default (Prussian blue, gold accent, Martian Mono, lowercase), every colour / font overridable by `--bdpt-*` custom properties on the element
- fonts aren't bundled - the host page's `@font-face`s work inside the shadow DOM, otherwise system fallbacks
- thin wrapper over a JS API (`createRenderer(canvas, options)`) for people who want control
- attributes / events - _open_, after the UI is settled

## testing

- unit: sampling functions integrate to 1, BSDFs are reciprocal + energy conserving, pdfs match sampling
- integration: BDPT vs path tracer on small scenes, mean pixel error below a threshold at fixed seed
- per-strategy images `(s, t)` as a debugging aid (also a nice demo feature)

## milestones

1. ~~scaffolding - Vite/TS/Vitest, empty custom element showing a canvas, build produces the bundle~~ - done
2. ~~math + scene + path tracer - Cornell box renders progressively on the main thread~~ - done (diffuse only)
3. ~~workers - same, parallel, UI stays responsive~~ - done
4. ~~BDPT - all strategies, MIS, diffuse only; validated against the path tracer~~ - done
5. ~~specular - mirror + glass, caustics scene~~ - done
6. ~~interface - controls, strategy visualization, PT vs BDPT comparison~~ - done
   - ~~basic controls (lights, materials, integrator, sample limit, pause, png download, off-screen / hidden-tab pausing)~~ - done
   - ~~stats overlay + stats strip in the png~~ - done
   - ~~advanced section~~ - done: max depth 1-20, MIS power / balance / uniform, a single `(s, t)` weighted or unweighted
7. documentation - outline of the algorithms, references into the code, gotchas (see below)
   - short version in `README.md`
   - long version as an article on paskvil.com (eleventy), next to the embedded renderer

## gotchas (collected for the docs)

Things that are easy to get wrong when implementing this - noted as they come up:

- shadow / connection rays: nudge _both_ ends off their surfaces and aim between the nudged points (`Ray.between`) - nudging only the origin shifts the whole line sideways, so near the far end it can pass inside the target's own object (BDPT silently lost ~20% of NEE light on the floating ball)
- MIS must count exactly the strategies the integrator evaluates - PBRT never evaluates `(s, t) = (1, 1)`, so MIS mustn't include it either (lights seen directly came out at half brightness)
- the light-tracing (`t = 1`) splats are normalized by the _total_ number of light paths, not per pixel - they land anywhere on the film
- the pinhole camera's importance / pdf are normalized over the whole film (1 / (A cos⁴θ), 1 / (A cos³θ)), so a camera ray's throughput is exactly 1
- `maxDepth` must mean the same thing in both integrators (max bounces) - NEE at the last hit adds one more bounce, easy to miss when comparing them
- radiance vs importance: refraction scales radiance by (η_i/η_t)², importance not - but for a closed glass object the factors cancel on every path, so no image test can catch it being wrong (unit-test the BSDF)
- testing an unbiased renderer: compare against an independent integrator, within standard errors estimated from independent batches - hand-tuned tolerances break on caustics (where the _reference_ is the noisy one); sanity-check the test by sabotage (a 10% darker strategy must fail it)
- BDPT can't connect through specular-diffuse-specular (SDS) paths - e.g. a caustic seen in a mirror (camera → mirror → diffuse → mirror → light): every connection needs non-delta vertices at both ends, so only `s = 0` (hitting the light by chance) is left - exactly what the path tracer does. Shows up as "salt" on mirror balls; per sample BDPT is still ~4× less noisy there, but each sample costs ~4× the rays (26 vs 6 per sample in the demo), so at _equal time_ the path tracer can look smoother on such paths. Equal samples vs equal time matters for any comparison. (The proper fix - photon mapping / vertex merging - is out of scope)
- debugging BDPT bias: each `(s, t)` strategy alone is an unbiased estimator - render them one by one for a fixed path length and compare against brute force of exactly that length; the odd one out holds the bug

## scene

Modified Cornell box - single fixed scene, parameterized by the controls below.

- walls: classic red (left) / white (back, floor, ceiling) / green (right)
- two spheres instead of the usual boxes
  - left ball - further back, resting on the floor; default diffuse _light blue_
  - right ball - closer to the camera, floating mid-air; default diffuse _light peach_
- lights: three groups - top, left, right - each can be toggled, at least one group always on (the last one on can't be switched off)
  - all area lights (quads), no point lights
  - top - the usual ceiling panel
  - left - 2 smaller panels on the left wall, on its vertical centre line, at 25% and 75% of the wall height
  - right - 2 smaller panels on the right wall, on its horizontal centre line, at 25% and 75% of the wall depth
  - the panel pairs are spaced to produce clearly separate multiple shadows
- sphere materials, chosen per sphere
  - diffuse - the ball's own colour
  - mirror (perfect specular)
  - glass (dielectric, refraction + Fresnel)
  - material set is meant to grow later - materials behind one `Material` interface, so adding one is a new file + a dropdown entry
- camera: classic Cornell framing, square aspect - fixed
- switched-off lights are removed from the scene, the wall shows through - it's a "scene switch" more than a "light switch"

### geometry

Unit box, right-handed, _y up_:

- `x` left → right - red wall at `x = 0`, green wall at `x = 1`
- `y` floor → ceiling - floor at `y = 0`, ceiling at `y = 1`
- `z` back → front - back wall at `z = 0`, front is open at `z = 1`, the camera looks down `-z`

| object       | where                                                       | size                                                                    |
| ------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| left ball    | centre `(0.30, 1/6, 0.35)` - resting on the floor           | radius `1/6` (diameter 1/3 of the box)                                  |
| right ball   | centre `(0.68, 0.45, 0.65)` - bottom ~0.28 above the floor  | radius `1/6`                                                            |
| top light    | ceiling, centred at `(0.5, 1, 0.5)`                         | `0.25 × 0.25`                                                           |
| left lights  | left wall, `z = 0.5`, centres at `y = 0.25` and `y = 0.75`  | `0.125 × 0.125` each - half the top light's side, a quarter of its area |
| right lights | right wall, `y = 0.5`, centres at `z = 0.25` and `z = 0.75` | `0.125 × 0.125` each - half the top light's side, a quarter of its area |
| camera       | `(0.5, 0.5, 2.4)` looking at `-z`                           | vertical FOV 40° - the open front just fills the frame                  |

```
top view (looking down)                 front view (from the camera)

        x=0       back      x=1                 y=1 +----[ top ]----+
  z=0    +-------------------+                      |               |
         |                   |               0.75   L2              |
  0.25   |                   R1                     |               |
         |   (L)             |               0.50   |          (R)  R1 R2
  0.50  L1 L2   [top]        |                      |               |
         |            (R)    |               0.25   L1              |
  0.75   |                   R2                     |  (L)          |
         |                   |                  y=0 +---------------+
  z=1    +----- open --------+                     x=0             x=1
                 camera @ z=2.4
```

- light panels sit `1e-3` off their wall - avoids the panel and the wall being coplanar
- emission: neutral white, the _same radiance_ on every panel - smaller panels give off less light, which feels more natural
  - so each side group (2 panels × 1/4 area) has half the power of the top light
- reflectances (linear RGB)
  - white `0.73`, red `(0.65, 0.05, 0.05)`, green `(0.12, 0.45, 0.15)` - the classic Cornell values
  - light blue `(0.45, 0.60, 0.85)`, light peach `(0.90, 0.62, 0.48)`
  - mirror reflectance `0.95`, glass IOR `1.5`

## UI

```
+----------------------------+-----------------+
|                            | lights          |
|                            |  [x] top        |
|        render (LHS)        |  [x] left       |
|                            |  [ ] right      |
|                            | left ball  [▾]  |
|                            | right ball [▾]  |
|                  stats --> | integrator [▾]  |
+----------------------------+ [download png]  |
                             +-----------------+
```

- LHS: the progressive render, restarts from zero on any parameter change
- RHS: controls
  - light toggles (top / left / right)
  - material per ball (diffuse / mirror / glass)
  - integrator: path tracing (with next event estimation) / BDPT
    - no plain PT - it would not converge before the user gets bored
  - pause / play - freeze the current state for inspection
  - SPP cap - switch (+ value) to stop rendering at N samples per pixel
  - download current snapshot as PNG
  - collapsible "advanced" section
    - MIS: power / balance / off - "off" = every usable strategy weighted equally (`uniform` heuristic), still unbiased, just noisier
    - strategy view: full image, or the contribution of a single `(s, t)` strategy
    - max path depth
- stats overlay, bottom-right of the render - abbreviations only, full name + short description on hover
  - `SPP` samples per pixel, `RAYS` rays cast, `R/S` rays per second, `TIME` elapsed, BDPT only: `LP` light paths
- render resolution fixed at 512x512, the canvas is CSS-scaled to fit the element (aspect preserved)
- narrow embeds - controls stack under the render (CSS container query)
- rendering pauses when the element is scrolled out of view (`IntersectionObserver`) or the tab is hidden (`visibilitychange` - workers keep running otherwise), resumes when back - unless paused manually

- PNG export
  - optional "include stats" checkbox next to the download button, on by default
  - stats go in a strip _below_ the 512x512 image (PNG ~512x544), never over it - frames stay aligned for timelapses
  - strip shows integrator, lights, ball materials, non-default advanced settings + the stats
  - filename carries the sample count, zero-padded so it sorts - e.g. `bdpt-0256spp.png`

## future

- timelapse - auto-snapshot each time SPP doubles (1, 2, 4, ... 4k)
- more sphere materials (glossy / microfacet, ...)
- Metropolis light transport, as primary sample space MLT (Kelemen et al. 2002) - fits without entangling the code: the integrators only consume a `Random`, so PSSMLT can wrap BDPT from outside, feeding it a mutable vector of "random" numbers and mutating that (+ its own normalization pass); a separate module, BDPT untouched

## open questions

- attributes / events of `<bdpt-demo>` - once the controls exist
