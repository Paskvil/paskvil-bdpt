import { BdptDemoElement } from './embed/bdpt-demo-element'

export { BdptDemoElement }

export const TAG_NAME = 'bdpt-demo'

// guard - the bundle may end up included twice on a page
if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, BdptDemoElement)
}
