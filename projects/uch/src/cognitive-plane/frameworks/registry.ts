/**
 * Framework Registry — the canonical catalog of every codified framework
 * in the Cognitive Frameworks Library, plus the model-selection layer
 * ("decision-about-decisions") that matches a problem to the right model.
 *
 * Selection heuristics (from the corpus):
 * - data-rich & analytical      → rational / decision matrix / cost-benefit / pareto
 * - time-critical               → intuitive / PMI / lean
 * - strategic                   → swot / strategy-wheel / strategy-vs-plan
 * - uncertainty & risk          → decision-tree / pre-mortem
 * - group consensus             → delphi / nominal-group / stepladder / multi-voting
 * - root-cause diagnosis        → five-whys / fishbone / rca
 * - human-centered innovation   → design-thinking
 * - continuous improvement      → pdca
 * - fast-changing environments  → ooda
 * - high-stakes multi-factor    → kepner-tregoe
 */

import type {
  FrameworkDefinition,
  FrameworkFamily,
  FrameworkSelectionInput,
  FrameworkSelectionResult,
} from './types.js';
import type { FrameworkTraceRecorder } from './tracing/trace-recorder.js';

const FAMILY_LABELS: Record<FrameworkFamily, string> = {
  decisions: 'Decision Making',
  problems: 'Problem Solving',
  rca: 'Root Cause Analysis',
  strategy: 'Strategy',
  productivity: 'Productivity',
  research: 'Research',
  critical: 'Critical Thinking',
  knowledge: 'Knowledge (DIKW)',
  signals: 'Signal Fusion',
  code: 'Code Principles',
};

/**
 * Catalog version — bumped whenever the built-in catalog changes
 * (new framework, renamed family, revised selection metadata).
 * Returned by `framework-catalog` and asserted by the integrity tests.
 */
export const FRAMEWORK_CATALOG_VERSION = '1.1.0';

export class FrameworkRegistry {
  private frameworks = new Map<string, FrameworkDefinition>();
  private tracer: FrameworkTraceRecorder | null;

  constructor(tracer?: FrameworkTraceRecorder | null) {
    this.tracer = tracer ?? null;
  }

  attachTracer(tracer: FrameworkTraceRecorder): void {
    this.tracer = tracer;
  }

  register(def: FrameworkDefinition): void {
    this.frameworks.set(def.id, def);
  }

  registerAll(defs: FrameworkDefinition[]): void {
    for (const def of defs) this.register(def);
  }

  get(id: string): FrameworkDefinition | null {
    return this.frameworks.get(id) ?? null;
  }

  list(family?: FrameworkFamily): FrameworkDefinition[] {
    const all = [...this.frameworks.values()];
    return family ? all.filter((f) => f.family === family) : all;
  }

  families(): { family: FrameworkFamily; label: string; count: number }[] {
    const counts = new Map<FrameworkFamily, number>();
    for (const f of this.frameworks.values()) {
      counts.set(f.family, (counts.get(f.family) ?? 0) + 1);
    }
    return (Object.keys(FAMILY_LABELS) as FrameworkFamily[])
      .map((family) => ({ family, label: FAMILY_LABELS[family], count: counts.get(family) ?? 0 }))
      .filter((f) => f.count > 0);
  }

  /**
   * The model-selection layer: scores every framework against the problem
   * profile and returns the best match plus a rationale.
   */
  select(input: FrameworkSelectionInput): FrameworkSelectionResult {
    const start = Date.now();
    const family = input.family;
    const candidates = this.list(family);
    if (candidates.length === 0) {
      throw new Error(`No frameworks registered${family ? ` for family '${family}'` : ''}`);
    }

    const scored = candidates.map((f) => {
      const score = this.scoreFit(f, input);
      return { f, score };
    });
    scored.sort((a, b) => b.score - a.score);

    const top = scored[0];
    if (!top) {
      throw new Error(`No frameworks registered${family ? ` for family '${family}'` : ''}`);
    }
    const selected = top.f;
    const runnerUp = scored[1]?.f ?? null;
    const rationale = this.buildRationale(selected, input, top.score);

    const result: FrameworkSelectionResult = {
      selected,
      family: selected.family,
      runnerUp,
      rationale,
      alternatives: scored.slice(0, 3).map((s) => s.f.id),
    };

    this.tracer?.recordSelection({
      problem: input.problem,
      profile: input,
      result,
      durationMs: Date.now() - start,
    });

    return result;
  }

