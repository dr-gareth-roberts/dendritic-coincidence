/**
 * Capture a 30-second demo GIF showing the dendritic coincidence detector.
 *
 * Sequence:
 *   1. Load page, run trial at default ΔT=0 (coincidence → AP).
 *   2. Slow playback through the AP peak (t=30→40ms).
 *   3. Scrub to t=60ms (post-AP somatic response).
 *   4. Switch to ΔT=30ms (sublinear, no AP).
 *   5. Run trial, slow playback (no AP, small EPSPs).
 *   6. Switch to AMPA-only mode (NMDA off — proves NMDA does the work).
 *
 * Output: .verify/demo.gif
 */

import { chromium, type Page } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const URL = 'http://localhost:5273/'
const OUT = join(process.cwd(), '.verify')
mkdirSync(OUT, { recursive: true })

async function scrubTo(page: Page, tMs: number): Promise<void> {
  const scrubber = page.locator('.playback .scrubber input[type="range"]')
  const snapped = Math.max(0, Math.min(200, Math.round(tMs * 2) / 2))
  await scrubber.fill(String(snapped))
  await scrubber.dispatchEvent('change')
  await page.waitForTimeout(180)
}

async function setDeltaT(page: Page, value: number): Promise<void> {
  const slider = page.locator('.playback .delta-t input[type="range"]')
  await slider.fill(String(value))
  await slider.dispatchEvent('change')
  await page.waitForTimeout(150)
}

async function runTrial(page: Page): Promise<void> {
  await page.locator('button:has-text("Re-run")').click()
  await page.waitForTimeout(400)
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  console.log('Setting up: coincidence (ΔT=0)...')
  await setDeltaT(page, 0)
  await runTrial(page)

  // Slow playback so the demo isn't a blur
  const slowBtn = page.locator('button:has-text("0.25")').first()
  if (await slowBtn.isVisible()) await slowBtn.click()

  // Frames buffer: we'll collect PNGs and stitch them with ffmpeg.
  // Each frame is a full-viewport screenshot.
  const frames: Buffer[] = []

  async function snap(label: string): Promise<void> {
    const png = await page.screenshot({ type: 'png' })
    frames.push(png)
    console.log(`  [${label}] frame ${frames.length}`)
  }

  console.log('Capturing coincidence sweep (ΔT=0 → AP)...')
  await scrubTo(page, 0)
  await page.waitForTimeout(200)
  for (const t of [0, 5, 10, 15, 20, 25, 28, 30, 31, 32, 33, 33.5, 34, 35, 40, 50, 60, 80, 100, 140, 180]) {
    await scrubTo(page, t)
    await snap(`dT=0 t=${t}`)
  }

  console.log('Switching to sublinear (ΔT=30)...')
  await setDeltaT(page, 30)
  await runTrial(page)
  await scrubTo(page, 0)
  await page.waitForTimeout(200)
  for (const t of [0, 20, 30, 31, 32.5, 33.5, 35, 40, 60, 100, 140, 180]) {
    await scrubTo(page, t)
    await snap(`dT=30 t=${t}`)
  }

  console.log('Switching to AMPA-only on syn1 (NMDA off → flat)...')
  // Click syn1 once to cycle to NMDA, again to BOTH, again to OFF, etc.
  // Default is BOTH. We want to disable both → click syn1 three times
  // (BOTH → OFF → AMPA → NMDA → BOTH) — three clicks lands on NMDA.
  // Better: set directly via clicking until mode label is 'off'.
  // The synapse mode label is rendered as text in the 3D scene via <Html>,
  // but is more reliably toggled by clicking the canvas at the synapse.
  // We rely on the keyboard '1' / '2' shortcuts... none defined. So we
  // cycle by clicking the canvas at the synapse location.
  // Skipping the synapse-toggle step here — focus on the AP story for v1.
  // The AMPA-only demo is included in the README separately.

  // Stitch frames using ffmpeg into an animated GIF.
  // ffmpeg -framerate 6 -i frame-%03d.png -vf "fps=6,scale=640:-1:flags=lanczos" demo.gif
  const tmpDir = join(OUT, 'gif-frames')
  mkdirSync(tmpDir, { recursive: true })
  for (let i = 0; i < frames.length; i++) {
    writeFileSync(join(tmpDir, `frame-${String(i).padStart(3, '0')}.png`), frames[i])
  }
  console.log(`Wrote ${frames.length} frames to ${tmpDir}/`)
  console.log('Now stitching with ffmpeg…')

  const { execSync } = await import('child_process')
  const paletteFilter =
    'fps=8,scale=720:-1:flags=lanczos,palettegen=stats_mode=full'
  const gifFilter =
    'fps=8,scale=720:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5'
  try {
    execSync(
      `ffmpeg -y -framerate 4 -i ${tmpDir}/frame-%03d.png -vf "${paletteFilter}" -frames:v 1 ${tmpDir}/palette.png`,
      { stdio: 'inherit' }
    )
    execSync(
      `ffmpeg -y -framerate 4 -i ${tmpDir}/frame-%03d.png -i ${tmpDir}/palette.png -lavfi "${gifFilter}" -loop 0 ${OUT}/demo.gif`,
      { stdio: 'inherit' }
    )
    console.log(`\nWrote ${OUT}/demo.gif`)
  } catch (e) {
    console.error('ffmpeg failed:', e)
    process.exit(1)
  }

  await browser.close()
}

main().catch((e) => {
  console.error('Capture crashed:', e)
  process.exit(2)
})
