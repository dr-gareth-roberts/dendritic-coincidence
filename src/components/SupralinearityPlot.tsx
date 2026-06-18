/**
 * Supralinearity sweep plot: supralinearity ratio vs ΔT.
 *
 * Recomputes the sweep when triggered; plots ratio(ΔT) from a stored
 * array of {deltaT, ratio} pairs.
 */

import { useEffect, useRef } from 'react'

export interface SweepPoint {
  deltaT: number
  ratio: number
  paired: number
}

interface SupralinearityPlotProps {
  sweep: SweepPoint[] | null
  height?: number
  loading?: boolean
}

export function SupralinearityPlot({ sweep, height = 220, loading }: SupralinearityPlotProps) {
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

    ctx.fillStyle = '#0a0a1f'
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    const padL = 36
    const padR = 16
    const padT = 16
    const padB = 28
    const plotW = cssWidth - padL - padR
    const plotH = cssHeight - padT - padB

    // Axes
    ctx.strokeStyle = '#2a2a4f'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, padT)
    ctx.lineTo(padL, padT + plotH)
    ctx.lineTo(padL + plotW, padT + plotH)
    ctx.stroke()

    // Y range 0 to 3 (covers typical supralinearity ratios)
    const yMin = 0
    const yMax = 3

    // Grid + y ticks
    ctx.fillStyle = '#8888aa'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    for (let r = 0; r <= 3; r += 0.5) {
      const y = padT + plotH - ((r - yMin) / (yMax - yMin)) * plotH
      ctx.strokeStyle = r === 1 ? '#444466' : '#222244'
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(padL + plotW, y)
      ctx.stroke()
      ctx.fillText(r.toFixed(1), padL - 4, y + 3)
    }

    // X ticks
    ctx.textAlign = 'center'
    const xMin = -50
    const xMax = 50
    for (let t = -50; t <= 50; t += 10) {
      const x = padL + ((t - xMin) / (xMax - xMin)) * plotW
      ctx.fillText(`${t}`, x, padT + plotH + 14)
    }
    ctx.fillText('ΔT (ms)', padL + plotW / 2, padT + plotH + 24)

    if (loading) {
      ctx.fillStyle = '#aaaacc'
      ctx.font = '13px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Running sweep…', padL + plotW / 2, padT + plotH / 2)
      return
    }

    if (!sweep || sweep.length === 0) {
      ctx.fillStyle = '#aaaacc'
      ctx.font = '13px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Press "Sweep ΔT" to plot', padL + plotW / 2, padT + plotH / 2)
      return
    }

    function xOf(t: number): number {
      return padL + ((t - xMin) / (xMax - xMin)) * plotW
    }
    function yOf(r: number): number {
      return padT + plotH - ((r - yMin) / (yMax - yMin)) * plotH
    }

    // Plot the curve
    ctx.strokeStyle = '#ffaa44'
    ctx.lineWidth = 2
    ctx.beginPath()
    let started = false
    for (const p of sweep) {
      const x = xOf(p.deltaT)
      const y = yOf(p.ratio)
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    // Mark the peak
    let peakIdx = 0
    for (let i = 1; i < sweep.length; i++) {
      if (sweep[i].ratio > sweep[peakIdx].ratio) peakIdx = i
    }
    const peak = sweep[peakIdx]
    ctx.fillStyle = '#ffdd66'
    ctx.beginPath()
    ctx.arc(xOf(peak.deltaT), yOf(peak.ratio), 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffdd66'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(
      `peak: ${peak.ratio.toFixed(2)}× at ΔT=${peak.deltaT} ms`,
      padL + 8,
      padT + 14
    )
  }, [sweep, height, loading])

  return <canvas ref={canvasRef} style={{ width: '100%', height }} />
}