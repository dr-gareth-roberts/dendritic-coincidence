/**
 * Top-level App.
 *
 * Layout:
 *   ┌──────────────────────────────────┬──────────────────────────┐
 *   │  3D NeuronScene (primary viz)    │  PlaybackControls        │
 *   │  drives a playhead through the   │  VoltageTrace            │
 *   │  last trial; the scene is the    │  PresetsPanel            │
 *   │  primary visualization.          │  SupralinearityPlot      │
 *   │                                  │  References              │
 *   └──────────────────────────────────┴──────────────────────────┘
 *
 * The 3D scene reads:
 *   - voltages: interpolated from the trial at the current playhead
 *   - syn1FireT / syn2FireT: when each synapse fired in this trial
 *   - currentT: the playhead (so propagation waves travel from fire times)
 */

import { Component, Suspense, useMemo } from 'react'
import { NeuronScene } from './components/NeuronScene'
import { VoltageTrace } from './components/VoltageTrace'
import { SupralinearityPlot, type SweepPoint } from './components/SupralinearityPlot'
import { PresetsPanel } from './components/PresetsPanel'
import { ParametersPanel } from './components/ParametersPanel'
import { References } from './components/References'
import { PlaybackControls } from './components/PlaybackControls'
import { usePlayback, voltagesAt } from './components/playback'
import { useAppStore } from './state/store'
import './styles.css'

/** Top-level error boundary. A bad leva value, a malformed trial, or
 *  a r3f WebGL context loss shouldn't take the whole page down — it
 *  should show a message in the panel that crashed. */
class PanelErrorBoundary extends Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }
  componentDidCatch(error: Error): void {
    console.error(`[PanelErrorBoundary] ${this.props.name} crashed:`, error)
  }
  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <section className="panel error">
          <h2>{this.props.name} crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '11px' }}>
            {this.state.error.message}
          </pre>
        </section>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const trial = useAppStore((s) => s.lastTrial)
  const sweep = useAppStore((s) => s.sweep)
  const sweepLoading = useAppStore((s) => s.sweepLoading)
  const syn1FireT = useAppStore((s) => s.syn1FireT)
  const syn2FireT = useAppStore((s) => s.syn2FireT)
  const cycleSynapse1 = useAppStore((s) => s.cycleSynapse1)
  const cycleSynapse2 = useAppStore((s) => s.cycleSynapse2)
  // Narrow subscriptions: only re-render when the specific params we pass
  // down actually change. (e.g. bumping trialDuration via leva shouldn't
  // bust the r3f scene's memo.)
  const syn1Mode = useAppStore((s) => s.params.syn1Mode)
  const syn2Mode = useAppStore((s) => s.params.syn2Mode)
  const wAMPA = useAppStore((s) => s.params.wAMPA)
  const wNMDA = useAppStore((s) => s.params.wNMDA)

  const playback = usePlayback(trial, { initialSpeed: 0.5 })

  // The voltages displayed in the 3D scene are interpolated from the trial
  // at the current playhead. When the trial is null, the neuron sits at rest.
  const voltages = useMemo<[number, number, number, number]>(() => {
    if (!trial) return [-65, -65, -65, -65]
    return voltagesAt(trial, playback.playhead)
  }, [trial, playback.playhead])

  return (
    <div className="app">
      <header>
        <h1>dendritic</h1>
        <p className="tagline">
          a CA1 pyramidal neuron's apical trunk — and the dendritic coincidence detector
        </p>
      </header>

      <div className="main">
        <div className="canvas-wrap">
          <PanelErrorBoundary name="3D scene">
            <Suspense
              fallback={
                <div style={{ padding: '20px', color: '#aaaacc' }}>loading scene…</div>
              }
            >
              <NeuronScene
                voltages={voltages}
                syn1Mode={syn1Mode}
                syn2Mode={syn2Mode}
                syn1FireT={syn1FireT}
                syn2FireT={syn2FireT}
                currentT={playback.playhead}
                wAMPA1={wAMPA}
                wNMDA1={wNMDA}
                wAMPA2={wAMPA}
                wNMDA2={wNMDA}
                trial={trial}
                onSyn1Click={cycleSynapse1}
                onSyn2Click={cycleSynapse2}
              />
            </Suspense>
          </PanelErrorBoundary>
          <div className="caption-overlay">
            <div className="caption-line">
              <span className="caption-label">playhead</span>
              <span className="caption-value">
                {playback.playhead.toFixed(1)} / {trial ? trial.duration.toFixed(0) : '—'} ms
              </span>
            </div>
            <div className="caption-line">
              <span className="caption-label">soma V</span>
              <span className="caption-value">{voltages[0].toFixed(1)} mV</span>
            </div>
            <div className="caption-line">
              <span className="caption-label">apical trunk V</span>
              <span className="caption-value">{voltages[1].toFixed(1)} mV</span>
            </div>
            <div className="caption-hint">click the synapses to toggle AMPA / NMDA · drag to orbit</div>
          </div>
        </div>

        <aside>
          <PanelErrorBoundary name="Playback">
            <section className="panel">
              <PlaybackControls playback={playback} />
            </section>
          </PanelErrorBoundary>

          <PanelErrorBoundary name="Voltage trace">
            <section className="panel">
              <h2>Voltage trace</h2>
              <VoltageTrace
                trial={trial}
                playhead={playback.playhead}
                onScrub={(t) => {
                  playback.pause()
                  playback.setPlayhead(t)
                }}
              />
              <p className="caption">
                Click the trace to scrub the 3D scene through the trial. The
                dashed cursor shows the current playhead; the label is the soma
                V at that moment.
              </p>
            </section>
          </PanelErrorBoundary>

          <PanelErrorBoundary name="Presets">
            <section className="panel">
              <PresetsPanel />
            </section>
          </PanelErrorBoundary>

          <PanelErrorBoundary name="Parameters">
            <section className="panel">
              <h2>Parameters</h2>
              <ParametersPanel />
            </section>
          </PanelErrorBoundary>

          <PanelErrorBoundary name="Supralinearity sweep">
            <section className="panel">
              <h2>Supralinearity sweep</h2>
              <SupralinearityPlot sweep={sweep as SweepPoint[] | null} loading={sweepLoading} />
              <p className="caption">
                Peak somatic ΔV from a paired-pulse trial, divided by the sum of
                peak ΔVs from each synapse alone. Peaks at small |ΔT| for
                NMDA-mediated coincidence detection (Polsky, Mel &amp; Schiller 2004).
              </p>
            </section>
          </PanelErrorBoundary>

          <PanelErrorBoundary name="References">
            <section className="panel">
              <References />
            </section>
          </PanelErrorBoundary>
        </aside>
      </div>
    </div>
  )
}