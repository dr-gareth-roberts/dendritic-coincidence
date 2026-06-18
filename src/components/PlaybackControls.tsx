/**
 * PlaybackControls — play / pause / speed / step / scrubber for the trial.
 *
 * The trial is computed once by the sim and lives in the store; the playback
 * hook drives a playhead through the trace and the 3D scene samples voltages
 * at the current playhead time. Scrubbing the slider scrubs the scene too.
 */

import { useAppStore } from '../state/store'
import { usePlayback } from './playback'

interface PlaybackControlsProps {
  playback: ReturnType<typeof usePlayback>
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const

export function PlaybackControls({ playback }: PlaybackControlsProps) {
  const trial = useAppStore((s) => s.lastTrial)
  const runTrial = useAppStore((s) => s.runTrial)
  const runSweep = useAppStore((s) => s.runSweep)
  const sweepLoading = useAppStore((s) => s.sweepLoading)
  const params = useAppStore((s) => s.params)
  const setParam = useAppStore((s) => s.setParam)

  const t = playback.playhead
  const duration = trial?.duration ?? 0
  const hasTrial = trial !== null

  return (
    <div className="playback">
      <div className="row buttons">
        <button
          onClick={playback.toggle}
          disabled={!hasTrial}
          className="primary"
          aria-label={playback.isPlaying ? 'Pause' : 'Play'}
        >
          {playback.isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => playback.step(-5)} disabled={!hasTrial} aria-label="Step back 5ms">
          −5 ms
        </button>
        <button onClick={() => playback.step(+5)} disabled={!hasTrial} aria-label="Step forward 5ms">
          +5 ms
        </button>
        <button onClick={runTrial} className="primary" aria-label="Run new trial">
          ↻ Re-run
        </button>
        <button onClick={runSweep} disabled={sweepLoading} aria-label="Run sweep">
          {sweepLoading ? 'Sweeping…' : 'Sweep ΔT'}
        </button>
      </div>

      <div className="row scrubber">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.5}
          value={t}
          onChange={(e) => {
            playback.pause()
            playback.setPlayhead(Number(e.target.value))
          }}
          disabled={!hasTrial}
        />
        <span className="timecode">
          {t.toFixed(1)} / {duration.toFixed(0)} ms
        </span>
      </div>

      <div className="row speed">
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => playback.setSpeed(s)}
            disabled={!hasTrial}
            className={playback.speed === s ? 'speed-active' : 'speed-btn'}
            aria-label={`Speed ${s}x`}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="row delta-t">
        <label>
          ΔT (syn2 − syn1)
          <span className="value">{params.deltaT.toFixed(1)} ms</span>
        </label>
        <input
          type="range"
          min={-50}
          max={50}
          step={1}
          value={params.deltaT}
          onChange={(e) => setParam('deltaT', Number(e.target.value))}
        />
      </div>
    </div>
  )
}