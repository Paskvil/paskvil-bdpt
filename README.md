# paskvil-bdpt

bi-directional path tracing demo for educational purposes

## embedding

```html
<script src="bdpt.iife.js"></script>
<bdpt-demo></bdpt-demo>
```

or, as an ES module: `<script type="module" src="bdpt.js"></script>`

### theming

The defaults match [paskvil.com](https://paskvil.com/). Override any of these on the element:

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

Fonts aren't bundled - load them on the page (as `@font-face`), or the fallbacks are used.

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
