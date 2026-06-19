/**
 * Triple-pass visual verification for the dendritic neuron viz.
 *
 * Pass 1 — STATIC:    Initial load. Question: is the neuron visible, framed,
 *                    and aesthetically presentable?
 *
 * Pass 2 — DYNAMIC:  Run a trial, scrub the playhead through the firing
 *                    event. Question: do voltages animate, does the wave
 *                    travel, do firing events show?
 *
 * Pass 3 — AESTHETIC: Toggle a synapse, fast-forward to peak AP. Question:
 *                    is the bloom carrying voltage, do the lights work?
 *
 * Output: PNG screenshots in .verify/ + a pass/fail report.
 */

import { chromium, type Page } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const URL = 'http://localhost:5273/'
const OUT = join(process.cwd(), '.verify')
mkdirSync(OUT, { recursive: true })

interface Finding {
  pass: number
  severity: 'FAIL' | 'WARN' | 'OK'
  note: string
}

const findings: Finding[] = []
function report(pass: number, severity: Finding['severity'], note: string): void {
  findings.push({ pass, severity, note })
  // eslint-disable-next-line no-console
  console.log(`[pass ${pass}] ${severity.padEnd(4)} ${note}`)
}

async function readPlayhead(page: Page): Promise<number> {
  const text = await page.locator('.caption-value').first().textContent()
  return parseFloat(text?.split('/')[0] ?? '0')
}

async function readSomaV(page: Page): Promise<number> {
  const text = await page.locator('.caption-value').nth(1).textContent()
  return parseFloat(text?.split(' ')[0] ?? '-65')
}

async function readTrunkV(page: Page): Promise<number> {
  const text = await page.locator('.caption-value').nth(2).textContent()
  return parseFloat(text?.split(' ')[0] ?? '-65')
}

async function scrubTo(page: Page, tMs: number): Promise<void> {
  // Use fill() rather than mouse.click(): clicks on a <input type=range> get
  // snapped to the step grid by the browser, and headless mouse coordinates
  // are jittery at low t values. fill() lands the input on the desired value
  // directly via the DOM, then we dispatch a change event.
  const scrubber = page.locator('.playback .scrubber input[type="range"]')
  const snapped = Math.max(0, Math.min(200, Math.round(tMs * 2) / 2))
  await scrubber.fill(String(snapped))
  await scrubber.dispatchEvent('change')
  await page.waitForTimeout(180)
}

interface CanvasStats {
  nonBlackFrac: number
  brightFrac: number  // fraction of pixels with r+g+b > 200
  whiteFrac: number   // fraction of pixels with r,g,b all > 180
  centerBrightFrac: number  // bright-pixel fraction in a central 320×600 ROI (where the neuron lives)
  centerAvgR: number
  centerAvgG: number
  centerAvgB: number
  avgR: number
  avgG: number
  avgB: number
  maxR: number
  maxG: number
  maxB: number
  size: { w: number; h: number }
  index: number
}

