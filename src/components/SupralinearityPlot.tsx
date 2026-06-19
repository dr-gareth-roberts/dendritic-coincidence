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

  function drawPlot(): void {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return

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

    // Y range auto-scaled: covers typical sub/supralinear ratios (0-3)
    // and the AP-firing regime in the default parameter set (peak ~29×).
    // The peak marker is clamped to the plot area so it never escapes
    // the top of the canvas; if the ratio exceeds yMax the marker sits
    // at the top edge and a "clipped" note is drawn beside it.
    const yMin = 0
    let yMax = 3

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

    // Auto-scale yMax to fit the peak ratio. The default 3× covers typical
    // sub/supralinear regimes; the AP-firing regime blows past it (peak
    // ~29× in the default parameter set) so we widen yMax to fit. The
    // peak marker is still clamped to the plot area below.
    const peakRatio = sweep.reduce((m, p) => Math.max(m, p.ratio), 0)
    yMax = Math.max(3, peakRatio * 1.1)
    const peakClipped = sweep.some((p) => p.ratio > 3)

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
    // Clamp the peak dot to the plot rectangle so it never escapes the
    // top of the canvas when the ratio is very large (e.g. AP-firing
    // regime where peak ~29× blows past the default 3× yMax). yMax is
    // already widened above to fit the peak, but we still clamp as a
    // safety net against future parameter changes.
    const peakY = Math.max(padT, Math.min(padT + plotH, yOf(peak.ratio)))
    ctx.fillStyle = '#ffdd66'
    ctx.beginPath()
    ctx.arc(xOf(peak.deltaT), peakY, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffdd66'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    const peakLabel = `peak: ${peak.ratio.toFixed(2)}× at ΔT=${peak.deltaT} ms`
    ctx.fillText(peakLabel, padL + 8, padT + 14)
    if (peakClipped) {
      ctx.fillStyle = '#8888aa'
      ctx.font = '9px sans-serif'
      ctx.fillText(
        '(y-axis auto-scaled; AP-firing regime — see README for the AP-vs-EPSP distinction)',
        padL + 8,
        padT + 26
      )
    }
  }

  useEffect(() => {
    drawPlot()
    // drawPlot reads the latest sweep/height/loading via closure on each
    // call; we want the closure to capture current values, not memoize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweep, height, loading])

  // ResizeObserver: re-run the draw when the canvas's CSS size changes
  // (window resize, sidebar collapse, etc). Without this the canvas keeps
  // its old pixel buffer and the plot stretches or blurs.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w > 0 && h > 0) drawPlot()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweep])

  return <canvas ref={canvasRef} style={{ width: '100%', height }} />
}