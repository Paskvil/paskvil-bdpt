# paskvil-bdpt

bi-directional path tracing demo for educational purposes

## embedding

```html
<script src="bdpt.iife.js"></script>
<bdpt-demo></bdpt-demo>
```

or, as an ES module: `<script type="module" src="bdpt.js"></script>`

## development

```sh
npm install
npm run dev        # demo page at http://localhost:5180/demo/
npm test           # vitest
npm run lint       # eslint
npm run typecheck  # tsc
npm run build      # dist/bdpt.js + dist/bdpt.iife.js
```

See [PLAN.md](PLAN.md) for the design and roadmap.