  /** Deterministic fit scoring — pure function of input + selection metadata. */
  scoreFit(def: FrameworkDefinition, input: FrameworkSelectionInput): number {
    let score = 1;
    const s = def.selection;

    if (input.dataAvailability !== undefined) {
      if (s.dataRich && input.dataAvailability >= 0.6) score += 3;
      if (s.dataRich && input.dataAvailability < 0.3) score -= 2;
      if (s.contexts.includes('experience-based') && input.dataAvailability < 0.4) score += 2;
    }
    if (input.timePressure !== undefined) {
      if (s.timeCritical && input.timePressure >= 0.7) score += 3;
      if (!s.timeCritical && input.timePressure >= 0.8) score -= 1;
      if (s.timeCritical && input.timePressure < 0.3) score -= 1;
    }
    if (input.stakeholderInvolvement !== undefined) {
      if (s.groupNeeded && input.stakeholderInvolvement >= 0.6) score += 3;
      if (s.groupNeeded && input.stakeholderInvolvement < 0.3) score -= 2;
    }
    if (input.risk !== undefined) {
      if (s.contexts.includes('uncertainty') && input.risk >= 0.6) score += 3;
      if (s.comprehensiveRigor && input.risk >= 0.6) score += 2;
    }
    if (input.complexity !== undefined) {
      if (s.comprehensiveRigor && input.complexity >= 0.7) score += 2;
      if (s.speedAdaptability && input.complexity >= 0.8) score -= 1;
    }
    if (input.clarity !== undefined) {
      if (s.rootCauseNeeded && input.clarity < 0.4) score += 2;
      if (s.contexts.includes('analytical') && input.clarity >= 0.6) score += 1;
    }

    // Explicit signal mapping from the corpus's quick guide.
    if (input.rootCauseNeeded !== undefined) {
      if (s.rootCauseNeeded && input.rootCauseNeeded) score += 4;
      if (!s.rootCauseNeeded && input.rootCauseNeeded) score -= 1;
    }
    if (input.humanCentered !== undefined) {
      if (s.humanCentered && input.humanCentered) score += 4;
      if (!s.humanCentered && input.humanCentered) score -= 1;
    }
    if (input.continuousImprovement !== undefined) {
      if (s.continuousImprovement && input.continuousImprovement) score += 4;
      if (!s.continuousImprovement && input.continuousImprovement) score -= 1;
    }
    if (input.speedAdaptability !== undefined) {
      if (s.speedAdaptability && input.speedAdaptability) score += 4;
      if (!s.speedAdaptability && input.speedAdaptability) score -= 1;
    }

    return score;
  }

  private buildRationale(def: FrameworkDefinition, input: FrameworkSelectionInput, score: number): string {
    const s = def.selection;
    const bits: string[] = [];
    if (s.contexts.includes('analytical') && (input.dataAvailability ?? 0) >= 0.6) bits.push('data-rich problem — analytical model fits');
    if (s.contexts.includes('uncertainty') && (input.risk ?? 0) >= 0.6) bits.push('high risk/uncertainty');
    if (s.groupNeeded && (input.stakeholderInvolvement ?? 0) >= 0.6) bits.push('group decision context');
    if (s.timeCritical && (input.timePressure ?? 0) >= 0.7) bits.push('time-critical');
    if (s.rootCauseNeeded) bits.push('root-cause diagnosis required');
    if (s.humanCentered) bits.push('human-centered innovation');
    if (s.continuousImprovement) bits.push('continuous improvement');
    if (s.speedAdaptability) bits.push('fast-changing environment');
    if (s.comprehensiveRigor && (input.complexity ?? 0) >= 0.7) bits.push('high complexity requires rigor');
    return `'${def.name}' fits because ${bits.length > 0 ? bits.join('; ') : 'it matches the problem profile'}. Fit score ${score}.`;
  }
}

