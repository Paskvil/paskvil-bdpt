# paskvil-bdpt

bidirectional path tracing (BDPT) in plain TypeScript, as an embeddable `<bdpt-demo>` element - a modified Cornell box that renders progressively in your browser, with a plain path tracer next to it for comparison

written to be read - readability over speed, no GPU, no frameworks. the long version, with pictures and the demo running live: [paskvil.com/projects/bdpt](https://paskvil.com/projects/bdpt/)

## embedding

```html
<script src="bdpt.iife.js"></script>
<bdpt-demo></bdpt-demo>
```

or, as an ES module: `<script type="module" src="bdpt.js"></script>`

one file, ~35 kB, the render workers are inlined. rendering pauses when the element is off-screen or the tab is hidden

### theming

the defaults match [paskvil.com](https://paskvil.com/). override any of these on the element:

```css
bdpt-demo {
  --bdpt-background: #000a12;
  --bdpt-rule: #16324a; /* borders */
  --bdpt-text: #88aaff;
  --bdpt-text-dim: #6680bf;
  --bdpt-text-strong: #e0e7f5;
  --bdpt-accent: #d6a84a; /* selected controls, focus */
  --bdpt-mono: 'Martian Mono', ui-monospace, monospace;
}
```

fonts aren't bundled - load them on the page (as `@font-face`), or the fallbacks are used

## how it works, in short

- **path tracing** follows light backwards: from the camera, bouncing off surfaces, and at every bounce it shoots a shadow ray at a random point on a light (next event estimation). works great until the light is hard to reach from the camera side - small lights, light focused by glass (caustics)
- **BDPT** traces two paths per pixel sample: one from the camera, one from a light. then it joins every vertex of one to every vertex of the other with a shadow ray. a strategy `(s, t)` = the first `s` light vertices + the first `t` camera vertices
  - `s = 0` - the camera path hit a light by itself
  - `s = 1` - next event estimation, as in the path tracer
  - `t = 1` - light tracing: the light path connected straight to the camera, lands anywhere on the image
  - everything else - the two paths joined somewhere in the middle
- every strategy alone is a complete, unbiased estimator - but each is good at different light. **multiple importance sampling** (MIS) weights them per path, so each path is counted mostly by the strategy most likely to have produced it (Veach's power heuristic by default)
- the demo's "advanced" section lets you look at a single `(s, t)`, weighted (its share of the image) or unweighted (its own full estimate)

### where to look in the code

|                                                                              |                                                                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`src/integrators/path-tracer.ts`](src/integrators/path-tracer.ts)           | the path tracer with next event estimation - the baseline                        |
| [`src/integrators/bdpt/subpaths.ts`](src/integrators/bdpt/subpaths.ts)       | camera and light subpaths, one shared random walk                                |
| [`src/integrators/bdpt/connect.ts`](src/integrators/bdpt/connect.ts)         | one `(s, t)` strategy - joining the two subpaths                                 |
| [`src/integrators/bdpt/mis.ts`](src/integrators/bdpt/mis.ts)                 | MIS weights, from a flat list of per-vertex densities                            |
| [`src/integrators/bdpt/path-vertex.ts`](src/integrators/bdpt/path-vertex.ts) | a path vertex - throughput, pdfs in both directions                              |
| [`src/scene/`](src/scene/)                                                   | shapes, materials (diffuse, mirror, glass), area lights, camera, the Cornell box |
| [`src/render/`](src/render/)                                                 | web workers rendering bands of rows, progressive accumulation                    |
| [`src/film/film.ts`](src/film/film.ts)                                       | per-pixel averages + light-tracing splats                                        |
| [`src/embed/`](src/embed/)                                                   | the `<bdpt-demo>` element and its controls                                       |

### gotchas

the things that cost the most time - or would have, with no tests to catch them:

- **shadow rays: nudge both ends.** offsetting only the ray origin off its surface shifts the whole line sideways, so near the far end it can pass _inside_ the target's own object - BDPT silently lost ~20% of the light on the floating ball. see `Ray.between` in [`src/math/ray.ts`](src/math/ray.ts)
- **MIS must count exactly the strategies you evaluate.** `(s, t) = (1, 1)` is never evaluated (as in PBRT) - leave it in the MIS sum and lights seen directly come out at half brightness
- **light-tracing splats** are normalized by the _total_ number of light paths, not per pixel - they land anywhere
- **`maxDepth`** must mean the same in both integrators, or comparing them proves nothing - NEE at the last bounce adds one more
- **glass is asymmetric**: refraction scales radiance by (η_i/η_t)², importance not. in a scene with a closed glass ball the factors cancel on every path, so no image test catches it - unit-test the BSDF
- **specular-diffuse-specular paths** (a caustic seen in a mirror) can't be built by any BDPT connection - only by hitting the light by chance, same as the path tracer. shows up as "salt" on mirror balls
- **compare at equal samples _and_ equal time.** a BDPT sample costs ~4× the rays of a path tracer sample - per sample it wins everywhere here, per second not always
- **testing an unbiased renderer**: compare two independent integrators within standard errors from independent batches - fixed tolerances break on caustics, where the _reference_ is the noisy one. then sabotage the code (10% darker NEE) and check the test fails
- **debugging a biased BDPT**: render each `(s, t)` alone, unweighted, for one path length - they must all agree with brute force; the odd one out has the bug

### references

- Eric Veach, [_Robust Monte Carlo Methods for Light Transport Simulation_](https://graphics.stanford.edu/papers/veach_thesis/), PhD thesis, 1997 - ch. 9 (MIS) and 10 (BDPT)
- Pharr, Jakob, Humphreys, [_Physically Based Rendering_](https://pbr-book.org/), 3rd ed., ch. 16.3 - the structure this follows
- [path tracing](https://en.wikipedia.org/wiki/Path_tracing) on Wikipedia

## development

```sh
npm install
npm run dev        # demo page at http://localhost:5180/demo/
npm test           # vitest
npm run lint       # eslint
npm run typecheck  # tsc
npm run build      # dist/bdpt.js + dist/bdpt.iife.js
```

see [PLAN.md](PLAN.md) for the design decisions and roadmap
