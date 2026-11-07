import { RENDER_SIZE } from './demo-controls'

/**
 * the element's markup: the render on the left, a plain `<form>` of controls on the right
 *
 * checkboxes and radios are real inputs (keyboard, screen readers, `FormData`), styled as chips
 */
export const TEMPLATE = `
  <div class="layout">
    <div class="viewport">
      <canvas width="${RENDER_SIZE}" height="${RENDER_SIZE}"></canvas>
    </div>
    <form class="controls">
      ${choices('lights', 'checkbox', 'light', [
        ['top', 'top', true],
        ['left', 'left', true],
        ['right', 'right', true],
      ])}
      ${ballChoices('left ball', 'left-ball')}
      ${ballChoices('right ball', 'right-ball')}
      ${choices('integrator', 'radio', 'integrator', [
        ['bdpt', 'bdpt', true],
        ['path-tracer', 'path tracing', false],
      ])}
      <label class="field">
        <span class="legend">stop at</span>
        <select name="sample-limit">
          <option value="0" selected>no limit</option>
          <option value="256">256 spp</option>
          <option value="1024">1k spp</option>
          <option value="4096">4k spp</option>
          <option value="16384">16k spp</option>
        </select>
      </label>
      <div class="actions">
        <button type="button" name="pause">pause</button>
        <button type="button" name="download">download png</button>
      </div>
    </form>
  </div>
`

function ballChoices(legend: string, name: string): string {
  return choices(legend, 'radio', name, [
    ['diffuse', 'diffuse', true],
    ['mirror', 'mirror', false],
    ['glass', 'glass', false],
  ])
}

/** a group of chips - `[value, label, checked]` per option */
function choices(
  legend: string,
  type: 'checkbox' | 'radio',
  name: string,
  options: [value: string, label: string, checked: boolean][],
): string {
  const chips = options.map(
    ([value, label, checked]) => `
      <label class="chip">
        <input type="${type}" name="${name}" value="${value}"${checked ? ' checked' : ''} />
        <span>${label}</span>
      </label>`,
  )
  return `
    <fieldset>
      <legend class="legend">${legend}</legend>
      <div class="chips">${chips.join('')}</div>
    </fieldset>`
}
