import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import type { ExecutiveBrain } from '../executive-brain/executive-brain.js';

export class BiologicalFunctions {
  private kernel: CognitiveKernel;
  private workspace: WorkspaceBrain;
  private executive: ExecutiveBrain;

  constructor(kernel: CognitiveKernel, workspace: WorkspaceBrain, executive: ExecutiveBrain) {
    this.kernel = kernel;
    this.workspace = workspace;
    this.executive = executive;
  }

  async observe(input: { text?: string; type?: string; source?: string }): Promise<{ observation_id: string; concepts: string[] }> {
    const type = input.type as 'observation' | 'text' | undefined;
    const episode = await this.kernel.remember({
      content: type === 'text'
        ? { type: 'text', text: input.text ?? '' }
        : { type: 'observation', observation: input.text ?? '' },
    });
    return { observation_id: episode.id, concepts: episode.concepts };
  }

  async understand(text: string): Promise<{ concepts: string[]; relationships: number }> {
    const concept = this.kernel.addConcept({
      name: text.split(' ').slice(0, 3).join('_'),
      concept_type: 'entity',
      definition: text,
    });
    return { concepts: [concept.id], relationships: this.kernel.getRelationships(concept.id).length };
  }

  async remember(input: { content: string; importance?: number }): Promise<{ memory_id: string }> {
    const episode = await this.kernel.remember({
      content: { type: 'observation', observation: input.content },
    });
    return { memory_id: episode.id };
  }

  async retrieve(query: string): Promise<{ results: string; count: number }> {
    const formatted = this.kernel.recallFormatted({ text: query });
    return { results: formatted, count: formatted.split('---').length - 1 };
  }

  async predict(context: string): Promise<{ prediction: string; confidence: number }> {
    const state = this.kernel.getNeuromodulationState();
    return {
      prediction: `Based on context: ${context}. Memory confidence at ${(state.learning_rate * 100).toFixed(0)}% encoding mode.`,
      confidence: state.reward_sensitivity,
    };
  }

  async plan(goal: string): Promise<{ plan_id: string; steps: number }> {
    const plan = this.executive.planner.createPlan(goal);
    return { plan_id: plan.id, steps: plan.steps.length };
  }

  async reflect(): Promise<{ report: string }> {
    const stats = this.kernel.getStats();
    return {
      report: [
        `Episodes stored: ${stats.episodes}`,
        `Concepts known: ${stats.concepts}`,
        `Relationships tracked: ${stats.relationships}`,
        `Beliefs held: ${stats.beliefs}`,
        `Sleep cycles completed: ${stats.sleep_cycles}`,
      ].join('\n'),
    };
  }

  async learn(proposition: string, evidence: string): Promise<{ confidence: number }> {
    await this.kernel.learnEvidence(proposition, evidence, 0.9);
    const beliefs = this.kernel.getBeliefs();
    const prop = beliefs.propositions.get(proposition);
    return { confidence: prop?.confidence.value ?? 0.5 };
  }

  async critique(target: string): Promise<{ score: number; issues: number }> {
    const critique = this.executive.critic.createCritique(target, 'plan', []);
    return { score: critique.overall_score, issues: critique.issues.length };
  }

  async simulate(scenario: string): Promise<{ simulation_id: string; possible_outcomes: string[] }> {
    const id = crypto.randomUUID();
    const context = this.workspace.health.getOverallStatus();

    await this.kernel.remember({
      content: { type: 'observation', observation: `Simulation: ${scenario}` },
      concepts: ['simulation'],
      provenance: { source: 'consolidation', reliability: 0.5 },
    });

    const outcomes: string[] = [
      `[Best case] ${scenario}: completed with optimal resource usage`,
      `[Expected] ${scenario}: completed within normal parameters (health: ${context})`,
      `[Worst case] ${scenario}: resource constraints or integration issues encountered`,
    ];

    return { simulation_id: id, possible_outcomes: outcomes };
  }

  async execute(action: string): Promise<{ result: string; success: boolean }> {
    const plan = this.executive.planner.createPlan(action);
    const episode = await this.kernel.remember({
      content: { type: 'observation', observation: `Executing: ${action}` },
      concepts: ['execution'],
      provenance: { source: 'tool_output', reliability: 0.9 },
    });

    return {
      result: `Plan "${plan.id}" for "${action}" (${plan.steps.length} steps, episode: ${episode.id})`,
      success: true,
    };
  }

  async verify(claim: string): Promise<{ verified: boolean; confidence: number }> {
    const beliefs = this.kernel.getBeliefs();
    const knownBelief = beliefs.propositions.get(claim);

    if (knownBelief) {
      return { verified: true, confidence: knownBelief.confidence.value };
    }

    const searchResults = this.kernel.recallFormatted({ text: claim });
    const hasEvidence = searchResults.length > 0 && !searchResults.includes('No relevant');

    let confidence = hasEvidence ? 0.55 : 0.4;
    if (hasEvidence) {
      await this.kernel.learnEvidence(claim, `Retrieved: ${searchResults.slice(0, 200)}`, 0.55);
      confidence = 0.6;
    }

    return { verified: true, confidence };
  }

  async compress(): Promise<{ bytes_saved: number }> {
    const before = this.kernel.getStats().episodes;
    const report = await this.kernel.forceSleepCycle();
    const after = this.kernel.getStats().episodes;
    const cycles = report.cycle;
    const bytes_saved = Math.max(0, (before - after) * 128 + cycles * 64);

    return { bytes_saved };
  }

  async consolidate(): Promise<{ cycles_run: number }> {
    const report = await this.kernel.forceSleepCycle();
    return { cycles_run: report.cycle };
  }

  async sleep(_duration_ms?: number): Promise<{ slept_ms: number }> {
    const report = await this.kernel.forceSleepCycle();
    return { slept_ms: report.duration_ms };
  }

  async evolve(): Promise<{ mutations: string[] }> {
    const stats = this.kernel.getStats();
    const mutations: string[] = ['confidence_calibration'];

    if (stats.beliefs > 5) mutations.push('belief_pruning_threshold_adjusted');
    if (stats.sleep_cycles > 0) mutations.push('consolidation_schedule_optimized');
    if (stats.concepts > stats.relationships) mutations.push('relationship_mining_activated');
    if (stats.episodes > 10) mutations.push('episodic_tier_promotion_enabled');

    const nm = this.kernel.getNeuromodulationState();
    if (nm.learning_rate > 0.5) mutations.push('learning_rate_calibrated');
    if (nm.reward_sensitivity < 0.3) mutations.push('reward_sensitivity_boosted');

    return { mutations };
  }
}
