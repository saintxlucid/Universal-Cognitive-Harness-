import { type LawID, lawID } from '../../shared/branded-types.js';

export interface GenomeLaw {
  readonly id: LawID;
  readonly name: string;
  readonly statement: string;
  readonly rationale: string;
  readonly enforcement: 'static-analysis' | 'runtime-audit' | 'economic-audit' | 'information-audit' | 'constitutional-review';
}

export interface ImmutableCommitment {
  readonly id: `commitment:${number}`;
  readonly statement: string;
}

export interface SpeciesGenomeConfig {
  readonly speciesName: string;
  readonly speciesVersion: string;
}

const LAWS: GenomeLaw[] = [
  { id: lawID('law:1'), name: 'Signal Universality', statement: 'Every observable interaction between any two components is represented as an immutable signal.', rationale: 'Immutability enables replay, audit, causal reconstruction.', enforcement: 'static-analysis' },
  { id: lawID('law:2'), name: 'Conservation of Energy', statement: 'No computation is free. Every operation consumes measurable resources.', rationale: 'Prevents resource exhaustion.', enforcement: 'runtime-audit' },
  { id: lawID('law:3'), name: 'Causality', statement: 'Every observable state change must be causally attributable to one or more prior signals.', rationale: 'Without causality, debugging becomes archaeology.', enforcement: 'runtime-audit' },
  { id: lawID('law:4'), name: 'Evidence Over Assertion', statement: 'No component owns truth. Only evidence exists.', rationale: 'Prevents hallucination propagation.', enforcement: 'runtime-audit' },
  { id: lawID('law:5'), name: 'Universal Decay', statement: 'Everything decays. Every entity carries a birth timestamp, half-life, and decay function.', rationale: 'Without decay, stale truth accumulates silently.', enforcement: 'constitutional-review' },
  { id: lawID('law:6'), name: 'Experiential Residue', statement: 'Every completed computation leaves residue.', rationale: 'Without residue, the organism never learns.', enforcement: 'constitutional-review' },
  { id: lawID('law:7'), name: 'Triadic Validation', statement: 'No action executes with fewer than three independent perspectives.', rationale: 'Prevents single-component catastrophic decisions.', enforcement: 'runtime-audit' },
  { id: lawID('law:8'), name: 'Recursive Organization', statement: 'Everything is composed of smaller things that obey the same laws.', rationale: 'Prevents architectural special-casing.', enforcement: 'static-analysis' },
  { id: lawID('law:9'), name: 'Developmental Lifecycle', statement: 'Every component passes through defined lifecycle stages.', rationale: 'Enables evolution without rewrites.', enforcement: 'constitutional-review' },
  { id: lawID('law:10'), name: 'Identity Persistence', statement: "The organism's identity outlives every component.", rationale: 'Every restart is not a reincarnation.', enforcement: 'constitutional-review' },
  { id: lawID('law:11'), name: 'Local Knowledge', statement: 'No component requires global knowledge to function.', rationale: 'The most important scalability law.', enforcement: 'static-analysis' },
  { id: lawID('law:12'), name: 'Reversibility', statement: 'Every significant state transition must be reconstructible.', rationale: 'Enables debugging, audit, simulation.', enforcement: 'constitutional-review' },
  { id: lawID('law:13'), name: 'Minimal Consciousness', statement: 'Only information requiring executive reasoning may reach the executive layers.', rationale: 'The biggest latency and cost optimization.', enforcement: 'constitutional-review' },
  { id: lawID('law:14'), name: 'Economic Rationality', statement: 'Every operation must justify its energy cost through expected information gain.', rationale: 'Without economics, energy is wasted on low-value computation.', enforcement: 'economic-audit' },
  { id: lawID('law:15'), name: 'Information Conservation', statement: 'A signal with zero information gain must be absorbed at the lowest capable nervous layer.', rationale: 'Without information conservation, the cortex drowns in noise.', enforcement: 'information-audit' },
  { id: lawID('law:16'), name: 'Interrupt Hierarchy', statement: 'A higher-priority signal may preempt any lower-priority execution.', rationale: 'Without interrupts, emergencies queue behind routine processing.', enforcement: 'runtime-audit' },
];

const COMMITMENTS: ImmutableCommitment[] = [
  { id: 'commitment:1', statement: 'Never lose a memory' },
  { id: 'commitment:2', statement: 'Never hide a decision' },
  { id: 'commitment:3', statement: 'Never bypass governance' },
  { id: 'commitment:4', statement: 'Never forget identity' },
  { id: 'commitment:5', statement: 'Never stop learning' },
  { id: 'commitment:6', statement: 'Never violate physics' },
  { id: 'commitment:7', statement: 'Never trust one source' },
  { id: 'commitment:8', statement: 'Never starve a component' },
  { id: 'commitment:9', statement: 'Never silence without cause' },
  { id: 'commitment:10', statement: 'Never rewrite alone' },
];

export class SpeciesGenome {
  private readonly config: SpeciesGenomeConfig;

  constructor(config?: Partial<SpeciesGenomeConfig>) {
    this.config = {
      speciesName: config?.speciesName ?? 'Artificial Cognitive Exoskeleton (ACE)',
      speciesVersion: config?.speciesVersion ?? '1.0.0',
    };
  }

  getConfig(): SpeciesGenomeConfig { return { ...this.config }; }
  getLaws(): GenomeLaw[] { return [...LAWS]; }
  getLaw(id: LawID): GenomeLaw | undefined { return LAWS.find(l => l.id === id); }
  getCommitments(): ImmutableCommitment[] { return [...COMMITMENTS]; }

  getEnforcementProfile(): Record<string, string[]> {
    const profile: Record<string, string[]> = {};
    for (const law of LAWS) {
      const key = law.enforcement;
      if (!profile[key]) profile[key] = [];
      profile[key].push(law.id);
    }
    return profile;
  }

  getStats() {
    return { speciesName: this.config.speciesName, version: this.config.speciesVersion, lawCount: LAWS.length, commitmentCount: COMMITMENTS.length };
  }
}