/** The built-in catalog — all 10 families, 30+ frameworks. */
export function createFrameworkCatalog(): FrameworkDefinition[] {
  return [
    /* ── decisions ─────────────────────────────────────────────── */
    {
      id: 'rational', family: 'decisions', name: 'Rational Decision Model',
      purpose: 'Find the objectively best choice when data is abundant and logic dominates.',
      bestFor: ['Data-rich decisions', 'Sufficient time', 'Alternatives that can be evaluated objectively'],
      whenNotToUse: ['Time-critical decisions', 'Incomplete information', 'Strong intuition available'],
      stages: [
        { name: 'Define', description: 'Define the decision problem precisely' },
        { name: 'Gather', description: 'Collect all relevant information' },
        { name: 'Generate', description: 'Generate alternatives' },
        { name: 'Evaluate', description: 'Evaluate alternatives against criteria' },
        { name: 'Select', description: 'Select the best alternative' },
        { name: 'Review', description: 'Review the decision and its outcomes' },
      ],
      selection: { contexts: ['analytical'], dataRich: true },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'intuitive', family: 'decisions', name: 'Intuitive Decision Model',
      purpose: 'Rely on expertise, pattern recognition, and tacit knowledge when time is short.',
      bestFor: ['Short deadlines', 'Incomplete information', 'Experienced decision-makers'],
      whenNotToUse: ['Novices', 'High-stakes reversible-averse contexts', 'Conflicting signals'],
      stages: [
        { name: 'Assess', description: 'Recognize the situation pattern from experience' },
        { name: 'Match', description: 'Match against known cases' },
        { name: 'Act', description: 'Act on the pattern match' },
        { name: 'Verify', description: 'Verify the outcome and refine the pattern' },
      ],
      selection: { contexts: ['experience-based'], timeCritical: true },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'decision-matrix', family: 'decisions', name: 'Decision Matrix',
      purpose: 'Score options against weighted criteria to compare alternatives objectively.',
      bestFor: ['Many alternatives', 'Multiple evaluation criteria', 'Objective comparison'],
      whenNotToUse: ['Single criterion decisions', 'Very subjective criteria'],
      stages: [
        { name: 'List options', description: 'List all candidate alternatives' },
        { name: 'Define criteria', description: 'Define evaluation criteria' },
        { name: 'Weight', description: 'Assign weights to criteria' },
        { name: 'Score', description: 'Score each option per criterion' },
        { name: 'Compute', description: 'Compute weighted totals and rank' },
      ],
      selection: { contexts: ['analytical'], dataRich: true },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'cost-benefit', family: 'decisions', name: 'Cost-Benefit Analysis',
      purpose: 'Compare expected costs against expected benefits under resource constraints.',
      bestFor: ['Financial decisions', 'Resource allocation', 'Constrained budgets'],
      whenNotToUse: ['Hard-to-quantify value', 'Non-monetary trade-offs dominate'],
      stages: [
        { name: 'Identify costs', description: 'Enumerate all costs' },
        { name: 'Identify benefits', description: 'Enumerate all benefits' },
        { name: 'Quantify', description: 'Quantify both sides' },
        { name: 'Compare', description: 'Compute net value and ratio' },
      ],
      selection: { contexts: ['analytical'], dataRich: true },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'pareto', family: 'decisions', name: 'Pareto Analysis (80/20)',
      purpose: 'Focus on the few causes with the greatest impact.',
      bestFor: ['Prioritization', 'Optimization', 'Limited resources'],
      whenNotToUse: ['When causes are equal-impact', 'When the vital few are unknown'],
      stages: [
        { name: 'List causes', description: 'List all causes/items' },
        { name: 'Measure impact', description: 'Measure each item\'s impact' },
        { name: 'Sort', description: 'Sort descending by impact' },
        { name: 'Cumulate', description: 'Compute cumulative share' },
        { name: 'Focus', description: 'Focus on the vital few' },
      ],
      selection: { contexts: ['analytical'], dataRich: true },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'swot', family: 'decisions', name: 'SWOT Analysis',
      purpose: 'Evaluate internal strengths/weaknesses and external opportunities/threats.',
      bestFor: ['Strategic planning', 'Environmental evaluation', 'Positioning'],
      whenNotToUse: ['Fast operational decisions', 'Well-scoped single-option choices'],
      stages: [
        { name: 'Strengths', description: 'Internal strengths' },
        { name: 'Weaknesses', description: 'Internal weaknesses' },
        { name: 'Opportunities', description: 'External opportunities' },
        { name: 'Threats', description: 'External threats' },
        { name: 'Synthesize', description: 'Cross products: S-O, W-O, S-T, W-T' },
      ],
      selection: { contexts: ['strategic'] },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'decision-tree', family: 'decisions', name: 'Decision Tree',
      purpose: 'Map uncertainty into possible futures with probabilities and branching decisions.',
      bestFor: ['Sequential decisions', 'Probability-based evaluation', 'Risk evaluation'],
      whenNotToUse: ['Very shallow decisions', 'When probabilities are meaningless'],
      stages: [
        { name: 'Branch', description: 'Identify decision branches' },
        { name: 'Probability', description: 'Assign outcome probabilities' },
        { name: 'Value', description: 'Assign outcome values' },
        { name: 'Rollback', description: 'Compute expected values bottom-up' },
      ],
      selection: { contexts: ['uncertainty'] },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'pre-mortem', family: 'decisions', name: 'Pre-Mortem Analysis',
      purpose: 'Assume the plan failed; work backward to identify avoidable failure causes.',
      bestFor: ['High-stakes plans', 'Prevention of avoidable mistakes', 'Risk mitigation'],
      whenNotToUse: ['Trivial decisions', 'When failure modes are already known'],
      stages: [
        { name: 'Assume failure', description: 'Assume the project failed 6-12 months out' },
        { name: 'Brainstorm causes', description: 'List every plausible failure cause' },
        { name: 'Rank', description: 'Rank by likelihood and impact' },
        { name: 'Mitigate', description: 'Design mitigations for the top causes' },
      ],
      selection: { contexts: ['uncertainty'] },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'delphi', family: 'decisions', name: 'Delphi Method',
      purpose: 'Collect anonymous expert opinions iteratively to build consensus without social pressure.',
      bestFor: ['Complex decisions requiring expertise', 'Anonymous consensus', 'Geographically spread experts'],
      whenNotToUse: ['Fast decisions', 'Small groups that meet easily'],
      stages: [
        { name: 'Round 1', description: 'Experts answer anonymously' },
        { name: 'Aggregate', description: 'Summarize responses' },
        { name: 'Round 2', description: 'Experts revise given the summary' },
        { name: 'Converge', description: 'Repeat until convergence or max rounds' },
      ],
      selection: { contexts: ['group'] },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'nominal-group', family: 'decisions', name: 'Nominal Group Technique',
      purpose: 'Individual idea generation followed by structured ranking to balance participation.',
      bestFor: ['Balanced group decision-making', 'Avoiding dominant voices'],
      whenNotToUse: ['Very small quick decisions', 'Groups already in strong consensus'],
      stages: [
        { name: 'Generate', description: 'Each member writes ideas silently' },
        { name: 'Share', description: 'Round-robin share without debate' },
        { name: 'Discuss', description: 'Clarify and discuss' },
        { name: 'Rank', description: 'Individual ranking, aggregated' },
      ],
      selection: { contexts: ['group'], groupNeeded: true },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'stepladder', family: 'decisions', name: 'Stepladder Technique',
      purpose: 'Add group members one at a time to prevent groupthink.',
      bestFor: ['Team decisions', 'Preventing groupthink'],
      whenNotToUse: ['Individual decisions', 'Time-critical teams'],
      stages: [
        { name: 'Entry', description: 'First member forms initial view' },
        { name: 'Add', description: 'Add one member at a time; each presents before hearing others' },
        { name: 'Discuss', description: 'Discuss and refine after each entry' },
        { name: 'Final', description: 'Final group discussion and decision' },
      ],
      selection: { contexts: ['group'], groupNeeded: true },
      source: 'Decision-making catalog (12 models)',
    },
    {
      id: 'multi-voting', family: 'decisions', name: 'Multi-Voting',
      purpose: 'Reduce many options through repeated voting rounds.',
      bestFor: ['Prioritizing within groups', 'Large option sets'],
      whenNotToUse: ['When ranking granularity matters', 'Single-decider situations'],
      stages: [
        { name: 'List', description: 'List all options' },
        { name: 'Vote', description: 'Each member votes for N options' },
        { name: 'Tally', description: 'Tally and retain top options' },
        { name: 'Repeat', description: 'Repeat until the set is manageable' },
      ],
      selection: { contexts: ['group'], groupNeeded: true },
      source: 'Decision-making catalog (12 models)',
    },
    {
      id: 'brainstorming', family: 'decisions', name: 'Brainstorming',
      purpose: 'Generate many ideas without immediate judgment for creative problem solving.',
      bestFor: ['Creative problem solving', 'Idea generation', 'Divergent thinking'],
      whenNotToUse: ['Convergent evaluation', 'When judgment is needed immediately'],
      stages: [
        { name: 'Generate', description: 'Generate ideas freely, no criticism' },
        { name: 'Record', description: 'Record every idea' },
        { name: 'Cluster', description: 'Cluster related ideas' },
        { name: 'Evaluate', description: 'Evaluate and shortlist afterward' },
      ],
      selection: { contexts: ['group'] },
      source: 'Decision-making catalog (12 models)',
    },
    {
      id: 'pmi', family: 'decisions', name: 'PMI (Plus, Minus, Interesting)',
      purpose: 'Simple structured reflection broadening beyond good/bad.',
      bestFor: ['Rapid structured reflection', 'Idea evaluation'],
      whenNotToUse: ['Complex quantitative decisions'],
      stages: [
        { name: 'Plus', description: 'List positive aspects' },
        { name: 'Minus', description: 'List negative aspects' },
        { name: 'Interesting', description: 'List interesting/implications' },
        { name: 'Weight', description: 'Weigh and conclude' },
      ],
      selection: { contexts: ['rapid'], timeCritical: true },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'lean-decision', family: 'decisions', name: 'Lean Decision Making',
      purpose: 'Decide, test, improve, repeat — speed over perfect information.',
      bestFor: ['Fast environments', 'Iterative products', 'Low-cost experimentation'],
      whenNotToUse: ['Irreversible high-stakes decisions'],
      stages: [
        { name: 'Decide', description: 'Make the smallest sufficient decision' },
        { name: 'Test', description: 'Test it cheaply' },
        { name: 'Improve', description: 'Improve from the evidence' },
        { name: 'Repeat', description: 'Repeat the cycle' },
      ],
      selection: { contexts: ['rapid'], timeCritical: true },
      source: 'Decision architecture corpus (12 models)',
    },
    {
      id: 'six-hats', family: 'decisions', name: 'Six Thinking Hats',
      purpose: 'Examine a decision from multiple distinct perspectives to avoid bias.',
      bestFor: ['Comprehensive balanced thinking', 'Team decision reviews'],
      whenNotToUse: ['When a single objective criterion suffices'],
      stages: [
        { name: 'White', description: 'Facts and data' },
        { name: 'Red', description: 'Emotions and intuition' },
        { name: 'Black', description: 'Risks and caution' },
        { name: 'Yellow', description: 'Benefits and optimism' },
        { name: 'Green', description: 'Creativity and alternatives' },
        { name: 'Blue', description: 'Process control and conclusion' },
      ],
      selection: { contexts: ['group', 'strategic'], groupNeeded: true },
      source: 'Decision-making catalog (12 models)',
    },

    {
      id: 'pros-cons', family: 'decisions', name: 'Pros & Cons Analysis',
      purpose: 'List the advantages and disadvantages of an option and weigh the balance for a verdict.',
      bestFor: ['Rapid structured evaluation', 'Two-sided consideration', 'Individual go/no-go decisions'],
      whenNotToUse: ['Multi-criteria quantitative comparison (decision matrix fits better)', 'Group consensus contexts'],
      stages: [
        { name: 'List pros', description: 'Enumerate every advantage of the option' },
        { name: 'List cons', description: 'Enumerate every disadvantage of the option' },
        { name: 'Weigh', description: 'Weigh the balance of pros against cons' },
        { name: 'Verdict', description: 'Conclude adopt / balanced / reject' },
      ],
      selection: { contexts: ['rapid'], timeCritical: true },
      source: 'Decision architecture corpus (12 models)',
    },

    /* ── problems ──────────────────────────────────────────────── */
    {
      id: 'ideal', family: 'problems', name: 'IDEAL',
      purpose: 'General-purpose linear problem solving: Identify, Define, Explore, Act, Look Back.',
      bestFor: ['Structured individual problem solving', 'General decision workflows', 'Learning from experience'],
      whenNotToUse: ['Unknown root causes', 'Fast-moving crises'],
      stages: [
        { name: 'Identify', description: 'Recognize the problem' },
        { name: 'Define', description: 'Clarify context and boundaries' },
        { name: 'Explore', description: 'Generate possible solutions' },
        { name: 'Act', description: 'Execute the best option' },
        { name: 'Look Back', description: 'Reflect on outcomes and lessons' },
      ],
      selection: { contexts: ['analytical'] },
      source: 'Problem-solving meta-framework corpus',
    },
    {
      id: 'five-whys', family: 'problems', name: 'Five Whys',
      purpose: 'Diagnose root causes by repeatedly asking why.',
      bestFor: ['Operational failures', 'Manufacturing', 'Software bugs', 'Process improvement'],
      whenNotToUse: ['Complex multi-factor systems (fishbone better)', 'When causes are already known'],
      stages: [
        { name: 'Symptom', description: 'State the symptom' },
        { name: 'Why 1-5', description: 'Ask why, descend the causal chain' },
        { name: 'Root cause', description: 'Identify the mechanism that generated the symptom' },
        { name: 'Correction', description: 'Design a system-level correction' },
      ],
      selection: { contexts: ['analytical'], rootCauseNeeded: true },
      source: 'RCA + problem-solving corpus',
    },
    {
      id: 'design-thinking', family: 'problems', name: 'Design Thinking',
      purpose: 'Human-centered innovation: empathize, define, ideate, prototype, test.',
      bestFor: ['Product design', 'User experience', 'Innovation', 'Service design'],
      whenNotToUse: ['Well-defined technical fixes', 'No user involvement possible'],
      stages: [
        { name: 'Empathize', description: 'Understand how people experience the problem' },
        { name: 'Define', description: 'Frame the user-centered problem' },
        { name: 'Ideate', description: 'Generate solution ideas' },
        { name: 'Prototype', description: 'Build cheap prototypes' },
        { name: 'Test', description: 'Test with users and iterate' },
      ],
      selection: { contexts: ['analytical'], humanCentered: true },
      source: 'Problem-solving meta-framework corpus',
    },
    {
      id: 'pdca', family: 'problems', name: 'PDCA Cycle',
      purpose: 'Plan, Do, Check, Act — continuous improvement loop.',
      bestFor: ['Quality management', 'Operational excellence', 'Process optimization'],
      whenNotToUse: ['One-shot creative work', 'Crisis response'],
      stages: [
        { name: 'Plan', description: 'Plan the change' },
        { name: 'Do', description: 'Execute the plan' },
        { name: 'Check', description: 'Check results against expectations' },
        { name: 'Act', description: 'Standardize or adjust; loop' },
      ],
      selection: { contexts: ['analytical'], continuousImprovement: true },
      source: 'Problem-solving meta-framework corpus',
    },
    {
      id: 'ooda', family: 'problems', name: 'OODA Loop',
      purpose: 'Observe, Orient, Decide, Act — adapt faster than the environment changes.',
      bestFor: ['Competitive environments', 'Crisis response', 'Security', 'Rapid business decisions'],
      whenNotToUse: ['Slow careful engineering', 'When orientation data is missing'],
      stages: [
        { name: 'Observe', description: 'Gather raw observations' },
        { name: 'Orient', description: 'Interpret against experience and context' },
        { name: 'Decide', description: 'Choose the response' },
        { name: 'Act', description: 'Act and observe the reaction' },
      ],
      selection: { contexts: ['rapid'], speedAdaptability: true, timeCritical: true },
      source: 'Problem-solving meta-framework corpus',
    },
    {
      id: 'kepner-tregoe', family: 'problems', name: 'Kepner-Tregoe',
      purpose: 'Comprehensive four-analysis problem solving for complex organizational issues.',
      bestFor: ['Complex organizational problems', 'High-risk environments', 'Engineering', 'Project management'],
      whenNotToUse: ['Small well-understood issues', 'Fast decisions'],
      stages: [
        { name: 'Situation Appraisal', description: 'Clarify and prioritize issues' },
        { name: 'Problem Analysis', description: 'Identify the root cause' },
        { name: 'Decision Analysis', description: 'Evaluate alternatives systematically' },
        { name: 'Potential Problem Analysis', description: 'Anticipate future risks and prevent' },
      ],
      selection: { contexts: ['uncertainty', 'analytical'], comprehensiveRigor: true },
      source: 'Problem-solving meta-framework corpus',
    },

    /* ── rca ───────────────────────────────────────────────────── */
    {
      id: 'rca-focus', family: 'rca', name: 'F.O.C.U.S. Root Cause Analysis',
      purpose: 'Focus, Organize, Create, Understand, Solve — diagnose and eliminate underlying causes.',
      bestFor: ['Recurring defects', 'System failures', 'Quality investigations'],
      whenNotToUse: ['Symptom-level quick fixes are explicitly acceptable'],
      stages: [
        { name: 'Focus', description: 'Define the measurable problem' },
        { name: 'Organize', description: 'Gather evidence: logs, observations, measurements, timelines' },
        { name: 'Create', description: 'Generate possible cause hypotheses' },
        { name: 'Understand', description: 'Study how the system interacts' },
        { name: 'Solve', description: 'Implement targeted corrective action' },
      ],
      selection: { contexts: ['analytical'], rootCauseNeeded: true },
      source: 'Root Cause Analysis corpus',
    },
    {
      id: 'fishbone', family: 'rca', name: 'Fishbone Diagram (Ishikawa)',
      purpose: 'Explore causes horizontally across categories to avoid fixation.',
      bestFor: ['Troubleshooting', 'Quality improvement', 'Multi-category causes'],
      whenNotToUse: ['Single known cause', 'Deep linear causal chains (five whys better)'],
      stages: [
        { name: 'Head', description: 'State the problem effect' },
        { name: 'Branches', description: 'Map categories: people, process, technology, materials, environment, management' },
        { name: 'Causes', description: 'Fill causes under each category' },
        { name: 'Prioritize', description: 'Prioritize the most plausible branches' },
      ],
      selection: { contexts: ['analytical'], rootCauseNeeded: true },
      source: 'Root Cause Analysis corpus',
    },

    /* ── strategy ──────────────────────────────────────────────── */
    {
      id: 'strategy-wheel', family: 'strategy', name: 'Strategy Wheel (20 Questions)',
      purpose: 'Continuous strategic inquiry across WHY/WHO/WHAT/HOW quadrants.',
      bestFor: ['Organization alignment', 'Strategic review', 'Competitive positioning'],
      whenNotToUse: ['Execution-only tasks', 'Tactical decisions'],
      stages: [
        { name: 'Purpose & Direction', description: 'Why do we exist? Mission, beliefs, 3-year vision, unconstrained success' },
        { name: 'Market & Advantage', description: 'Who is the highest-value customer? Pain, industry change, differentiation, moat' },
        { name: 'Goals & Metrics', description: 'Top 3 priorities, quarterly success, the one number, review cadence, winning milestone' },
        { name: 'Actions & Tactics', description: 'Review cadence, quick wins, blockers, ownership, 90-day deliverables' },
      ],
      selection: { contexts: ['strategic'] },
      source: 'Strategy Wheel corpus (20 questions)',
    },
    {
      id: 'strategy-vs-plan', family: 'strategy', name: 'Strategy vs Plan',
      purpose: 'Separate the strategy layer (why/where/win) from the plan layer (how/when/who).',
      bestFor: ['Avoiding the "organized activity without direction" trap', 'Strategy reviews', 'Goal setting'],
      whenNotToUse: ['Already-strategic teams doing pure execution'],
      stages: [
        { name: 'Strategy', description: 'Purpose, Arena, Advantage, Capabilities, Revenue Logic (3-5 yr)' },
        { name: 'Plan', description: 'Goals, Ownership, Resources, Timeline, Tracking (days-weeks-months)' },
        { name: 'Chain', description: 'Purpose → Strategy → Objectives → Planning → Execution → Measurement → Learning' },
      ],
      selection: { contexts: ['strategic'] },
      source: 'Strategy vs Plan corpus',
    },

    /* ── productivity ──────────────────────────────────────────── */
    {
      id: 'productivity-os', family: 'productivity', name: 'Productivity OS',
      purpose: 'End-to-end productivity pipeline: SMART goals → MIT → Eisenhower → time-blocking → focus → execute → review.',
      bestFor: ['Daily/weekly planning', 'Personal effectiveness', 'Task triage'],
      whenNotToUse: ['Organizational strategy', 'Creative divergent work'],
      stages: [
        { name: 'Define goals', description: 'SMART goals: Specific, Measurable, Achievable, Relevant, Time-bound' },
        { name: 'Choose priorities', description: 'MIT (1-3 critical tasks) + Pareto leverage + Eisenhower urgency/importance' },
        { name: 'Schedule', description: 'Time-blocking: every hour has a purpose' },
        { name: 'Focus', description: 'Pomodoro intervals + eat the frog first + task batching' },
        { name: 'Capture', description: 'GTD capture → clarify → organize → review → do; two-minute rule' },
        { name: 'Review', description: 'Review outcomes; feed back into goals' },
      ],
      selection: { contexts: ['analytical'], continuousImprovement: true },
      source: 'Productivity systems corpus (9 systems + OS)',
    },

    /* ── research ──────────────────────────────────────────────── */
    {
      id: 'research-methodology', family: 'research', name: 'Research Methodology',
      purpose: 'Design a defensible, reproducible methodology: design → collection → analysis → sampling → ethics.',
      bestFor: ['Academic research', 'Surveys and studies', 'Evidence-based work'],
      whenNotToUse: ['Informal quick decisions'],
      stages: [
        { name: 'Design', description: 'Choose qualitative/quantitative/mixed; justify against objectives' },
        { name: 'Collection', description: 'Specify surveys, interviews, focus groups, observations, secondary data' },
        { name: 'Analysis', description: 'Explain how raw data becomes findings' },
        { name: 'Sampling', description: 'Define target population, method, size justification' },
        { name: 'Ethics', description: 'Informed consent, confidentiality, voluntary participation, data protection' },
      ],
      selection: { contexts: ['analytical'], comprehensiveRigor: true },
      source: 'Research methodology corpus',
    },
    {
      id: 'research-gap', family: 'research', name: 'Research Gap Analysis',
      purpose: 'Find unanswered questions: knowledge, evidence, methodological, population, context, time, contradiction, theory gaps.',
      bestFor: ['Literature reviews', 'Dissertation topics', 'Research direction'],
      whenNotToUse: ['When the question is already well-scoped and studied'],
      stages: [
        { name: 'Search', description: 'Collect literature' },
        { name: 'Map', description: 'Synthesize what is known' },
        { name: 'Inspect', description: 'Look for inconsistencies, limitations, understudied populations' },
        { name: 'Mine', description: 'Read future-research recommendations; compare old vs new evidence' },
        { name: 'Classify', description: 'Classify the gap type and formulate the research question' },
      ],
      selection: { contexts: ['analytical', 'strategic'], comprehensiveRigor: true },
      source: 'Research gap analysis corpus (8 gap types)',
    },

    /* ── critical ──────────────────────────────────────────────── */
    {
      id: 'critical-evaluator', family: 'critical', name: 'Critical Thinking Evaluator',
      purpose: 'Evaluate information against the 9 critical questions: need, qualification, currency, prejudice, fact-vs-opinion, propaganda, motivation, whole story, better sources.',
      bestFor: ['Information verification', 'Source evaluation', 'Before relying on evidence'],
      whenNotToUse: ['Internal creative work with no external claims'],
      stages: [
        { name: 'Needs', description: 'Does this satisfy the need? Relevance, completeness, purpose' },
        { name: 'Source', description: 'Is the source qualified?' },
        { name: 'Currency', description: 'Is it current?' },
        { name: 'Prejudice', description: 'Is there bias or unfairness?' },
        { name: 'Fact vs Opinion', description: 'Are opinions presented as facts?' },
        { name: 'Propaganda', description: 'Is this propaganda or advertising?' },
        { name: 'Motivation', description: 'What is the author\'s motivation?' },
        { name: 'Whole story', description: 'Are we hearing the whole story?' },
        { name: 'Convergence', description: 'Are there better sources? Cross-check' },
      ],
      selection: { contexts: ['analytical'] },
      source: 'Critical thinking corpus (9 questions)',
    },

    /* ── knowledge ─────────────────────────────────────────────── */
    {
      id: 'dikw', family: 'knowledge', name: 'DIKW Transform',
      purpose: 'Transform Data → Information → Knowledge → Wisdom by adding structure, interpretation, and judgment.',
      bestFor: ['Sense-making', 'Report elevation', 'Learning loops'],
      whenNotToUse: ['When only facts are needed'],
      stages: [
        { name: 'Data', description: 'Isolated observations (who/what/when/where)' },
        { name: 'Information', description: 'Structured, related data' },
        { name: 'Knowledge', description: 'Models, mechanisms, experience (how)' },
        { name: 'Wisdom', description: 'Judgment, priorities, purpose (why; what should be done)' },
      ],
      selection: { contexts: ['analytical'] },
      source: 'DIKW pyramid corpus',
    },

    /* ── signals ───────────────────────────────────────────────── */
    {
      id: 'signal-fusion', family: 'signals', name: 'Composite Signal Fusion',
      purpose: 'Combine many weak, weakly-correlated signals into a robust ranked composite with risk controls.',
      bestFor: ['Multi-factor ranking', 'Scoring candidates', 'Portfolio-style allocation'],
      whenNotToUse: ['Single decisive criterion', 'When signal correlation is unknown and high'],
      stages: [
        { name: 'Factorize', description: 'Define factors (momentum, quality, liquidity, volatility, etc.)' },
        { name: 'Normalize', description: 'Rank/normalize each factor' },
        { name: 'Weight', description: 'Assign weights (default equal)' },
        { name: 'Fuse', description: 'Compute composite scores' },
        { name: 'Rank', description: 'Rank opportunities' },
        { name: 'Risk', description: 'Apply risk controls: diversification, rebalance' },
      ],
      selection: { contexts: ['analytical'], dataRich: true },
      source: 'Quantitative investing corpus',
    },

    /* ── code ──────────────────────────────────────────────────── */
    {
      id: 'code-principles', family: 'code', name: 'Clean Code Principles (SOC/DRY/KISS/DYC/YAGNI)',
      purpose: 'Audit a design or change against the five clean-code principles and their trade-offs.',
      bestFor: ['Code review', 'Design review', 'Refactoring decisions'],
      whenNotToUse: ['Runtime behavior debugging'],
      stages: [
        { name: 'SOC', description: 'One primary responsibility per module/class/function' },
        { name: 'DRY', description: 'One authoritative representation of each knowledge item' },
        { name: 'KISS', description: 'Simplest solution that fully solves the problem' },
        { name: 'DYC', description: 'Document intent, not behavior' },
        { name: 'YAGNI', description: 'Only implement what is required now' },
        { name: 'Trade-offs', description: 'DRY vs KISS, YAGNI vs SOC, docs vs self-documenting' },
      ],
      selection: { contexts: ['analytical'] },
      source: 'Clean code principles corpus',
    },
  ];
}

/** Registry pre-populated with the full catalog. */
export function createFrameworkRegistry(tracer?: FrameworkTraceRecorder | null): FrameworkRegistry {
  const registry = new FrameworkRegistry(tracer);
  registry.registerAll(createFrameworkCatalog());
  return registry;
}
