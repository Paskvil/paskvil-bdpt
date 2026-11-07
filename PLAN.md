# PLAN

Educational bidirectional path tracing (BDPT) demo in TypeScript, shipped as an embeddable bundle.

Status: **design discussion** - setup agreed, scene + interface next. Sections marked *open* still need a decision.

## goals

- readable, well-factored code over raw speed - the code itself is part of the demo
- one embeddable artifact: drop a `<script>` + a tag on any page, no framework required
- progressive rendering - the image refines live, so it's interesting to watch
- show *why* BDPT matters: scenes where plain path tracing struggles (small/occluded lights, caustics)

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
- the path tracer exists as a baseline for side-by-side comparison *and* as a correctness check (both must converge to the same image)

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
- demo page on GitHub Pages *(open, nice-to-have)*

## embedding (sketch - to be designed)

```html
<script type="module" src="https://…/bdpt.js"></script>
<bdpt-demo scene="cornell-caustics" width="512" height="512"></bdpt-demo>
```

- custom element with Shadow DOM - style isolation from the host page
- thin wrapper over a JS API (`createRenderer(canvas, options)`) for people who want control
- details (controls, attributes, events) - next discussion

## testing

- unit: sampling functions integrate to 1, BSDFs are reciprocal + energy conserving, pdfs match sampling
- integration: BDPT vs path tracer on small scenes, mean pixel error below a threshold at fixed seed
- per-strategy images `(s, t)` as a debugging aid (also a nice demo feature)

## milestones

1. scaffolding - Vite/TS/Vitest, empty custom element showing a canvas, build produces the bundle
2. math + scene + path tracer - Cornell box renders progressively on the main thread
3. workers - same, parallel, UI stays responsive
4. BDPT - all strategies, MIS, diffuse only; validated against the path tracer
5. specular - mirror + glass, caustics scene
6. interface - controls, strategy visualization, PT vs BDPT comparison

## scene

A "modified Cornell box" - layout and materials to be described by Jo *(pending)*

## open questions

- scene layout + material set - pending (see above)
- interface - after the scene
