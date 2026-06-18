# dendritic

> A playable CA1 pyramidal neuron in your browser, built around the
> Polsky/Mel/Schiller 2004 + Poirazi & Mel 2001 story: a single dendrite
> can act as a coincidence detector.

Press **Run trial** to fire two AMPA+NMDA synapses on the apical trunk
with a chosen relative timing (ΔT), or **Sweep ΔT** to plot the
supralinearity ratio from −50 ms to +50 ms.

![Demo: coincidence sweep then sublinear sweep](.verify/demo.gif)

The demo shows: at ΔT = 0 ms both synapses fire simultaneously, the
apical trunk enters an NMDA plateau (V ≈ −55 mV, visibly brighter —
bloom carries the voltage), and the soma emits a supralinear EPSP.
The summed response is **~29× the linear sum of either input alone**.
At ΔT = 30 ms the same two inputs sum sublinearly — small EPSPs, no
plateau, no somatic response. The voltage is voltage-coloured onto
the 3D neuron: resting deep blue, depolarised warm yellow, with
the bloom around the neuron physically driven by membrane
depolarisation.

## What this is

- A **4-compartment lumped model** of a CA1 pyramidal neuron (soma,
  apical trunk, apical tuft, basal dendrite).
- Each compartment runs **Traub-Miles Hodgkin-Huxley** gating (Na, K, leak).
- **AMPA** (τ = 2 ms) and **NMDA** (double-exponential, Jahr-Stevens
  Mg²⁺ block) synapses on the dendrites.
- Axial coupling between adjacent compartments as a tunable lumped cable.
- Forward-Euler integration at **dt = 0.01 ms**.
- Real-time playback of any trial: scrub the playhead, slow it down,
  watch the propagation wave travel from synapse → trunk → soma.

The headline result: with default parameters, two synaptic inputs
fired **simultaneously** (ΔT ≈ 0) produce a **supralinear somatic EPSP**
that drives the soma to fire an action potential (peak ratio ~29×
versus the linear sum of either input alone), while inputs fired
**30 ms apart** produce only a sublinear summed response (ratio ~0.6×).
This is the dendritic coincidence-detection mechanism first
characterised experimentally in Polsky, Mel & Schiller 2004 and
modelled in Poirazi & Mel 2001.

## Screenshots

**Static (resting):** the neuron at rest, all compartments at −65 mV,
dim navy. The two glowing orbs on the apical trunk are the synapse
handles — click them to toggle AMPA / NMDA / both.

![Static — neuron at rest](.verify/pass1-static.png)

**NMDA-peak window (coincidence):** 2.5 ms after a paired-pulse
coincidence fires, the apical trunk enters an NMDA plateau
(V ≈ −55 mV, visibly bright yellow). The bloom around the trunk
is driven by the membrane depolarisation, not by an effect.
This is the dendritic coincidence detector at work.

![NMDA plateau on apical trunk during coincidence](.verify/pass3-peak-ap.png)

**Supralinearity sweep (the headline plot):** peak ratio ~29× at
ΔT = 0, falling to ~0.6× at |ΔT| = 30 ms. This is the
qualitative shape of Polsky/Mel/Schiller 2004 Figure 2.

![Supralinearity sweep](.verify/pass4-sweep.png)

**Post-plateau (return to rest):** the NMDA plateau decays, the
soma returns to rest while the dendrites still carry the slow
NMDA tail.

![Post-plateau, returning to rest](.verify/pass3-post-ap.png)

## Run it

```bash
npm install
npm run dev
```

Opens at `http://localhost:5273`. Try:

1. Press **Sweep ΔT** to see the canonical supralinearity curve
   (peak at small |ΔT|, falling to ~1.0 by |ΔT| ≈ 20 ms).
2. Click one of the **Presets** to load a named configuration.
3. Click a glowing sphere on the apical trunk to toggle the synapse
   mode (off → AMPA → NMDA → both).
4. Move the **ΔT** slider and press **Run trial** to inspect single
   trials. The voltage-trace panel is also clickable — drag the
   cursor to scrub.
5. Open the **Parameters** panel (leva) to poke individual HH
   conductances, axial couplings, and synapse kinetics. Changes
   apply on the next **Re-run**.

To build for static hosting:

```bash
npm run build
```

Output goes to `dist/`.

## Verification

The project ships with a four-pass visual verifier
(`.verify/verify.ts`) and a demo-GIF capture script
(`.verify/capture-gif.ts`). Both run headless against the dev server.

```bash
# In one terminal:
npm run dev

# In another:
npx tsx .verify/verify.ts        # writes pass1/2/3/4 PNGs + report.txt
npx tsx .verify/capture-gif.ts   # writes demo.gif
```

