/**
 * Voltage traces for all four compartments over the last trial.
 *
 * Canvas2D. Click anywhere on the trace to jump the playhead to that time
 * — the 3D scene follows.
 */

import { useEffect, useRef } from 'react'
import { COMPARTMENT_NAMES } from '../sim/neuron'
import type { TrialResult } from '../sim/neuron'

interface VoltageTraceProps {
  trial: TrialResult | null
  height?: number
  /** Current playhead time (ms) — drawn as a vertical cursor. */
  playhead?: number
  /** Called when the user clicks on the trace. Receives the clicked time. */
  onScrub?: (t: number) => void
}

const COMPARTMENT_COLORS = ['#ff6464', '#64ff64', '#64c0ff', '#ffaa64']
const V_MIN = -80
const V_MAX = 50

export function VoltageTrace({ trial, height = 220, playhead, onScrub }: VoltageTraceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssWidth = canvas.clientWidth
    const cssHeight = canvas.clientHeight
    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    ctx.fillStyle = '#0a0a1f'
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    // Axes
    const padL = 36
    const padR = 12
    const padT = 16
    const padB = 24
    const plotW = cssWidth - padL - padR
    const plotH = cssHeight - padT - padB

    ctx.strokeStyle = '#2a2a4f'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, padT)
    ctx.lineTo(padL, padT + plotH)
    ctx.lineTo(padL + plotW, padT + plotH)
    ctx.stroke()

    // Y-axis ticks
    ctx.fillStyle = '#8888aa'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    for (let v = V_MIN; v <= V_MAX; v += 30) {
      const y = padT + plotH - ((v - V_MIN) / (V_MAX - V_MIN)) * plotH
      ctx.fillText(`${v}`, padL - 4, y + 3)
    }

    if (!trial || trial.trace.length === 0) {
      ctx.fillStyle = '#aaaacc'
      ctx.font = '13px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Run a trial — then click the trace to scrub', padL + plotW / 2, padT + plotH / 2)
      return
    }

    const tMax = trial.duration
    function xOf(t: number): number {
      return padL + (t / tMax) * plotW
    }
    function yOf(V: number): number {
      return padT + plotH - ((V - V_MIN) / (V_MAX - V_MIN)) * plotH
    }

    // Grid lines at every 25 ms
    ctx.strokeStyle = '#1a1a3a'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let t = 0; t <= tMax; t += 25) {
      const x = xOf(t)
      ctx.moveTo(x, padT)
      ctx.lineTo(x, padT + plotH)
    }
    ctx.stroke()

    for (let c = 0; c < 4; c++) {
      ctx.strokeStyle = COMPARTMENT_COLORS[c]
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let started = false
      for (const sample of trial.trace) {
        const x = xOf(sample.t)
        const y = yOf(sample.V[c])
        if (!started) {
          ctx.moveTo(x, y)
          started = true
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    // Playhead cursor
    if (playhead !== undefined && playhead >= 0 && playhead <= tMax) {
      const px = xOf(playhead)
      ctx.strokeStyle = 'rgba(255, 220, 100, 0.8)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(px, padT)
      ctx.lineTo(px, padT + plotH)
      ctx.stroke()
      ctx.setLineDash([])

      // Soma voltage at playhead
      const sampleIdx = Math.max(0, Math.min(trial.trace.length - 1, Math.round(playhead / trial.dt)))
      const somaV = trial.trace[sampleIdx].V[0]
      ctx.fillStyle = '#ffdc64'
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`${somaV.toFixed(1)} mV`, px + 4, padT + 12)
    }

    // X-axis labels
    ctx.fillStyle = '#8888aa'
    ctx.textAlign = 'center'
    for (let t = 0; t <= tMax; t += 50) {
      const x = xOf(t)
      ctx.fillText(`${t}`, x, padT + plotH + 14)
    }
    ctx.fillText('t (ms)', padL + plotW / 2, padT + plotH + 22)

    // Legend
    ctx.textAlign = 'left'
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = COMPARTMENT_COLORS[c]
      ctx.fillRect(padL + plotW - 90, padT + 4 + c * 12, 8, 8)
      ctx.fillStyle = '#aaaacc'
      ctx.fillText(COMPARTMENT_NAMES[c], padL + plotW - 78, padT + 12 + c * 12)
    }
  }, [trial, height, playhead])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>): void {
    if (!onScrub || !trial) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const padL = 36
    const padR = 12
    const plotW = rect.width - padL - padR
    const x = e.clientX - rect.left
    const frac = Math.max(0, Math.min(1, (x - padL) / plotW))
    onScrub(frac * trial.duration)
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        width: '100%',
        height,
        cursor: trial && onScrub ? 'pointer' : 'default',
      }}
    />
  )
}