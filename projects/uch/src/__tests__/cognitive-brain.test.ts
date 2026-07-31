import { describe, it, expect } from 'vitest';
import { EventLedger } from '../cognitive-recorder/event-ledger.js';
import { createActivity, type ActivityType } from '../cognitive-recorder/cognitive-activity.js';
import { Conscience } from '../cognitive-brain/conscience.js';
import { MemoryPipeline } from '../cognitive-brain/memory-pipeline.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { createProvenance } from '../kernel/types/provenance.js';

const testProvenance = createProvenance('system_log', 'test');
const testContext = {
  session_id: 'test-session',
  agent_id: 'test-agent',
  workspace_id: 'test-ws',
};

function seedActivities(ledger: EventLedger, count: number): void {
  for (let i = 0; i < count; i++) {
    ledger.append(
      createActivity({
        type: 'observe',
        context: testContext,
        provenance: testProvenance,
        goal: `observation ${i}`,
      }),
    );
  }
}

describe('Conscience', () => {
  it('reflects on a session with activities', async () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const conscience = new Conscience(ledger, kernel);

    seedActivities(ledger, 5);
    ledger.append(
      createActivity({ type: 'plan', context: testContext, provenance: testProvenance }),
    );
    ledger.append(
      createActivity({ type: 'execute', context: testContext, provenance: testProvenance }),
    );
    ledger.append(
      createActivity({ type: 'reflect', context: testContext, provenance: testProvenance }),
    );

    const report = await conscience.reflect('test-session', 'test-agent');
    expect(report.session_summary).toContain('8 activities');
    expect(report.session_summary).toContain('4 types');
    expect(report.patterns_observed).toBeDefined();
    expect(report.recommendations).toBeDefined();
    expect(report.strategic_insights.length).toBeGreaterThan(0);
  });

  it('detects repetitive activity patterns', async () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const conscience = new Conscience(ledger, kernel);

    for (let i = 0; i < 5; i++) {
      ledger.append(
        createActivity({ type: 'observe', context: testContext, provenance: testProvenance }),
      );
    }

    const report = await conscience.reflect('test-session', 'test-agent');
    expect(report.patterns_observed.some((p) => p.includes('Repetitive'))).toBe(true);
  });

  it('detects anomalies with failures', async () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const conscience = new Conscience(ledger, kernel);

    for (let i = 0; i < 5; i++) {
      const act = createActivity({
        type: 'execute',
        context: testContext,
        provenance: testProvenance,
      });
      act.outcome.status = 'failure';
      ledger.append(act);
    }

    const report = await conscience.reflect('test-session', 'test-agent');
    expect(report.anomalies_detected.some((a) => a.includes('failure'))).toBe(true);
  });

  it('generates recommendations based on patterns', async () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const conscience = new Conscience(ledger, kernel);

    seedActivities(ledger, 10);
    const report = await conscience.reflect('test-session', 'test-agent');
    expect(report.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it('predicts next activity type from sequence', async () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const conscience = new Conscience(ledger, kernel);

    const pattern: ActivityType[] = ['observe', 'plan', 'execute', 'observe', 'plan', 'execute'];
    for (const type of pattern) {
      ledger.append(
        createActivity({ type, context: testContext, provenance: testProvenance }),
      );
    }

    const prediction = await conscience.predict('test-agent', ['code']);
    expect(prediction.predicted_type).toBeDefined();
    expect(prediction.confidence).toBeGreaterThan(0);
    expect(prediction.context_basis).toContain('code');
  });

  it('handles empty ledger gracefully', async () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const conscience = new Conscience(ledger, kernel);

    const report = await conscience.reflect('empty-session', 'test-agent');
    expect(report.session_summary).toBeDefined();
    expect(report.patterns_observed).toEqual([]);
  });
});

describe('MemoryPipeline', () => {
  it('processes a single activity into kernel memory', () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const pipeline = new MemoryPipeline(ledger, kernel);

    const act = createActivity({
      type: 'observe',
      context: testContext,
      provenance: testProvenance,
      goal: 'review authentication module',
    });
    ledger.append(act);

    const result = pipeline.processActivity(act.id);
    expect(result).toBe(true);
    expect(kernel.getStats().episodes).toBeGreaterThanOrEqual(1);
  });

  it('processes activities since a date', () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const pipeline = new MemoryPipeline(ledger, kernel);

    const past = new Date('2024-01-01');

    ledger.append(
      createActivity({
        type: 'observe',
        context: testContext,
        provenance: testProvenance,
        goal: 'review auth',
      }),
    );
    ledger.append(
      createActivity({
        type: 'plan',
        context: testContext,
        provenance: testProvenance,
        goal: 'implement auth',
      }),
    );

    const report = pipeline.processSince(past);
    expect(report.activities_processed).toBe(2);
    expect(report.episodes_created).toBeGreaterThanOrEqual(1);
    expect(report.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('extracts concepts from activity goals', () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const pipeline = new MemoryPipeline(ledger, kernel);
    const past = new Date('2024-01-01');

    ledger.append(
      createActivity({
        type: 'observe',
        context: testContext,
        provenance: testProvenance,
        goal: 'review authentication module security',
      }),
    );
    ledger.append(
      createActivity({
        type: 'plan',
        context: testContext,
        provenance: testProvenance,
        goal: 'implement database migration strategy',
      }),
    );

    const report = pipeline.processSince(past);
    expect(report.concepts_extracted).toBeGreaterThan(0);
  });

  it('handles tool_call activities', () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const pipeline = new MemoryPipeline(ledger, kernel);

    const act = createActivity({
      type: 'execute',
      context: testContext,
      provenance: testProvenance,
    });
    act.tools.push({
      tool_name: 'eslint',
      input: { files: ['src/'] },
      output: { errors: 0 },
      status: 'success',
    });
    ledger.append(act);

    expect(pipeline.processActivity(act.id)).toBe(true);
  });

  it('returns false for non-existent activities', () => {
    const ledger = new EventLedger();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const pipeline = new MemoryPipeline(ledger, kernel);

    expect(pipeline.processActivity('nonexistent')).toBe(false);
  });
});
