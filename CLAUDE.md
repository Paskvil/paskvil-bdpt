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
- workers (later): import with `?worker&inline` so the bundle stays a single file

## conventions

- kebab-case file names, Prettier (no semicolons, single quotes, width 100), ESLint `typescript-eslint` strict
- no non-null assertions (`!`) - lint forbids them, use an explicit check that throws

## notes

- `npm audit` reports moderate issues in `typescript-eslint` deps - dev-only lint tooling, not in the bundle
