/**
 * leva-driven Parameters panel.
 *
 * Exposes per-compartment HH params (g_Na, g_K), axial conductances
 * (g_st, g_at, g_sb), and synapse kinetics (AMPA τ, NMDA τ1/τ2, A1,
 * [Mg²⁺]). Changes are written to the store; the next Re-run uses them.
 *
 * The panel is *editable* but not *exclusive* — the headline demo
 * (coincidence preset) works on the defaults. This is for poking the
 * model, not for the primary story.
 */

import { useEffect } from 'react'
import { useControls, folder, button, Leva } from 'leva'
import {
  SOMA_PARAMS,
  APICAL_TRUNK_PARAMS,
  APICAL_TUFT_PARAMS,
  BASAL_PARAMS,
  type HHParams,
} from '../sim/hh'
import { DEFAULT_AXIAL } from '../sim/cable'
import { DEFAULT_KINETICS } from '../sim/synapse'
import { useAppStore } from '../state/store'

type HHCompartmentKey = 'soma' | 'apicalTrunk' | 'apicalTuft' | 'basal'

const COMPARTMENT_LABELS: Record<HHCompartmentKey, string> = {
  soma: 'Soma',
  apicalTrunk: 'Apical trunk',
  apicalTuft: 'Apical tuft',
  basal: 'Basal',
}

const COMPARTMENT_DEFAULTS: Record<HHCompartmentKey, HHParams> = {
  soma: SOMA_PARAMS,
  apicalTrunk: APICAL_TRUNK_PARAMS,
  apicalTuft: APICAL_TUFT_PARAMS,
  basal: BASAL_PARAMS,
}

/**
 * Read a leva value via path lookup; values is a function-return tuple.
 * We type the lookup loosely because leva's FunctionReturnType is
 * strictly-typed and the index signature doesn't survive.
 */
function readLevaPath(
  values: unknown,
  path: readonly (string | number)[]
): unknown {
  let cur: unknown = values
  for (const p of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[p]
  }
  return cur
}

