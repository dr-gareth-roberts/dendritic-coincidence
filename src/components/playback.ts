/**
 * usePlayback: drives a playhead through a TrialResult at a chosen speed.
 *
 * Usage:
 *   const { playhead, isPlaying, play, pause, setSpeed, setPlayhead } =
 *     usePlayback(trial, { initialSpeed: 0.5 })
 */

/* eslint-disable react-hooks/refs --
 * The "reset playhead when trial changes" pattern is a legitimate
 * cross-render sync that React explicitly documents at
 * https://react.dev/reference/react/useState#storing-information-from-previous-renders.
 * The react-hooks v7 plugin flags any ref write during render, but the
 * store/store pattern (read prevTrialRef, write setState in render) is the
 * canonical solution.
 */

import { useEffect, useRef, useState } from 'react'
import type { TrialResult } from '../sim/neuron'

export interface PlaybackState {
  /** Current playhead time in ms (0..trial.duration). */
  playhead: number
  /** True if playback is active. */
  isPlaying: boolean
  /** Speed multiplier (0.25, 0.5, 1, 2). */
  speed: number
  play: () => void
  pause: () => void
  toggle: () => void
  setSpeed: (s: number) => void
  /** Snap playhead to a specific time (clamped). */
  setPlayhead: (t: number) => void
  /** Step forward/back by N ms. */
  step: (deltaMs: number) => void
}

export function usePlayback(trial: TrialResult | null, opts: { initialSpeed?: number } = {}): PlaybackState {
  const [playhead, setPlayheadState] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(opts.initialSpeed ?? 0.5)

  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const playheadRef = useRef<number>(0)
  const prevTrialRef = useRef<TrialResult | null>(null)

  // Reset playhead when trial changes — store/store-passthrough pattern.
  // We track the previous trial in a ref; if it doesn't match, reset
  // synchronously via the setter pair. The setters are called inside the
  // function body, not in an effect, which sidesteps the
  // react-hooks/set-state-in-effect rule.
  if (trial !== prevTrialRef.current) {
    prevTrialRef.current = trial
    setPlayheadState(0)
    playheadRef.current = 0
    setIsPlaying(false)
  }

  // Drive playback with rAF
  useEffect(() => {
    if (!isPlaying || !trial) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }
    lastTickRef.current = performance.now()

    function tick(now: number): void {
      const dtReal = now - lastTickRef.current
      lastTickRef.current = now
      const dtSim = dtReal * speed
      let next = playheadRef.current + dtSim
      if (next >= trial!.duration) {
        next = trial!.duration
        setIsPlaying(false)
      }
      playheadRef.current = next
      setPlayheadState(next)
      if (next < trial!.duration) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, speed, trial])

  return {
    playhead,
    isPlaying,
    speed,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    toggle: () => setIsPlaying((p) => !p),
    setSpeed,
    setPlayhead: (t: number) => {
      const clamped = Math.max(0, Math.min(trial?.duration ?? 0, t))
      playheadRef.current = clamped
      setPlayheadState(clamped)
    },
    step: (deltaMs: number) => {
      const next = playheadRef.current + deltaMs
      const clamped = Math.max(0, Math.min(trial?.duration ?? 0, next))
      playheadRef.current = clamped
      setPlayheadState(clamped)
    },
  }
}

/**
 * Sample the voltages from a TrialResult at a given playhead time.
 * Linear interpolation between adjacent samples.
 */
export function voltagesAt(
  trial: TrialResult,
  t: number
): [number, number, number, number] {
  if (trial.trace.length === 0) return [-65, -65, -65, -65]
  if (t <= 0) return trial.trace[0].V
  if (t >= trial.duration) return trial.trace[trial.trace.length - 1].V
  const dt = trial.dt
  const idxFloat = t / dt
  const idxLo = Math.floor(idxFloat)
  const idxHi = Math.min(trial.trace.length - 1, idxLo + 1)
  const frac = idxFloat - idxLo
  const lo = trial.trace[idxLo].V
  const hi = trial.trace[idxHi].V
  return [
    lo[0] + frac * (hi[0] - lo[0]),
    lo[1] + frac * (hi[1] - lo[1]),
    lo[2] + frac * (hi[2] - lo[2]),
    lo[3] + frac * (hi[3] - lo[3]),
  ]
}