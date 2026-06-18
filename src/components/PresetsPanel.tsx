/**
 * Side panel listing the named preset configurations. Click to apply.
 */

import { PRESETS } from '../sim/presets'
import { useAppStore, DEFAULT_PARAMS, type SimParams } from '../state/store'

export function PresetsPanel() {
  const setParam = useAppStore((s) => s.setParam)

  function applyPreset(preset: (typeof PRESETS)[number]): void {
    const merged: SimParams = { ...DEFAULT_PARAMS, ...preset.params }
    for (const [k, v] of Object.entries(merged)) {
      setParam(k as keyof SimParams, v as never)
    }
  }

  return (
    <div className="presets">
      <h3>Presets</h3>
      <ul>
        {PRESETS.map((p) => (
          <li key={p.id}>
            <button onClick={() => applyPreset(p)} className="preset-button">
              {p.name}
            </button>
            <p className="preset-desc">{p.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}