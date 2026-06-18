/**
 * References panel: paper links + honesty section.
 */

export function References() {
  return (
    <div className="references">
      <h3>References</h3>
      <ul className="papers">
        <li>
          Polsky, Mel &amp; Schiller (2004).{' '}
          <em>Nature Neuroscience</em> 7:621.{' '}
          <a
            href="https://www.nature.com/articles/nn1229"
            target="_blank"
            rel="noreferrer"
          >
            Experimental coincidence detection in L2/3 basal dendrites.
          </a>
        </li>
        <li>
          Poirazi &amp; Mel (2001). <em>Neuron</em> 29:779.{' '}
          <a
            href="https://www.sciencedirect.com/science/article/pii/S0896627301004486"
            target="_blank"
            rel="noreferrer"
          >
            CA1 compartmental model; the "neuron as a 2-layer network."
          </a>
        </li>
        <li>
          Jahr &amp; Stevens (1990). <em>J Neurosci</em> 10(9):3178.{' '}
          <a
            href="https://www.jneurosci.org/content/10/9/3178"
            target="_blank"
            rel="noreferrer"
          >
            NMDA Mg²⁺ block.
          </a>
        </li>
        <li>
          Traub &amp; Miles (1991). <em>Neuronal Networks of the Hippocampus</em>{' '}
          (Cambridge UP). HH parameters for cortical pyramidal compartments.
        </li>
        <li>
          Dayan &amp; Abbott (2001). <em>Theoretical Neuroscience</em> Ch 5.{' '}
          HH gating and cable equation.
        </li>
        <li>
          Larkum, Zhu &amp; Sakmann (1999). <em>Nature</em> 398:338.{' '}
          <a
            href="https://www.nature.com/articles/18586"
            target="_blank"
            rel="noreferrer"
          >
            BAC firing (L5 apical tuft — out of scope here).
          </a>
        </li>
      </ul>

      <h3>What's simplified</h3>
      <ul className="honesty">
        <li>
          <strong>4 compartments</strong> — a real CA1 pyramid has ~10,000. We
          collapse the apical dendrite to two cylinders.
        </li>
        <li>
          <strong>No Ca²⁺ dynamics</strong> — the apical Ca²⁺ spike
          (Larkum/Zhu/Sakmann 1999) is out of scope. We model supralinear
          somatic EPSPs, not full BAC firing.
        </li>
        <li>
          <strong>No Ih, A-type K, M-type K</strong> — subtle modulators of
          dendritic integration.
        </li>
        <li>
          <strong>No STDP / plasticity.</strong>
        </li>
        <li>
          <strong>Both NMDA synapses on the apical trunk</strong> — Polsky 2004
          actually placed them on different basal dendrites. Trunk placement
          avoids the bAP attenuation question.
        </li>
        <li>
          <strong>g_axial tuned by hand</strong> rather than derived from
          morphology. Free parameter with biophysical justification.
        </li>
        <li>
          <strong>E_NMDA = 0 mV</strong> by convention; the experimental CA1
          value is ~+10 mV (Bekkers &amp; Stevens 1996). Difference is small
          at typical V.
        </li>
        <li>
          <strong>Polsky 2004 is L2/3 somatosensory</strong>, not CA1. Poirazi
          &amp; Mel 2001 is the CA1 modelling extension.
        </li>
      </ul>
    </div>
  )
}