The verifier asserts, for the default `coincidence` preset:

- **Pass 1 (static):** canvas renders with non-trivial content, header
  and playback controls are present, no console errors.
- **Pass 2 (dynamic):** the playhead actually advances when the user
  presses Play (sampled at three consecutive moments), the scrubber
  reaches the NMDA-peak window at t ≈ 32.5 ms, the trunk is
  measurably depolarised, and the soma shows a somatic response at
  t = 60 ms.
- **Pass 3 (aesthetic):** the central-ROI (where the neuron lives)
  pixel brightness is ≥ 5% higher at the NMDA peak than at rest.
  This proves the bloom is physically driven by membrane voltage, not
  by ambient light.
- **Pass 4 (curve shape):** the automated sweep runs and must satisfy
  the Polsky/Mel/Schiller 2004 Figure 2 qualitative shape — peak
  supralinearity ratio ≥ 1.2× at |ΔT| < 10 ms, ratio ≤ 1.1× at
  |ΔT| ≥ 30 ms, and the ratio at |ΔT| ≥ 40 ms strictly below peak.
  With the current defaults the peak is 29× at ΔT = 0 (the soma AP
  fires) and the mean at |ΔT| ≥ 30 ms is 0.6× (sublinear regime).

The full report is written to `.verify/report.txt`.

## What is in scope

- Dendritic coincidence detection (NMDA-spike-mediated supralinearity).
- AMPA-only controls (to show NMDA is doing the work).
- The 5 named presets and the supralinearity sweep.
- Per-compartment HH parameters, axial conductances, and synapse
  kinetics exposed via a leva Parameters panel — edit and re-run
  to see how the curve shifts.
- Click-to-toggle synapse modes on the 3D scene.
- 30-second demo GIF for sharing.

## What is out of scope (deliberate cuts)

See `DESIGN.md` for the full honesty section. The biggest:

- **No Ca²⁺ dynamics** — so no BAC firing (Larkum/Zhu/Sakmann 1999).
- **No Ih, A-type K, M-type K** — subtle modulators of dendritic integration.
- **No STDP / plasticity**.
- **Both NMDA synapses on the apical trunk** — Polsky 2004 actually used
  different basal dendrites. Trunk placement avoids the bAP-attenuation
  question.
- **4 compartments, not 200** — a real CA1 pyramid has ~10,000.
- **Polsky 2004 is on L2/3 somatosensory pyramidal basal dendrites,
  not CA1.** Poirazi & Mel 2001 is the CA1 modelling extension. Both
  are referenced; the framing here is precise.

## Project structure

```
src/
├── sim/                 # biophysics
│   ├── gating.ts        # α/β Traub-Miles rate functions
│   ├── hh.ts            # HH step, channel parameter sets
│   ├── cable.ts         # axial coupling
│   ├── neuron.ts        # 4-compartment orchestrator
│   ├── synapse.ts       # AMPA + NMDA, Mg²⁺ block
│   ├── integrator.ts    # dt + blowup guard
│   └── presets.ts       # 5 named configurations
├── components/          # UI
│   ├── NeuronScene.tsx  # R3F 3D scene
│   ├── Compartment.tsx  # voltage-coloured mesh
│   ├── SynapseHandle.tsx
│   ├── VoltageTrace.tsx # Canvas2D traces
│   ├── SupralinearityPlot.tsx
│   ├── PlaybackControls.tsx
│   ├── PresetsPanel.tsx
│   ├── ParametersPanel.tsx  # leva: HH, axial, kinetics
│   └── References.tsx   # papers + honesty
├── state/store.ts       # zustand
├── App.tsx
└── main.tsx
```

## References

- Polsky, Mel & Schiller 2004, *Nature Neuroscience* 7:621 — experimental
  coincidence detection in L2/3 basal dendrites.
- Poirazi & Mel 2001, *Neuron* 29:779 — CA1 compartmental model; the
  "neuron as a 2-layer network."
- Jahr & Stevens 1990, *J Neurosci* 10(9):3178 — NMDA Mg²⁺ block.
- Traub & Miles 1991, *Neuronal Networks of the Hippocampus* (Cambridge UP)
  — HH parameters for cortical pyramidal compartments.
- Dayan & Abbott 2001, *Theoretical Neuroscience* Ch 5 — HH gating and
  cable equation.
- Larkum, Zhu & Sakmann 1999, *Nature* 398:338 — BAC firing (out of scope).

## License

MIT. Code original. Papers cited for parameter choices and experimental
constraints; no reproduction of copyrighted text.