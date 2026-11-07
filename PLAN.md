# PLAN

Educational bidirectional path tracing (BDPT) demo in TypeScript, shipped as an embeddable bundle.

Status: **milestone 1 done** (scaffolding) - next: math + scene + path tracer. Sections marked _open_ still need a decision.

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
- thin wrapper over a JS API (`createRenderer(canvas, options)`) for people who want control
- attributes / events - _open_, after the UI is settled

## testing

- unit: sampling functions integrate to 1, BSDFs are reciprocal + energy conserving, pdfs match sampling
- integration: BDPT vs path tracer on small scenes, mean pixel error below a threshold at fixed seed
- per-strategy images `(s, t)` as a debugging aid (also a nice demo feature)

## milestones

1. ~~scaffolding - Vite/TS/Vitest, empty custom element showing a canvas, build produces the bundle~~ - done
2. math + scene + path tracer - Cornell box renders progressively on the main thread
3. workers - same, parallel, UI stays responsive
4. BDPT - all strategies, MIS, diffuse only; validated against the path tracer
5. specular - mirror + glass, caustics scene
6. interface - controls, strategy visualization, PT vs BDPT comparison

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
    - MIS: power / balance / off
    - strategy view: full image, or the contribution of a single `(s, t)` strategy
    - max path depth
- stats overlay, bottom-right of the render - abbreviations only, full name + short description on hover
  - `SPP` samples per pixel, `RAYS` rays cast, `R/S` rays per second, `TIME` elapsed, BDPT only: `LP` light paths
- render resolution fixed at 512x512, the canvas is CSS-scaled to fit the element (aspect preserved)
- narrow embeds - controls stack under the render (CSS container query)
- rendering pauses when the element is scrolled out of view (`IntersectionObserver`), resumes when back - unless paused manually

- PNG export
  - optional "include stats" checkbox next to the download button, on by default
  - stats go in a strip _below_ the 512x512 image (PNG ~512x544), never over it - frames stay aligned for timelapses
  - strip shows integrator, lights, ball materials, non-default advanced settings + the stats
  - filename carries the sample count, zero-padded so it sorts - e.g. `bdpt-0256spp.png`

## future

- timelapse - auto-snapshot each time SPP doubles (1, 2, 4, ... 4k)
- more sphere materials (glossy / microfacet, ...)

## open questions

- attributes / events of `<bdpt-demo>` - once the controls exist
