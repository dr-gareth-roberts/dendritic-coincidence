# DESIGN.md — `dendritic/`

> A playable single-compartment / 4-lumped-compartment CA1 pyramidal
> neuron simulator in the browser. Built around the dendritic
> coincidence-detection story (Polsky/Mel/Schiller 2004 +
> Poirazi & Mel 2001).

## Context

This project is a third artefact in `/Users/k/Documents/random-projects/`,
alongside `last-radio-tower/` (creative/game) and `wa-mineral-prospectivity-mapper/`
(data/ML GIS). It fills a third niche — **a creative/visual artefact grounded
in computational neuroscience**.

The motivating observation: **single cortical pyramidal neurons are deep
networks in their own right** (Poirazi & Mel 2001, "the neuron as a 2-layer
network"). A single dendrite can do coincidence detection, pattern
completion, and nonlinear integration. There is no good public browser
playground for this. This artefact fills that gap.

The headline is **dendritic coincidence detection**: two NMDA-receptor-mediated
synaptic inputs on the same dendrite, fired close in time, produce a
**supralinear somatic response** that neither input alone can produce.
This is the canonical demonstration of the nonlinear integration
capability of single neurons.

## Biophysics (verified against primary literature)

The biophysics is not invented; it is **documented and verified** against
the primary literature. The key sources:

- **Traub & Miles 1991**, *Neuronal Networks of the Hippocampus* (Cambridge UP)
  — HH parameters for cortical pyramidal compartments.
- **Poirazi & Mel 2001**, *Neuron* 29:779 — CA1 compartmental model with active
  dendrites; "neuron as a 2-layer network."
- **Jahr & Stevens 1990**, *J Neurosci* 10(9):3178 — NMDA Mg²⁺ block equation.
- **Hestrin, Sah & Nicoll 1990**, *Neuron* 5:247 — double-exponential NMDA EPSC.
- **Polsky, Mel & Schiller 2004**, *Nature Neuroscience* 7:621 — experimental
  coincidence detection in L2/3 somatosensory basal dendrites.
- **Polsky, Mel & Schiller 2002**, *Nature Neuroscience* 5:825 — companion paper
  on L5 apical tuft.
- **Stuart & Spruston 1998**, *J Neurosci* 18:3501 — R_i in cortical pyramids.
- **Stuart, Spruston & Häusser 1997**, *Trends Neurosci* 20:125 — bAP attenuation.
- **Larkum, Zhu & Sakmann 1999**, *Nature* 398:338 — BAC firing (L5 apical tuft;
  referenced as out-of-scope).
- **Dayan & Abbott 2001**, *Theoretical Neuroscience* Ch 5 — HH gating and
  cable equation primer.
- **Bekkers & Stevens 1996**, *J Physiol* — E_NMDA ≈ +10 mV in CA1.

### Compartment geometry (4-lumped CA1 pyramid)

| Compartment | Length (µm) | Diameter (µm) | Render |
|---|---|---|---|
| Soma | 20 | 20 | Sphere |
| Apical trunk | 500 | 3 | Cylinder (vertical, above soma) |
| Apical tuft | 300 | 2 | Cylinder (top of trunk, branched silhouette) |
| Basal dendrite | 200 | 2 | Cylinder (below soma, branched silhouette) |

### Channel parameters (Traub-Miles family, per compartment)

```
C dV/dt = -g_Na m³h (V - E_Na) - g_K n⁴ (V - E_K) - g_L (V - E_L) + I_syn + I_axial
```

| Param | Soma | Apical trunk | Apical tuft | Basal | Unit |
|---|---|---|---|---|---|
| `g_Na` (max) | 40 | 8 | 6 | 8 | mS/cm² |
| `g_K` | 18 | 6 | 6 | 6 | mS/cm² |
| `g_L` | 0.2 | 0.2 | 0.2 | 0.2 | mS/cm² |
| `E_Na` | +55 | +55 | +55 | +55 | mV |
| `E_K` | −90 | −90 | −90 | −90 | mV |
| `E_L` | −65 | −65 | −65 | −65 | mV |
| `C_m` | 1.0 | 1.0 | 1.0 | 1.0 | µF/cm² |

**Verbatim Traub-Miles rate functions** (V in mV, rates in 1/ms):

```
α_m(V) = 0.32 (V+54) / (1 - exp(-(V+54)/4))
β_m(V)  = 0.28 (V+27) / (exp((V+27)/5) - 1)
α_h(V)  = 0.128 exp(-(V+50)/18)
β_h(V)  = 4 / (1 + exp(-(V+27)/5))
α_n(V)  = 0.032 (V+52) / (1 - exp(-(V+52)/5))
β_n(V)  = 0.5 exp(-(V+57)/40)
```

### AMPA synapse

```
g_AMPA(t) = w_AMPA · exp(-t_since_spike / τ_AMPA)     // τ_AMPA = 2 ms
I_AMPA    = g_AMPA(t) · (E_AMPA - V) · 1e-2            // E_AMPA = 0 mV, surface 1e-4 cm²
```

Default `w_AMPA = 4.5 nS` (tunable in UI).

### NMDA synapse

```
g_NMDA(t) = w_NMDA · [A₁·exp(-t/τ₁) + A₂·exp(-t/τ₂)]
            τ₁ = 50 ms, τ₂ = 250 ms, A₁/(A₁+A₂) = 0.4
B(V)      = 1 / (1 + ([Mg²⁺]/3.57) · exp(-0.062·V))    // [Mg²⁺] = 1 mM
I_NMDA    = g_NMDA(t) · B(V) · (E_NMDA - V) · 1e-2     // E_NMDA = 0 mV
```

Default `w_NMDA = 28 nS` (tunable in UI). The Mg²⁺ block is what makes NMDA
voltage-dependent: at V_rest ≈ -65 mV, B(V) ≈ 0.04 (96% blocked); at V ≈ -20 mV,
B(V) ≈ 0.5. This nonlinear relief of Mg²⁺ block is the molecular basis of
dendritic coincidence detection.

### Axial coupling (lumped cable)

```
C_i · dV_i/dt = -I_ion,i + Σ_j g_ij · (V_j - V_i) + I_syn,i
```

Treat `g_ij` as a tunable (rather than derived from morphology). Final
values, empirically tuned to balance two competing goals:

| Pair | g_ij (mS/cm²) | Rationale |
|---|---|---|
| soma ↔ apical trunk | 0.25 | Allows bAP → trunk at ~63% |
| apical trunk ↔ tuft | 0.20 | Allows bAP → tuft at ~14% |
| soma ↔ basal | 0.25 | Symmetric |

These were tuned to give **dendritic independence** (so single inputs
can locally depolarise the dendrite) **and** reasonable bAP propagation.
Trade-off documented in `day3-verify.ts`.

### Numerical integration

Forward Euler at **dt = 0.01 ms** for both V and gating. Stable for
Traub-Miles HH at this dt (margin is ~0.1 ms at the fastest gating
variable `m` near spike threshold, well inside the explicit-Euler
stability bound `dt < 2 τ_min`).

Stability guard: if any `|V_i| > 100 mV` during a trial, log a warning and
reset that compartment to V_rest.

## Implementation

### File layout

```
dendritic/
├── README.md
├── DESIGN.md (this file)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── styles.css
    ├── sim/
    │   ├── gating.ts
    │   ├── hh.ts
    │   ├── cable.ts
    │   ├── neuron.ts
    │   ├── synapse.ts
    │   ├── integrator.ts
    │   ├── presets.ts
    │   ├── day1-verify.ts
    │   ├── day2-verify.ts
    │   ├── day3-verify.ts
    │   └── day4-verify.ts
    ├── components/
    │   ├── geometry.ts
    │   ├── voltageColor.ts
    │   ├── Compartment.tsx
    │   ├── SynapseHandle.tsx
    │   ├── NeuronScene.tsx
    │   ├── VoltageTrace.tsx
    │   ├── SupralinearityPlot.tsx
    │   ├── Controls.tsx
    │   ├── PresetsPanel.tsx
    │   └── References.tsx
    └── state/
        └── store.ts
```

### Verification scripts

Each day of the build has a `dayN-verify.ts` script that runs a specific
biophysics check:

- **day1-verify.ts** — soma-only HH fires an AP (0.5 nA sustained step →
  peak ~+45 mV, repetitive firing at ~50 Hz).
- **day2-verify.ts** — 4-compartment, bAP propagates from soma to apical
  tuft at ~14% and to basal at ~68%.
- **day3-verify.ts** — AMPA produces a 0.35 mV somatic EPSP; NMDA at rest
  is 96% blocked (correct biophysics); AMPA+NMDA combined produce a full
  dendritic spike (V → 0 mV).
- **day4-verify.ts** — **the verification gate**: supralinearity sweep
  with default parameters produces a peak ratio of 1.52× at ΔT=0,
  falling to ~1.0 by ΔT=20ms and ~0.9 by ΔT=50ms. This is the
  Polsky/Mel/Schiller 2004 Figure 2 result.

Run with: `npx tsx src/sim/day4-verify.ts`

## Honest scope cuts

The following are deliberate simplifications. Each is documented in the
in-app References panel.

- **4 compartments, not 200.** Real CA1 pyramidal has ~10,000+
  compartments. Lumping collapses a 1 mm apical dendrite into two
  cylinders.
- **No Ca²⁺ dynamics.** Loses the Larkum/Zhu/Sakmann 1999 BAC firing
  story and the apical tuft Ca²⁺ spike. **Not in scope.** We model
  supralinear somatic EPSPs, not full BAC.
- **No Ih, A-type K, M-type K.** Subtle modulators of dendritic
  integration; out of scope.
- **No STDP / plasticity.** Out of scope.
- **No multi-neuron networks.** Single neuron is the unit of analysis.
- **Both NMDA synapses on apical trunk** — the design choice that
  simplifies the geometry. A more honest implementation would place
  them on different branches (e.g., Polsky 2004 places on different
  basal dendrites), but the supralinearity mechanism is the same and
  the trunk placement avoids the bAP-attenuation question.
- **`g_axial` tuned by hand** rather than derived from morphological
  measurements. Free parameter with biophysical justification.
- **`E_NMDA = 0 mV` by convention**, not the experimental CA1 value of
  ~+10 mV (Bekkers & Stevens 1996). Difference is small at typical V.
- **Polsky 2004 is on L2/3 somatosensory pyramidal basal dendrites,
  not CA1.** Poirazi & Mel 2001 is the CA1 modelling extension. Both
  are referenced; the framing in the UI must be precise.
- **BAC firing is a separate phenomenon** (Larkum/Zhu/Sakmann 1999,
  L5 apical tuft). We do not show BAC firing in v1.

## Tuning notes (for future maintainers)

- **g_axial is sensitive.** Day 2 verification initially used
  g_ij = 0.6 mS/cm² which made bAP work but voltage-clamped the
  dendrites. Lower values (0.25, 0.20, 0.25) preserve some dendritic
  independence at the cost of bAP → tuft dropping to 14%.
- **Synapse weights are sensitive.** wAMPA=5, wNMDA=30 gives a
  *regime change* (soma fires AP at coincidence, ratio ~30×).
  wAMPA=4.5, wNMDA=28 gives the canonical 1.5× ratio. Lower weights
  flatten the ratio to ~1.0 (NMDA not unblocking enough). The 1.5×
  target sits in a narrow ~5% window of wNMDA.
- **Mg²⁺ block is the headline physics.** At rest, NMDA is 96% blocked
  by Mg²⁺ — this is correct biophysics, not a model defect. Single
  NMDA inputs barely budge the dendrite at rest. The story is the
  nonlinearity of Mg²⁺ unblock under coincident input.

## Verification (end-to-end, manual)

1. `npm install && npm run dev` → opens `http://localhost:5173`.
2. R3F canvas renders the 4-compartment neuron, resting blue colour.
3. Select `coincidence` preset.
4. Press "Run trial" at ΔT = 5 ms → see dendritic depolarisation +
   somatic EPSP.
5. Press "Run trial" at ΔT = 30 ms → see weaker somatic EPSP.
6. Press "Sweep ΔT" → wait ~10 seconds → supralinearity plot shows
   peak at ΔT ≈ 0–5 ms, falls to 1.0 by ΔT ≈ 20 ms. **This is the
   verification gate.**
7. Click a synapse handle to set it to `ampa` only → rerun sweep →
   curve flattens to ~1.0× (proves NMDA is doing the coincidence
   detection, not AMPA summation). **This is the pedagogical "aha"
   moment.**
8. `npm run build && npm run preview` → opens `dist/`. Verify build
   artefact.

## References

- Polsky, Mel & Schiller 2004, *Nature Neuroscience* 7:621 — experimental
  coincidence detection in L2/3 basal dendrites.
- Polsky, Mel & Schiller 2002, *Nature Neuroscience* 5:825 — companion
  paper on L5 apical tuft integration.
- Poirazi & Mel 2001, *Neuron* 29:779 — CA1 compartmental model with
  active dendrites; "neuron as a 2-layer network."
- Jahr & Stevens 1990, *J Neurosci* 10(9):3178 — NMDA Mg²⁺ block equation.
- Hestrin, Sah & Nicoll 1990, *Neuron* 5:247 — double-exponential NMDA
  EPSC.
- Traub & Miles 1991, *Neuronal Networks of the Hippocampus* (Cambridge UP)
  — HH parameters for cortical pyramidal compartments.
- Stuart & Spruston 1998, *J Neurosci* 18:3501 — R_i in cortical pyramids.
- Stuart, Spruston & Häusser 1997, *Trends Neurosci* 20:125 — bAP
  attenuation.
- Larkum, Zhu & Sakmann 1999, *Nature* 398:338 — BAC firing (out of scope).
- Bekkers & Stevens 1996, *J Physiol* — E_NMDA ≈ +10 mV in CA1.
- Dayan & Abbott 2001, *Theoretical Neuroscience* Ch 5 — HH gating and
  cable equation primer.
- Koch 1999, *Biophysics of Computation* (Oxford UP) — compartmental
  modelling reference.
- Hines 1984, *Int J Biomed Comput* 15:69 — NEURON numerical integration
  foundations.

## License

MIT. Code original. Papers cited for parameter choices and experimental
constraints; no reproduction of copyrighted text.
