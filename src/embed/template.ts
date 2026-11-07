import { INTEGRATOR_NAMES, RENDER_SIZE } from './demo-controls'

const SHADE_DESCRIPTION =
  'a white plate just under the top light - its light gets out only by bouncing through a thin slit'

/**
 * the element's markup: the render on the left, a plain `<form>` of controls on the right
 *
 * checkboxes and radios are real inputs (keyboard, screen readers, `FormData`), styled as chips
 */
export const TEMPLATE = `
  <div class="layout">
    <div class="viewport">
      <canvas width="${RENDER_SIZE}" height="${RENDER_SIZE}"></canvas>
      <dl class="stats"></dl>
    </div>
    <form class="controls">
      ${group('lights', [
        chip('checkbox', 'light', 'top', 'top', true),
        chip('checkbox', 'light', 'left', 'left', true),
        chip('checkbox', 'light', 'right', 'right', true),
        chip('checkbox', 'top-shade', 'on', 'shade', false, SHADE_DESCRIPTION),
      ])}
      ${ballChoices('left ball', 'left-ball')}
      ${ballChoices('right ball', 'right-ball')}
      ${choices(
        'integrator',
        'radio',
        'integrator',
        Object.entries(INTEGRATOR_NAMES).map(([value, name]) => [
          value,
          name.short,
          value === 'bdpt',
          name.full,
        ]),
      )}
      <label class="field">
        <span class="legend">stop at</span>
        <select name="sample-limit">
          <option value="0" selected>no limit</option>
          <option value="16">16 spp</option>
          <option value="64">64 spp</option>
          <option value="256">256 spp</option>
          <option value="1024">1k spp</option>
          <option value="4096">4k spp</option>
          <option value="16384">16k spp</option>
        </select>
      </label>
      ${advancedSection()}
      <div class="actions">
        <button type="button" name="pause">pause</button>
        <button type="button" name="download">download png</button>
        <label class="chip">
          <input type="checkbox" name="png-with-stats" checked />
          <span>with stats</span>
        </label>
      </div>
    </form>
  </div>
`

/** collapsed by default - max depth for both integrators, the rest for BDPT only */
function advancedSection(): string {
  return `
  <details class="advanced">
    <summary>advanced</summary>
    <label class="field">
      <span class="legend">max depth <output name="max-depth-value">10</output></span>
      <input type="range" name="max-depth" min="1" max="20" value="10" />
    </label>
    <div class="bdpt-only">
      ${choices('mis weights', 'radio', 'heuristic', [
        [
          'power',
          'power',
          true,
          'weights ∝ pdf² - favours the best strategy for each path (Veach)',
        ],
        ['balance', 'balance', false, 'weights ∝ pdf - the provably-good baseline'],
        [
          'uniform',
          'uniform',
          false,
          'every usable strategy weighted equally - the closest to "MIS off" that stays correct',
        ],
      ])}
      ${choices('show', 'radio', 'strategy-view', [
        ['all', 'all', true],
        ['one', 'one (s, t)', false],
      ])}
      <div class="strategy">
        <label class="number" title="light subpath vertices">
          s <input type="number" name="s" min="0" max="21" value="1" />
        </label>
        <label class="number" title="camera subpath vertices">
          t <input type="number" name="t" min="1" max="22" value="2" />
        </label>
        ${choices('', 'radio', 'weighting', [
          [
            'weighted',
            'weighted',
            true,
            'its MIS share - all strategies summed give the full image',
          ],
          ['unweighted', 'unweighted', false, 'its own full estimate of paths with s + t vertices'],
        ])}
      </div>
    </div>
  </details>`
}

function ballChoices(legend: string, name: string): string {
  return choices(legend, 'radio', name, [
    ['diffuse', 'diffuse', true],
    ['mirror', 'mirror', false],
    ['glass', 'glass', false],
  ])
}

/** a group of chips of one field - `[value, label, checked, hover description?]` per option */
function choices(
  legend: string,
  type: 'checkbox' | 'radio',
  name: string,
  options: [value: string, label: string, checked: boolean, title?: string][],
): string {
  const chips = options.map(([value, label, checked, title]) =>
    chip(type, name, value, label, checked, title),
  )
  return group(legend, chips)
}

function group(legend: string, chips: string[]): string {
  return `
    <fieldset>
      ${legend ? `<legend class="legend">${legend}</legend>` : ''}
      <div class="chips">${chips.join('')}</div>
    </fieldset>`
}

/** a checkbox or radio styled as a chip */
function chip(
  type: 'checkbox' | 'radio',
  name: string,
  value: string,
  label: string,
  checked: boolean,
  title?: string,
): string {
  return `
    <label class="chip"${title ? ` title="${title}"` : ''}>
      <input type="${type}" name="${name}" value="${value}"${checked ? ' checked' : ''} />
      <span>${label}</span>
    </label>`
}