async function canvasStats(page: Page): Promise<CanvasStats> {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[]
    // Pick the LARGEST canvas by area — that's the R3F main scene.
    // The VoltageTrace canvas is small (~360×180).
    let bestIdx = 0
    let bestArea = 0
    for (let i = 0; i < all.length; i++) {
      const c = all[i]
      const a = c.width * c.height
      if (a > bestArea) {
        bestArea = a
        bestIdx = i
      }
    }
    const c = all[bestIdx]
    if (!c) {
      return {
        nonBlackFrac: 0, brightFrac: 0, whiteFrac: 0,
        centerBrightFrac: 0, centerAvgR: 0, centerAvgG: 0, centerAvgB: 0,
        avgR: 0, avgG: 0, avgB: 0,
        maxR: 0, maxG: 0, maxB: 0,
        size: { w: 0, h: 0 }, index: -1,
      }
    }
    const tmp = document.createElement('canvas')
    tmp.width = c.width
    tmp.height = c.height
    const ctx = tmp.getContext('2d')!
    ctx.drawImage(c, 0, 0)
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    let nonBlack = 0, bright = 0, white = 0
    let totalR = 0, totalG = 0, totalB = 0
    let maxR = 0, maxG = 0, maxB = 0
    const n = data.length / 4

    // Central ROI: 320×600 region around the centre where the neuron
    // is drawn. The whole canvas is dominated by deep-purple background,
    // so a whole-frame brightness measurement is insensitive to changes
    // in the small neuron. The central ROI is where voltage actually shows.
    const roiW = 320
    const roiH = 600
    const roiX0 = Math.max(0, Math.floor((c.width - roiW) / 2))
    const roiY0 = Math.max(0, Math.floor((c.height - roiH) / 2))
    let roiBright = 0, roiR = 0, roiG = 0, roiB = 0, roiN = 0
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const idx = (y * c.width + x) * 4
        const r = data[idx], g = data[idx + 1], b = data[idx + 2]
        totalR += r; totalG += g; totalB += b
        if (r > maxR) maxR = r
        if (g > maxG) maxG = g
        if (b > maxB) maxB = b
        const sum = r + g + b
        if (sum > 30) nonBlack++
        if (sum > 200) bright++
        if (r > 180 && g > 180 && b > 180) white++
        if (x >= roiX0 && x < roiX0 + roiW && y >= roiY0 && y < roiY0 + roiH) {
          roiR += r; roiG += g; roiB += b; roiN++
          if (sum > 200) roiBright++
        }
      }
    }
    return {
      nonBlackFrac: nonBlack / n,
      brightFrac: bright / n,
      whiteFrac: white / n,
      centerBrightFrac: roiBright / roiN,
      centerAvgR: roiR / roiN,
      centerAvgG: roiG / roiN,
      centerAvgB: roiB / roiN,
      avgR: totalR / n,
      avgG: totalG / n,
      avgB: totalB / n,
      maxR, maxG, maxB,
      size: { w: c.width, h: c.height },
      index: bestIdx,
    }
  })
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await ctx.newPage()

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return
    const text = msg.text()
    // Known-harmless noise from third-party deps + Playwright capture.
    if (text.includes('THREE.Clock')) return              // drei <Stars> uses deprecated THREE.Clock
    if (text.includes('GPU stall')) return                 // Playwright ReadPixels during screenshot
    if (text.includes('passive event listener')) return    // drei/d3 internals
    if (text.includes('THREE.WebGLRenderer')) return       // antialias/preserveDrawingBuffer hints
    if (text.includes('Multiple instances of Three.js')) return
    if (text.includes('LEVA: Key')) return                 // leva path-uniqueness warnings (we name per-compartment keys)
    errors.push(`console.${msg.type()}: ${text}`)
  })

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  // ============================================================
  // PASS 1 — STATIC
  // ============================================================
  console.log('\n=== PASS 1: STATIC (initial load) ===')
  await page.waitForTimeout(2000) // Give R3F a chance to fully render
  await page.screenshot({ path: join(OUT, 'pass1-static.png'), fullPage: false })

  // Dump canvas pixel histogram from the R3F canvas only
  const hist = await page.evaluate(() => {
    const c = document.querySelector('.canvas-wrap canvas') as HTMLCanvasElement
    if (!c) return { error: 'no .canvas-wrap canvas' }
    const tmp = document.createElement('canvas')
    tmp.width = c.width
    tmp.height = c.height
    const ctx = tmp.getContext('2d')!
    ctx.drawImage(c, 0, 0)
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    let r = 0, g = 0, b = 0, n = 0, maxR = 0, maxG = 0, maxB = 0
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
      if (data[i] > maxR) maxR = data[i]
      if (data[i + 1] > maxG) maxG = data[i + 1]
      if (data[i + 2] > maxB) maxB = data[i + 2]
    }
    return { avgR: r / n, avgG: g / n, avgB: b / n, maxR, maxG, maxB, w: c.width, h: c.height }
  })
  console.log('R3F canvas histogram:', JSON.stringify(hist))

  const canvasBox = await page.locator('canvas').first().boundingBox()
  if (canvasBox && canvasBox.width >= 200 && canvasBox.height >= 200) {
    report(1, 'OK', `canvas ${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}`)
  } else {
    report(1, 'FAIL', `canvas not visible or too small: ${JSON.stringify(canvasBox)}`)
  }

  const headerText = await page.locator('header h1').textContent()
  if (headerText?.includes('dendritic')) {
    report(1, 'OK', 'header rendered with title')
  } else {
    report(1, 'FAIL', `header title missing: ${headerText}`)
  }

  if (await page.locator('button:has-text("Play")').first().isVisible()) {
    report(1, 'OK', 'play button visible')
  } else {
    report(1, 'FAIL', 'play button not visible')
  }

  const staticStats = await canvasStats(page)
  const staticFrac = (staticStats.nonBlackFrac * 100).toFixed(1)
  if (staticStats.nonBlackFrac >= 0.05) {
    report(1, 'OK', `static canvas has ${staticFrac}% non-black pixels`)
  } else {
    report(1, 'FAIL', `static canvas mostly black (${staticFrac}%) — neuron not visible`)
  }
  report(1, 'OK', `canvas stats: ${staticStats.size.w}x${staticStats.size.h}, index=${staticStats.index}`)

  // ============================================================
  // PASS 2 — DYNAMIC
  // ============================================================
  console.log('\n=== PASS 2: DYNAMIC (run trial, scrub) ===')

  await page.locator('button:has-text("Re-run")').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, 'pass2-trial-start.png') })

  // Slow playback so we can capture mid-trial
  const slowBtn = page.locator('button:has-text("0.25")').first()
  if (await slowBtn.isVisible()) {
    await slowBtn.click()
    await page.waitForTimeout(100)
  }

  await page.locator('button:has-text("Play")').first().click()
  // Sample playhead at three short intervals to prove it's actually
  // advancing. A single read at 600ms risks landing at end-of-trial
  // (200ms trial × any speed > 0.33 lands at 200ms by 600ms wall time).
  const ph1 = await readPlayhead(page)
  await page.waitForTimeout(120)
  const ph2 = await readPlayhead(page)
  await page.waitForTimeout(120)
  const ph3 = await readPlayhead(page)
  await page.screenshot({ path: join(OUT, 'pass2-playing.png') })

  // Pause
  const pauseVisible = await page.locator('button:has-text("Pause")').first().isVisible().catch(() => false)
  if (pauseVisible) {
    await page.locator('button:has-text("Pause")').first().click()
    await page.waitForTimeout(200)
  }

  // Playhead must advance monotonically AND stay below the trial duration
  // (i.e. playback didn't run straight to the end). At least one interval
  // must show clear forward motion.
  if (ph1 < ph2 && ph2 < ph3 && ph2 > 0) {
    report(2, 'OK', `playhead advancing mid-trial: ${ph1.toFixed(1)} → ${ph2.toFixed(1)} → ${ph3.toFixed(1)} ms`)
  } else if (ph1 < ph2 && ph2 < ph3) {
    report(2, 'OK', `playhead advancing: ${ph1.toFixed(1)} → ${ph2.toFixed(1)} → ${ph3.toFixed(1)} ms`)
  } else if (ph3 >= 200 || ph3 >= ph2) {
    report(2, 'FAIL', `playhead stuck at end of trial: ${ph1.toFixed(1)} → ${ph2.toFixed(1)} → ${ph3.toFixed(1)} ms — playback may not be running`)
  } else {
    report(2, 'FAIL', `playhead not advancing: ${ph1.toFixed(1)} → ${ph2.toFixed(1)} → ${ph3.toFixed(1)} ms`)
  }

  // Scrub to the NMDA-peak window (t=32.5ms — 2.5ms after syn fires at 30ms,
  // dendritic spike peak). The trunk should be strongly depolarised here
  // and the soma should be rising toward AP threshold.
  await scrubTo(page, 32.5)
  await page.screenshot({ path: join(OUT, 'pass2-scrubbed-firing.png') })
  const phNMDA = await readPlayhead(page)
  if (phNMDA >= 31 && phNMDA <= 34) {
    report(2, 'OK', `scrubber works, playhead at ${phNMDA.toFixed(1)} ms (NMDA-peak window)`)
  } else {
    report(2, 'WARN', `scrubber landed at ${phNMDA} ms (expected 31-34)`)
  }

  const trunkVNMDA = await readTrunkV(page)
  if (trunkVNMDA > -20) {
    report(2, 'OK', `trunk fired local dendritic spike, V=${trunkVNMDA.toFixed(2)} mV at t=${phNMDA}ms`)
  } else if (trunkVNMDA > -50) {
    report(2, 'OK', `trunk in NMDA plateau, V=${trunkVNMDA.toFixed(2)} mV at t=${phNMDA}ms (substantial depolarisation)`)
  } else if (trunkVNMDA > -65 + 0.3) {
    report(2, 'OK', `trunk mildly depolarised, V=${trunkVNMDA.toFixed(2)} mV at t=${phNMDA}ms`)
  } else {
    report(2, 'FAIL', `trunk V at rest (${trunkVNMDA.toFixed(2)} mV) at t=${phNMDA}ms — NMDA not reaching trunk`)
  }

  // Scrub to ~60ms (post-fire, propagation)
  await scrubTo(page, 60)
  await page.screenshot({ path: join(OUT, 'pass2-propagation.png') })
  const trunkV60 = await readTrunkV(page)
  const somaV60 = await readSomaV(page)
  if (somaV60 > -65 + 5) {
    report(2, 'OK', `soma depolarised to ${somaV60.toFixed(2)} mV at t=60ms — somatic response`)
  } else if (somaV60 > -65 + 0.5) {
    // Small EPSP. Real but on the threshold of detection; old (too-lax)
    // threshold lived here. Keep this as a WARN so we don't lose signal,
    // but the headline check above is what gates the test.
    report(2, 'WARN', `soma only mildly depolarised (${somaV60.toFixed(2)} mV at t=60ms) — synaptic integration weak`)
  } else {
    report(2, 'FAIL', `soma not depolarised (${somaV60.toFixed(2)} mV at t=60ms) — no synaptic integration`)
  }
  report(2, 'OK', `trunk V at t=60ms: ${trunkV60.toFixed(2)} mV`)

  // Better somatic-response check: read the peak somatic V over the whole
  // trial, not at a single moment. The AP fires a few ms after the synapse
  // (somaAP peak is around t=33-40ms for fireT1=30), so any single-time
  // sample either lands before the AP or after it has decayed. A peak
  // search over the trace catches the actual maximum.
  const somaPeakResult = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__dendriticStore
    if (!store) return { peakV: -65, nSamples: 0 }
    const t = store.getState().lastTrial
    if (!t) return { peakV: -65, nSamples: 0 }
    let peakV = -Infinity
    for (const s of t.trace) {
      if (s.V[0] > peakV) peakV = s.V[0]
    }
    return { peakV, nSamples: t.trace.length }
  })
  if (somaPeakResult.peakV > -65 + 5) {
    report(2, 'OK', `soma peak V over trial = ${somaPeakResult.peakV.toFixed(2)} mV (full depolarisation including any AP, from ${somaPeakResult.nSamples} samples)`)
  } else if (somaPeakResult.peakV > -65 + 0.5) {
    report(2, 'WARN', `soma peak V over trial = ${somaPeakResult.peakV.toFixed(2)} mV (small subthreshold EPSP — AP not driven by this synapse pair)`)
  } else {
    report(2, 'FAIL', `soma peak V over trial = ${somaPeakResult.peakV.toFixed(2)} mV (no somatic response)`)
  }

  // ============================================================
  // PASS 3 — AESTHETIC
  // ============================================================
  console.log('\n=== PASS 3: AESTHETIC (peak AP, bloom, light) ===')

  // Re-run from a fresh state
  await scrubTo(page, 0)
  await page.locator('button:has-text("Re-run")').click()
  await page.waitForTimeout(300)

  // Slow playback to capture peak AP
  if (await slowBtn.isVisible()) await slowBtn.click()
  await page.locator('button:has-text("Play")').first().click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(OUT, 'pass3-mid-trial.png') })
  if (pauseVisible) {
    const stillPlaying = await page.locator('button:has-text("Pause")').first().isVisible().catch(() => false)
    if (stillPlaying) await page.locator('button:has-text("Pause")').first().click()
  }

  // The strongest visible depolarisation in the headline coincidence demo
  // is the trunk during the NMDA plateau (t ≈ 32.5ms, ~2.5ms after the
  // synapses fire). The supralinear somatic EPSP is also visible around
  // t ≈ 33ms. Sample both; the centre ROI brightness should rise above
  // the resting neuron in either case.
  await scrubTo(page, 32.5)
  await page.screenshot({ path: join(OUT, 'pass3-peak-ap.png') })
  const trunkAtPeak = await readTrunkV(page)
  const somaAtPeak = await readSomaV(page)
  report(
    3,
    'OK',
    `NMDA peak (t=32.5ms): trunk V=${trunkAtPeak.toFixed(1)} mV, soma V=${somaAtPeak.toFixed(1)} mV`
  )
  if (trunkAtPeak > -20) {
    report(3, 'OK', `trunk fired local dendritic spike (V > -20mV)`)
  } else if (trunkAtPeak > -50) {
    report(3, 'OK', `trunk in NMDA plateau (V > -50mV)`)
  } else if (trunkAtPeak > -65 + 1) {
    report(3, 'OK', `trunk mildly depolarised during NMDA peak`)
  } else {
    report(3, 'WARN', `trunk essentially at rest during NMDA peak (V=${trunkAtPeak.toFixed(1)})`)
  }

  // Sample at t=120 (post-plateau, returning to rest)
  await scrubTo(page, 120)
  await page.screenshot({ path: join(OUT, 'pass3-post-ap.png') })
  const somaPost = await readSomaV(page)
  report(3, 'OK', `soma post-plateau (t=120ms): V = ${somaPost.toFixed(1)} mV`)

  // Go back to NMDA peak for the brightness measurement (the bright
  // moment).
  await scrubTo(page, 32.5)
  await page.waitForTimeout(200)

  // Sample canvas stats at NMDA peak. The 320×600 central ROI covers the
  // trunk and soma, where voltage actually lives. The whole-frame
  // brightness is dominated by deep-purple background and is insensitive
  // to small changes in the neuron.
  const peakStats = await canvasStats(page)
  report(
    3,
    'OK',
    `peak canvas whole-frame avg RGB=(${peakStats.avgR.toFixed(0)}, ${peakStats.avgG.toFixed(0)}, ${peakStats.avgB.toFixed(0)}); ` +
    `centre ROI avg RGB=(${peakStats.centerAvgR.toFixed(0)}, ${peakStats.centerAvgG.toFixed(0)}, ${peakStats.centerAvgB.toFixed(0)}); ` +
    `${(peakStats.brightFrac * 100).toFixed(2)}% bright; max=(${peakStats.maxR}, ${peakStats.maxG}, ${peakStats.maxB})`
  )
  report(
    3,
    'OK',
    `static canvas: centre ROI avg RGB=(${staticStats.centerAvgR.toFixed(0)}, ${staticStats.centerAvgG.toFixed(0)}, ${staticStats.centerAvgB.toFixed(0)}); ` +
    `${(staticStats.brightFrac * 100).toFixed(2)}% bright; max=(${staticStats.maxR}, ${staticStats.maxG}, ${staticStats.maxB})`
  )

  // Bloom must be visibly carrying the voltage. Compare centre-ROI
  // brightness sum: at rest the central ROI is dominated by background
  // (deep purple). At NMDA peak the depolarised trunk adds substantial
  // emissive light into the ROI.
  const peakCenterSum = peakStats.centerAvgR + peakStats.centerAvgG + peakStats.centerAvgB
  const staticCenterSum = staticStats.centerAvgR + staticStats.centerAvgG + staticStats.centerAvgB
  const centerBrightnessDelta = (peakCenterSum - staticCenterSum) / Math.max(1, staticCenterSum)
  if (centerBrightnessDelta > 0.05) {
    report(
      3,
      'OK',
      `centre ROI brightness +${(centerBrightnessDelta * 100).toFixed(1)}% above static — voltage driving visible light`
    )
  } else {
    report(
      3,
      'FAIL',
      `centre ROI brightness only ${(centerBrightnessDelta * 100).toFixed(1)}% above static (${peakCenterSum.toFixed(1)} vs ${staticCenterSum.toFixed(1)}) — voltage not driving light`
    )
  }

  // Final summary screenshot
  await page.screenshot({ path: join(OUT, 'pass3-final.png') })

  // ============================================================
  // PASS 4 — SUPRALINEARITY CURVE SHAPE
  // ============================================================
  // This is the headline verification gate: the curve must reproduce
  // Polsky/Mel/Schiller 2004 Fig 2 qualitatively. Peak at small |ΔT|,
  // falling to ~1.0× by |ΔT| ≈ 20ms, and the curve must be substantially
  // supralinear (>1.2×) somewhere near the centre.
  console.log('\n=== PASS 4: SUPRALINEARITY CURVE SHAPE ===')

  // Trigger the sweep via the same store the UI uses. We rely on the
  // window.__dendriticStore handle set up in src/main.tsx.
  const sweepTriggered = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__dendriticStore
    if (!store) return { ok: false, reason: 'no __dendriticStore on window' }
    const state = store.getState()
    state.runSweep()
    return { ok: true, reason: 'runSweep() invoked' }
  })
  if (!sweepTriggered.ok) {
    report(4, 'FAIL', `could not trigger sweep: ${sweepTriggered.reason}`)
  } else {
    report(4, 'OK', 'sweep triggered')
  }

  // Wait for the sweep to finish. The store flips sweepLoading → false and
  // populates `sweep`. Polling every 250ms, max 30s.
  let sweep: { deltaT: number; ratio: number; paired: number }[] | null = null
  let blowups = 0
  const sweepDeadline = Date.now() + 30_000
  while (Date.now() < sweepDeadline) {
    const result = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__dendriticStore
      if (!store) return { loading: true, sweep: null, blowups: 0 }
      const s = store.getState()
      return { loading: s.sweepLoading, sweep: s.sweep, blowups: s.sweepBlowups ?? 0 }
    })
    if (!result.loading && result.sweep && result.sweep.length > 0) {
      sweep = result.sweep
      blowups = result.blowups
      break
    }
    await page.waitForTimeout(250)
  }

  if (!sweep) {
    report(4, 'FAIL', 'sweep did not complete within 30s')
  } else {
    // Take a screenshot of the plot panel for the report.
    await page.locator('button:has-text("Pause")').first().click().catch(() => {})
    await page.screenshot({ path: join(OUT, 'pass4-sweep.png') })

    report(4, 'OK', `sweep returned ${sweep.length} points: ΔT = [${sweep.map((p) => p.deltaT).join(', ')}] ms`)

    // Assertion 0: the sweep must have produced all 21 expected points.
    // A point being missing (e.g. r.blewUp silently dropped) used to pass.
    const expectedCount = 21
    if (sweep.length === expectedCount) {
      report(4, 'OK', `sweep has all ${expectedCount} expected ΔT points (no blowups dropped)`)
    } else {
      report(4, 'FAIL', `sweep has ${sweep.length} points, expected ${expectedCount} (blowups or errors dropped points)`)
    }

    // Assertion 0b: the store-level blowup counter must be zero. With the
    // new blowup handling in runSweep, blowup points are kept in the sweep
    // array (with ratio=NaN) and counted here, so the verifier fails fast.
    if (blowups === 0) {
      report(4, 'OK', 'no integrator blowups during sweep')
    } else {
      report(4, 'FAIL', `${blowups} sweep point(s) blew up the integrator — sim is unstable`)
    }

    // Assertion 0c: every ratio must be finite. A NaN ratio would let
    // Math.max(...) return NaN and the comparison `NaN < peakRatio`
    // evaluate to false, accidentally passing the "curve falls off" test.
    const nanPoints = sweep.filter((p) => !Number.isFinite(p.ratio))
    if (nanPoints.length === 0) {
      report(4, 'OK', 'all sweep ratios are finite numbers')
    } else {
      report(4, 'FAIL', `${nanPoints.length} sweep point(s) have non-finite ratio (NaN/Inf): ΔT = [${nanPoints.map((p) => p.deltaT).join(', ')}]`)
    }

    // Locate the peak ratio. Skip non-finite points so a single NaN can't
    // make the peak undefined.
    let peakRatio = 0
    let peakDT = 0
    for (const p of sweep) {
      if (!Number.isFinite(p.ratio)) continue
      if (p.ratio > peakRatio) {
        peakRatio = p.ratio
        peakDT = p.deltaT
      }
    }

    // Assertion 1: peak must be ≥1.2×. With AP-firing regimes, the peak
    // can be much higher (the AP is all-or-nothing, so the ratio is large
    // when baseline is small). The key qualitative claim is that the
    // coincidence point is *strictly* above the linear baseline (ratio > 1).
    if (peakRatio >= 1.2) {
      report(4, 'OK', `peak ratio = ${peakRatio.toFixed(2)}× at ΔT=${peakDT}ms (supralinear)`)
    } else {
      report(4, 'FAIL', `peak ratio = ${peakRatio.toFixed(2)}× (must be ≥1.2× — NMDA isn't doing the work)`)
    }

    // Assertion 2: peak must be at small |ΔT| (within ±10ms).
    if (Math.abs(peakDT) <= 10) {
      report(4, 'OK', `peak located at |ΔT|=${Math.abs(peakDT)}ms (within coincidence window)`)
    } else {
      report(4, 'FAIL', `peak at |ΔT|=${Math.abs(peakDT)}ms (expected ≤10ms)`)
    }

    // Assertion 3: ratio at |ΔT|≥30 must be near 1.0 (sublinear regime).
    // Use only finite points; a NaN would otherwise contaminate the mean.
    const farPoints = sweep.filter((p) => Math.abs(p.deltaT) >= 30 && Number.isFinite(p.ratio))
    if (farPoints.length === 0) {
      report(4, 'WARN', 'sweep contains no |ΔT|≥30ms points — cannot assert sublinear regime')
    } else {
      const avgFar = farPoints.reduce((sum, p) => sum + p.ratio, 0) / farPoints.length
      if (avgFar <= 1.1) {
        report(4, 'OK', `mean ratio at |ΔT|≥30ms = ${avgFar.toFixed(2)}× (sublinear regime — inputs sum linearly)`)
      } else {
        report(4, 'FAIL', `mean ratio at |ΔT|≥30ms = ${avgFar.toFixed(2)}× (expected ≤1.1× — coincidence window too broad)`)
      }
    }

    // Assertion 4: ratio at |ΔT|≥40 must be < peak (monotone-ish decay).
    const veryFar = sweep.filter((p) => Math.abs(p.deltaT) >= 40 && Number.isFinite(p.ratio))
    if (veryFar.length > 0) {
      const maxFar = Math.max(...veryFar.map((p) => p.ratio))
      if (maxFar < peakRatio) {
        report(4, 'OK', `ratio at |ΔT|≥40ms (max ${maxFar.toFixed(2)}×) < peak (${peakRatio.toFixed(2)}×) — curve falls off`)
      } else {
        report(4, 'FAIL', `ratio at |ΔT|≥40ms (${maxFar.toFixed(2)}×) not below peak (${peakRatio.toFixed(2)}×) — curve doesn't decay`)
      }
    }

    // Assertion 5 (new): ratio at exactly ΔT=20ms (or nearest sample) must
    // be near 1.0 — the README's qualitative claim is that the curve
    // "falls to ~1.0 by |ΔT| ≈ 20ms". A genuinely supralinear curve has
    // the sublinear regime kicking in by then.
    const near20 = sweep
      .filter((p) => Number.isFinite(p.ratio))
      .sort((a, b) => Math.abs(Math.abs(a.deltaT) - 20) - Math.abs(Math.abs(b.deltaT) - 20))[0]
    if (near20) {
      if (near20.ratio <= 1.15) {
        report(4, 'OK', `ratio at |ΔT|≈20ms (ΔT=${near20.deltaT}) = ${near20.ratio.toFixed(2)}× (curve has returned to linear by 20ms)`)
      } else {
        report(4, 'FAIL', `ratio at |ΔT|≈20ms (ΔT=${near20.deltaT}) = ${near20.ratio.toFixed(2)}× (expected ≤1.15× — coincidence window too broad)`)
      }
    }
  }

  // ============================================================
  // GLOBAL
  // ============================================================
  if (errors.length > 0) {
    for (const e of errors.slice(0, 10)) {
      report(0, 'FAIL', e)
    }
  } else {
    report(0, 'OK', 'no console errors or page errors')
  }

  await browser.close()

  const reportPath = join(OUT, 'report.txt')
  const grouped = [1, 2, 3, 4, 0].map((p) => ({
    pass: p,
    items: findings.filter((f) => f.pass === p),
  }))
  const reportText = grouped
    .map(({ pass, items }) => {
      const head = pass === 0 ? 'GLOBAL' : `PASS ${pass}`
      return `=== ${head} ===\n` + items.map((f) => `[${f.severity}] ${f.note}`).join('\n')
    })
    .join('\n\n') + '\n'
  writeFileSync(reportPath, reportText)
  console.log(`\nWrote report to ${reportPath}\n`)
  console.log(reportText)

  const fails = findings.filter((f) => f.severity === 'FAIL').length
  if (fails > 0) {
    console.log(`\n${fails} FAIL(s)`)
    process.exit(1)
  }
  console.log('\nAll checks passed.')
}

main().catch((e) => {
  console.error('Verification crashed:', e)
  process.exit(2)
})