export function ParametersPanel() {
  const overrides = useAppStore((s) => s.overrides)
  const setOverrideHH = useAppStore((s) => s.setOverrideHH)
  const setOverrideAxial = useAppStore((s) => s.setOverrideAxial)
  const setOverrideKinetics = useAppStore((s) => s.setOverrideKinetics)
  const resetOverrides = useAppStore((s) => s.resetOverrides)

  // leva's useControls with a schema. The first tuple slot is the values
  // object; we cast to a loose shape for the diff.
  const [levaValues] = useControls(
    () => ({
      'HH channels': folder(
        {
          soma: folder(
            {
              'soma g_Na': {
                value: SOMA_PARAMS.g_Na,
                min: 0,
                max: 80,
                step: 0.5,
                label: 'g_Na (mS/cm²)',
              },
              'soma g_K': {
                value: SOMA_PARAMS.g_K,
                min: 0,
                max: 40,
                step: 0.5,
                label: 'g_K (mS/cm²)',
              },
              'soma reset': button(() =>
                useAppStore.getState().setOverrideHH('soma', null)
              ),
            },
            { collapsed: false }
          ),
          apicalTrunk: folder(
            {
              'apicalTrunk g_Na': {
                value: APICAL_TRUNK_PARAMS.g_Na,
                min: 0,
                max: 80,
                step: 0.5,
                label: 'g_Na (mS/cm²)',
              },
              'apicalTrunk g_K': {
                value: APICAL_TRUNK_PARAMS.g_K,
                min: 0,
                max: 40,
                step: 0.5,
                label: 'g_K (mS/cm²)',
              },
              'apicalTrunk reset': button(() =>
                useAppStore.getState().setOverrideHH('apicalTrunk', null)
              ),
            },
            { collapsed: true }
          ),
          apicalTuft: folder(
            {
              'apicalTuft g_Na': {
                value: APICAL_TUFT_PARAMS.g_Na,
                min: 0,
                max: 80,
                step: 0.5,
                label: 'g_Na (mS/cm²)',
              },
              'apicalTuft g_K': {
                value: APICAL_TUFT_PARAMS.g_K,
                min: 0,
                max: 40,
                step: 0.5,
                label: 'g_K (mS/cm²)',
              },
              'apicalTuft reset': button(() =>
                useAppStore.getState().setOverrideHH('apicalTuft', null)
              ),
            },
            { collapsed: true }
          ),
          basal: folder(
            {
              'basal g_Na': {
                value: BASAL_PARAMS.g_Na,
                min: 0,
                max: 80,
                step: 0.5,
                label: 'g_Na (mS/cm²)',
              },
              'basal g_K': {
                value: BASAL_PARAMS.g_K,
                min: 0,
                max: 40,
                step: 0.5,
                label: 'g_K (mS/cm²)',
              },
              'basal reset': button(() =>
                useAppStore.getState().setOverrideHH('basal', null)
              ),
            },
            { collapsed: true }
          ),
        },
        { collapsed: false }
      ),
      'Axial coupling': folder(
        {
          g_st: {
            value: overrides.axial.g_st,
            min: 0,
            max: 1.0,
            step: 0.01,
            label: 'soma ↔ trunk',
          },
          g_at: {
            value: overrides.axial.g_at,
            min: 0,
            max: 1.0,
            step: 0.01,
            label: 'trunk ↔ tuft',
          },
          g_sb: {
            value: overrides.axial.g_sb,
            min: 0,
            max: 1.0,
            step: 0.01,
            label: 'soma ↔ basal',
          },
        },
        { collapsed: false }
      ),
      'Synapse kinetics': folder(
        {
          tauAMPA: {
            value: overrides.kinetics.tauAMPA,
            min: 0.5,
            max: 20,
            step: 0.1,
            label: 'AMPA τ (ms)',
          },
          tauNMDA1: {
            value: overrides.kinetics.tauNMDA1,
            min: 5,
            max: 200,
            step: 1,
            label: 'NMDA τ₁ (ms)',
          },
          tauNMDA2: {
            value: overrides.kinetics.tauNMDA2,
            min: 50,
            max: 800,
            step: 5,
            label: 'NMDA τ₂ (ms)',
          },
          nmdaA1: {
            value: overrides.kinetics.nmdaA1,
            min: 0,
            max: 1,
            step: 0.01,
            label: 'NMDA A₁ frac',
          },
          mgMM: {
            value: overrides.kinetics.mgMM,
            min: 0,
            max: 5,
            step: 0.05,
            label: '[Mg²⁺] (mM)',
          },
        },
        { collapsed: false }
      ),
      'Reset all to defaults': button(() => {
        resetOverrides()
      }),
    }),
    []
  )

  // Push leva value changes back into the store. Only write when the value
  // actually differs from the store's current override so we don't ping-pong
  // on every render.
  useEffect(() => {
    for (const key of Object.keys(COMPARTMENT_LABELS) as HHCompartmentKey[]) {
      const gNa = readLevaPath(levaValues, [
        'HH channels',
        key,
        `${key} g_Na`,
      ]) as number | undefined
      const gK = readLevaPath(levaValues, [
        'HH channels',
        key,
        `${key} g_K`,
      ]) as number | undefined
      if (gNa == null || gK == null) continue
      const def = COMPARTMENT_DEFAULTS[key]
      const current = overrides.hh[key]
      const isDefault =
        Math.abs(gNa - def.g_Na) < 1e-6 && Math.abs(gK - def.g_K) < 1e-6
      if (current === null && isDefault) continue
      if (
        current !== null &&
        Math.abs(current.g_Na - gNa) < 1e-6 &&
        Math.abs(current.g_K - gK) < 1e-6
      ) {
        continue
      }
      setOverrideHH(
        key,
        isDefault
          ? null
          : {
              ...def,
              g_Na: gNa,
              g_K: gK,
            }
      )
    }
  }, [levaValues, overrides.hh, setOverrideHH])

  useEffect(() => {
    const g_st = readLevaPath(levaValues, ['Axial coupling', 'g_st']) as
      | number
      | undefined
    const g_at = readLevaPath(levaValues, ['Axial coupling', 'g_at']) as
      | number
      | undefined
    const g_sb = readLevaPath(levaValues, ['Axial coupling', 'g_sb']) as
      | number
      | undefined
    if (g_st != null && Math.abs(g_st - overrides.axial.g_st) > 1e-6) {
      setOverrideAxial('g_st', g_st)
    }
    if (g_at != null && Math.abs(g_at - overrides.axial.g_at) > 1e-6) {
      setOverrideAxial('g_at', g_at)
    }
    if (g_sb != null && Math.abs(g_sb - overrides.axial.g_sb) > 1e-6) {
      setOverrideAxial('g_sb', g_sb)
    }
  }, [levaValues, overrides.axial, setOverrideAxial])

  useEffect(() => {
    const fields = [
      'tauAMPA',
      'tauNMDA1',
      'tauNMDA2',
      'nmdaA1',
      'mgMM',
    ] as const
    for (const f of fields) {
      const v = readLevaPath(levaValues, ['Synapse kinetics', f]) as
        | number
        | undefined
      if (v == null) continue
      if (Math.abs(v - overrides.kinetics[f]) > 1e-6) {
        setOverrideKinetics(f, v)
      }
    }
  }, [levaValues, overrides.kinetics, setOverrideKinetics])

  return (
    <>
      <Leva
        fill
        flat
        oneLineLabels={false}
        titleBar={{ title: 'Parameters', drag: false, filter: false }}
        theme={{
          colors: {
            elevation1: '#1a0a2f',
            elevation2: '#261343',
            elevation3: '#321a55',
            accent1: '#ffaa44',
            accent2: '#ffdd88',
            accent3: '#ffffff',
            highlight1: '#aaaadd',
            highlight2: '#ccccff',
            highlight3: '#ffffff',
            vivid1: '#ffaa44',
          },
          space: { rowGap: '6px' },
          fontSizes: { root: '11px' },
        }}
      />
      <p className="caption">
        Edit values, then press <em>Re-run</em> on the playback panel. The
        defaults reproduce Polsky/Mel/Schiller 2004 Figure 2 (supralinearity
        ratio &gt; 1 at small |ΔT|).
      </p>
      <p className="caption">
        Defaults: g_Na/trunk={APICAL_TRUNK_PARAMS.g_Na}, g_K/trunk={APICAL_TRUNK_PARAMS.g_K},
        g_st={DEFAULT_AXIAL.g_st}, AMPA τ={DEFAULT_KINETICS.tauAMPA} ms,
        NMDA τ₁/τ₂ = {DEFAULT_KINETICS.tauNMDA1}/100 ms (default tuned for biological coincidence window),
        [Mg²⁺]={DEFAULT_KINETICS.mgMM} mM.
      </p>
    </>
  )
}