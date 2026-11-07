# paskvil-bdpt

Educational bidirectional path tracing demo, TS, shipped as one embeddable bundle (`<bdpt-demo>` custom element). Design, decisions and milestones live in `PLAN.md` - keep it up to date as decisions are made.

## principles

- readability over performance - the code is part of the demo; don't optimize at the expense of clarity
- CPU only, Web Workers for parallelism - no WebGL/WebGPU (decided, don't re-suggest)
- not published to npm - the repo is the reference, `dist/` bundle is what gets embedded

## layout / commands

- `src/` library, entry `src/index.ts` (registers the element), `demo/index.html` dev page (served at `http://localhost:5180/demo/` - port pinned, 5173 is taken by Jo's other projects)
- `npm run dev | test | lint | typecheck | build` - run test + lint + typecheck before committing
- tests next to the code as `*.test.ts`; DOM tests opt into jsdom per file (`// @vitest-environment jsdom`), the rest runs in node
- styles: plain `.css` files imported with `?inline`, applied via `adoptedStyleSheets` in the shadow root
- workers: imported with `?worker&inline` so the bundle stays a single file
  - each worker builds its own scene from `RenderSettings` (plain data); jobs are row bands, results are transferred `Float32Array`s
  - random seed per (pass, row) - the image doesn't depend on which worker rendered what; keep it that way
  - `generation` tags every message, stale results are dropped on reset
  - the worker can't use the WebWorker TS lib alongside DOM, hence the local `WorkerScope` interface in `render-worker.ts`

## conventions

- directions follow PBRT: unit, world space, pointing _away_ from the surface (`wo` towards the camera side, `wi` towards the light)
- `Vec3` / `Color` are immutable classes - allocation-heavy on purpose, readability first
- `noUncheckedIndexedAccess` is off on purpose - typed-array code (film, splatting) would drown in `?? 0`

- kebab-case file names, Prettier (no semicolons, single quotes, width 100), ESLint `typescript-eslint` strict
- no non-null assertions (`!`) - lint forbids them, use an explicit check that throws

## notes

- shadow / connection rays must use `Ray.between` (nudges _both_ ends off their surfaces), never `Ray.spawn` + shortened distance - `spawn` shifts the whole line sideways, so near the far end it can pass inside the target's own object (cost BDPT 20% of the NEE light on the floating ball before it was found)
- debugging BDPT bias: every (s, t) strategy is unbiased on its own - render each alone (uniform weights × strategy count) for a fixed path length and compare against brute-force path tracing of exactly that length; one strategy off = the bug is in it
- BDPT vs path tracer test uses a floor-looking camera on purpose: pixels covering a light panel edge are too noisy to compare at test sample counts
  - it compares block means within 4 standard errors, estimated from independent batches - no hand-tuned tolerances (caustics make the _path tracer_ reference the noisy one)
  - sanity-check such tests by sabotage: a 10% darker NEE strategy must fail them
- glass: the radiance-vs-importance scaling (`Transport`) cancels for any path through a closed glass ball, so no test in this scene can detect it being wrong - it's covered by the material unit test only
- BDPT costs ~6x the path tracer per sample (but converges faster where it matters)

- integrators are validated with a "furnace" test (closed box, every wall emits `Le` and reflects `albedo`, expected `Le / (1 - albedo)`) - catches double-counted light between NEE and emitter hits, wrong pdfs, missing cosines; extend it to BDPT

- `npm audit` reports moderate issues in `typescript-eslint` deps - dev-only lint tooling, not in the bundle
