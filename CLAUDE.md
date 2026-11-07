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
  - look = paskvil.com (Jo's site): Prussian blue, gold accent, Martian Mono, all lowercase, 1px rules, square corners, no shadows; theming via `--bdpt-*` custom properties (listed in README)
- UI: the controls are a plain `<form>` of real inputs (chips = styled radios / checkboxes), read in one go by `readControls` (`FormData`) - keep it that way, no framework
  - only changes to the `RenderSettings` part restart the render (compared as JSON); the sample limit / pause don't
  - rendering runs only when not paused, on screen (`IntersectionObserver`) and the tab is visible
  - options that don't apply are _hidden_ with CSS `:has()`, never `disabled` - disabled inputs drop out of `FormData`
  - MIS "off" is labelled `uniform` on purpose: equal weights for the usable strategies (an unweighted sum would count every path several times)
- `demo/index.html` mimics a paskvil.com page (fonts from Google Fonts there - dev page only)
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

- the long write-up lives in the site repo `/home/josef/Projects/mine/paskvil-static` (Eleventy, another Claude session "paskvil-static" owns it): this repo writes only `src/projects/bdpt.md`, `src/assets/js/bdpt.js` (= `dist/bdpt.iife.js`, recopy on every rebuild) and `src/assets/img/bdpt/`; never commit there - ping that session instead
  - images: `npm run docs:images -- --out ../paskvil-static/src/assets/img/bdpt [filters]` (list in `scripts/docs-images/images.ts`, runs via `tsx` + worker threads); after re-rendering, ping the site session
  - `scripts/` has its own `tsconfig.json` (adds Node types) so Node types don't leak into the browser code
  - site voice: lowercase, no closing full stops, `-` for asides, `<details>` + blank lines around fences for collapsible code, `<figure>` (or `figure.pair`) with width/height, no KaTeX

- new implementation gotchas go into PLAN.md "gotchas (collected for the docs)" as they come up - they feed the README / site article

- shadow / connection rays must use `Ray.between` (nudges _both_ ends off their surfaces), never `Ray.spawn` + shortened distance - `spawn` shifts the whole line sideways, so near the far end it can pass inside the target's own object (cost BDPT 20% of the NEE light on the floating ball before it was found)
- debugging BDPT bias: every (s, t) strategy is unbiased on its own - render each alone (uniform weights × strategy count) for a fixed path length and compare against brute-force path tracing of exactly that length; one strategy off = the bug is in it
- BDPT vs path tracer test uses a floor-looking camera on purpose: pixels covering a light panel edge are too noisy to compare at test sample counts
  - it compares block means within 4 standard errors, estimated from independent batches - no hand-tuned tolerances (caustics make the _path tracer_ reference the noisy one)
  - sanity-check such tests by sabotage: a 10% darker NEE strategy must fail them
  - shared in `src/integrators/test-images.ts` (`expectSameImage`): 6 batches, 6 standard errors - with so few batches the ratio is t-distributed (heavy tails), 4 standard errors failed by chance once PSSMLT's randomness changed
- glass: the radiance-vs-importance scaling (`Transport`) cancels for any path through a closed glass ball, so no test in this scene can detect it being wrong - it's covered by the material unit test only
- BDPT costs ~6x the path tracer per sample (but converges faster where it matters)

- integrators are validated with a "furnace" test (closed box, every wall emits `Le` and reflects `albedo`, expected `Le / (1 - albedo)`) - catches double-counted light between NEE and emitter hits, wrong pdfs, missing cosines; extend it to BDPT

- PSSMLT (`src/integrators/pssmlt/`) wraps BDPT from outside - keep BDPT unaware of it. its jobs are chain steps, not bands (`render/work-plans.ts`); chain `k` lives in worker `k mod workers`, so the PSSMLT image depends on the worker count - fine, but don't assume PSSMLT renders are reproducible across machines
- `npm audit` reports moderate issues in `typescript-eslint` deps - dev-only lint tooling, not in the bundle
