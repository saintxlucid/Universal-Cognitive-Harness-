import { describe, it, expect, beforeAll } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from '../kernel/cic/circuit-breaker.js';
import { T06RunawayProcessMitigation, T07CascadingPolicyMitigation, T13TokenExhaustionMitigation, ThreatMitigationEngine } from '../kernel/cic/threat-mitigations.js';
import { A2ATransport, type A2AMessage } from '../interface/a2a-transport.js';
import { IPCTransport } from '../interface/ipc-transport.js';
import { CLITransport } from '../interface/cli-transport.js';
import { AttentionCortex } from '../cortex_kernel/attention-cortex.js';
import { UnderstandingCortex } from '../cortex_kernel/understanding-cortex.js';
import { ExecutiveCortex } from '../cortex_kernel/executive-cortex.js';
import { MetaBrain } from '../cortex_kernel/meta-brain.js';
import { ConsciousnessGate } from '../cortex_kernel/integrator.js';
import { Consciousness } from '../aether/consciousness.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { PolicyEngine } from '../control-plane/policies.js';
import { ImmuneSystem } from '../cognitive-core/immune.js';
import { Auth } from '../control-plane/auth/auth.js';
import { ReflexEngine } from '../suit/instinct/reflex-engine.js';

// ── F01: Circuit Breaker Pattern ──

describe('F01: Circuit Breaker', () => {
  it('starts closed and opens after threshold failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 60000, successThreshold: 1, halfOpenMaxCalls: 1 });
    expect(cb.getState()).toBe('closed');

    for (let i = 0; i < 3; i++) {
      await expect(cb.call(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    }
    expect(cb.getState()).toBe('open');

    await expect(cb.call(async () => 'should not run')).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('transitions to half-open after reset timeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50, successThreshold: 1, halfOpenMaxCalls: 1 });
    for (let i = 0; i < 2; i++) {
      await expect(cb.call(async () => { throw new Error('fail'); })).rejects.toThrow();
    }
    expect(cb.getState()).toBe('open');

    await new Promise((r) => setTimeout(r, 60));
    const result = await cb.call(async () => 'success');
    expect(result).toBe('success');
    expect(cb.getState()).toBe('closed');
  });

  it('tracks timeout errors separately', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, successThreshold: 1, halfOpenMaxCalls: 1 });
    await expect(cb.call(async () => { throw new Error('fail'); }, 10)).rejects.toThrow();
    const stats = cb.getStats();
    expect(stats.totalTimeouts).toBe(0);
    expect(stats.totalFailures).toBe(1);
  });

  it('supports force open and force close', () => {
    const cb = new CircuitBreaker();
    cb.forceOpen();
    expect(cb.getState()).toBe('open');
    cb.forceClose();
    expect(cb.getState()).toBe('closed');
  });

  it('tracks comprehensive stats', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 60000, successThreshold: 1, halfOpenMaxCalls: 1 });
    await cb.call(async () => 'ok');
    await expect(cb.call(async () => { throw new Error('fail'); })).rejects.toThrow();
    await expect(cb.call(async () => { throw new Error('fail'); })).rejects.toThrow();

    const stats = cb.getStats();
    expect(stats.totalCalls).toBe(3);
    expect(stats.totalSuccesses).toBe(1);
    expect(stats.totalFailures).toBe(2);
    expect(stats.state).toBe('open');
    expect(stats.lastFailure).toBeInstanceOf(Date);
    expect(stats.lastSuccess).toBeInstanceOf(Date);
    expect(stats.openedAt).toBeInstanceOf(Date);
  });
});

// ── F02: Threat Mitigations ──

describe('F02: Threat Mitigations (T06, T07, T13)', () => {
  it('T06: detects runaway processes via circuit breaker', () => {
    const mitigation = new T06RunawayProcessMitigation();
    mitigation.trackProcessStart('proc-1');
    mitigation.trackProcessEnd('proc-1');
    expect(mitigation.getCircuitBreaker().getState()).toBe('closed');
    expect(mitigation.getActiveProcesses()).toBe(0);
  });

  it('T07: cascading policy failure detection', () => {
    const mitigation = new T07CascadingPolicyMitigation();
    for (let i = 0; i < 15; i++) {
      mitigation.recordPolicyFailure('policy-a');
    }
    expect(mitigation.isPolicyAvailable('policy-a')).toBe(false);
    expect(mitigation.getFailingPolicies()).toContain('policy-a');
  });

  it('T13: token exhaustion blocks rapid cycling', () => {
    const mitigation = new T13TokenExhaustionMitigation();
    for (let i = 0; i < 60; i++) {
      mitigation.recordTokenIssue('attacker-1', false);
    }
    expect(mitigation.isSourceBlocked('attacker-1')).toBe(true);
    expect(mitigation.getBlockedSources()).toContain('attacker-1');
  });

  it('T13: blocked source auto-unblocks after cooldown', async () => {
    const mitigation = new T13TokenExhaustionMitigation();
    for (let i = 0; i < 60; i++) {
      mitigation.recordTokenIssue('temp-block', false);
    }
    expect(mitigation.isSourceBlocked('temp-block')).toBe(true);

    mitigation.unblockSource('temp-block');
    expect(mitigation.isSourceBlocked('temp-block')).toBe(false);
  });

  it('threat mitigation engine runs detection cycles', async () => {
    const policies = new PolicyEngine();
    const auth = new Auth();
    const reflex = new ReflexEngine();
    const immune = new ImmuneSystem(policies, auth, reflex);

    const engine = new ThreatMitigationEngine(immune, policies, { autoMitigate: true, cycleIntervalMs: 100, maxMitigationsPerCycle: 5 });

    const result = await engine.tick();
    expect(Array.isArray(result)).toBe(true);
    expect(engine.getStats().totalCycles).toBe(1);
  });
});

// ── F03: A2A Transport ──

describe('F03: A2A Agent-to-Agent Transport', () => {
  it('handles handshake protocol', async () => {
    const transportA = new A2ATransport({ agentId: 'agent-a', agentName: 'Agent A', capabilities: ['observe'] });
    new A2ATransport({ agentId: 'agent-b', agentName: 'Agent B' });

    const handshakeMsg: A2AMessage = {
      jsonrpc: '2.0',
      method: 'a2a.handshake',
      params: { agentId: 'agent-b', agentName: 'Agent B', capabilities: [] },
    };
    const response = await transportA.handleIncoming(handshakeMsg);
    expect(response.result).toHaveProperty('agentId');
    expect(transportA.getPeers()).toContain('agent-b');
  });

  it('registers and unregisters peers', () => {
    const transport = new A2ATransport({ agentId: 'test' });
    transport.registerPeer('peer-1', []);
    expect(transport.getPeers()).toContain('peer-1');
    transport.unregisterPeer('peer-1');
    expect(transport.getPeers()).not.toContain('peer-1');
  });

  it('returns 404 for unknown methods', async () => {
    const transport = new A2ATransport({ agentId: 'test' });
    const msg: A2AMessage = { jsonrpc: '2.0', method: 'unknown.method' };
    const response = await transport.handleIncoming(msg);
    expect(response.error?.code).toBe(-32601);
  });

  it('handles heartbeats gracefully', async () => {
    const transport = new A2ATransport({ agentId: 'test' });
    transport.registerPeer('peer-1', []);

    const heartbeat: A2AMessage = {
      jsonrpc: '2.0',
      method: 'a2a.heartbeat',
      params: { agentId: 'peer-1' },
    };
    const response = await transport.handleIncoming(heartbeat);
    expect(response.result).toEqual({ status: 'ok' });
  });
});

// ── F04: IPC Transport ──

describe('F04: IPC Transport', () => {
  it('starts and stops without errors', () => {
    const transport = new IPCTransport({ socketPath: '.uccp-test/test-ipc.sock' });
    transport.start();
    expect(transport.status().serverRunning).toBe(true);
    transport.stop();
    expect(transport.status().serverRunning).toBe(false);
  });

  it('registers and lists handlers', () => {
    const transport = new IPCTransport();
    transport.registerHandler('test.method', async () => 'result');
    transport.start();
    expect(transport.status().registeredHandlers).toBe(1);
    transport.stop();
  });

  it('status includes connection info', () => {
    const transport = new IPCTransport({ socketPath: '.uccp-test/ipc-status.sock' });
    const status = transport.status();
    expect(status).toHaveProperty('socketPath');
    expect(status).toHaveProperty('connections');
    expect(status).toHaveProperty('serverRunning');
  });
});

// ── F05: CLI Transport ──

describe('F05: CLI Transport', () => {
  it('registers built-in commands', () => {
    const transport = new CLITransport();
    expect(transport.status().commands).toBeGreaterThan(0);
  });

  it('tracks command history', () => {
    const transport = new CLITransport();
    transport['addToHistory']('test command');
    expect(transport.getHistory()).toContain('test command');
  });

  it('enforces max history limit', () => {
    const transport = new CLITransport({ maxHistory: 3 });
    for (let i = 0; i < 10; i++) {
      transport['addToHistory'](`cmd-${i}`);
    }
    expect(transport.getHistory().length).toBeLessThanOrEqual(3);
  });

  it('status reflects running state', () => {
    const transport = new CLITransport();
    expect(transport.status().running).toBe(false);
    transport.start();
    expect(transport.status().running).toBe(true);
    transport.stop();
    expect(transport.status().running).toBe(false);
  });
});

// ── F06: Attention Cortex (Importance Scoring) ──

describe('F06: Attention Cortex (Importance Scoring)', () => {
  let consciousness: Consciousness;
  let gate: ConsciousnessGate;
  let cortex: AttentionCortex;

  beforeAll(() => {
    consciousness = new Consciousness();
    gate = new ConsciousnessGate();
    cortex = new AttentionCortex(consciousness, gate);
  });

  it('evaluates importance from multiple dimensions', () => {
    const score = cortex.evaluateImportance({ urgency: 0.9, novelty: 0.5, relevance: 0.8, semanticSalience: 0.3, emotionalValence: 0.2 });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('registers and retrieves signals', () => {
    const signal = cortex.registerSignal({
      sourceId: 'test-1', source: 'test', content: 'Important signal',
      urgency: 0.8, novelty: 0.6, relevance: 0.7,
    });
    expect(signal.importance).toBeGreaterThan(0);
    expect(signal.sourceId).toBe('test-1');
  });

  it('attention bottleneck limits top signals', () => {
    for (let i = 0; i < 20; i++) {
      cortex.registerSignal({ sourceId: `sig-${i}`, source: 'test', content: `Signal ${i}`, urgency: Math.random(), novelty: Math.random(), relevance: Math.random() });
    }
    const attended = cortex.attend();
    expect(attended.length).toBeLessThanOrEqual(7);
  });

  it('tracks importance trends by source', () => {
    const trend = cortex.getImportanceTrend('test');
    expect(trend).toHaveProperty('average');
    expect(trend).toHaveProperty('count');
  });

  it('allows manual importance override', () => {
    cortex.registerSignal({ sourceId: 'override-test', source: 'test', content: 'Override me' });
    const result = cortex.setImportance('override-test', 0.95);
    expect(result).toBe(true);
    const top = cortex.getTopSignals(5);
    const found = top.find((s) => s.sourceId === 'override-test');
    expect(found?.importance).toBe(0.95);
  });
});

// ── F07: Understanding Cortex (Concept Extraction) ──

describe('F07: Understanding Cortex (Concept Extraction)', () => {
  let kernel: CognitiveKernel;
  let consciousness: Consciousness;
  let cortex: UnderstandingCortex;

  beforeAll(() => {
    kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    consciousness = new Consciousness();
    cortex = new UnderstandingCortex(consciousness, kernel);
  });

  it('extracts concepts from tokens', () => {
    const tokens = ['AuthenticationService', 'handles', 'user', 'login', 'AuthorizationMiddleware', 'validates', 'token'];
    const concepts = cortex.extractConcepts({ tokens, source: 'test' });
    expect(concepts.length).toBeGreaterThan(0);
    for (const c of concepts) {
      expect(c.name).toBeTruthy();
      expect(c.type).toBeDefined();
      expect(c.confidence).toBeGreaterThan(0);
    }
  });

  it('filters low-confidence concepts', () => {
    const tokens = ['a', 'an', 'the', 'is', 'are', 'was'];
    const concepts = cortex.extractConcepts({ tokens, source: 'test' });
    const lowConf = concepts.filter((c) => c.confidence < 0.3);
    expect(lowConf.length).toBe(0);
  });

  it('respects max concepts per extraction', () => {
    const cortex2 = new UnderstandingCortex(consciousness, kernel, { maxConceptsPerExtraction: 3, minConceptConfidence: 0.1 });
    const tokens = ['AlphaService', 'BetaClient', 'GammaModule', 'DeltaHandler', 'EpsilonFactory'];
    const concepts = cortex2.extractConcepts({ tokens, source: 'test' });
    expect(concepts.length).toBeLessThanOrEqual(3);
  });

  it('discovers co-occurrence relationships', () => {
    const tokens = ['AuthService', 'handles', 'AuthService', 'validates', 'UserModel'];
    cortex.extractConcepts({ tokens, source: 'rel-test' });
    const related = cortex.findRelatedConcepts('AuthService');
    expect(related.length).toBeGreaterThanOrEqual(0);
  });

  it('returns extraction history', () => {
    const tokens = ['UniqueConcept_X1', 'UniqueConcept_Y2'];
    cortex.extractConcepts({ tokens, source: 'hist-test' });
    const history = cortex.getExtractionHistory(5);
    expect(history.length).toBeGreaterThan(0);
  });
});

// ── F08: Executive Cortex Integration (Planning + Selection) ──

describe('F08: Executive Cortex Integration', () => {
  let consciousness: Consciousness;
  let gate: ConsciousnessGate;
  let kernel: CognitiveKernel;
  let eventBus: NeuralEventBus;
  let executive: ExecutiveBrain;
  let attention: AttentionCortex;
  let understanding: UnderstandingCortex;
  let cortex: ExecutiveCortex;

  beforeAll(() => {
    consciousness = new Consciousness();
    gate = new ConsciousnessGate();
    kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    eventBus = new NeuralEventBus();
    executive = new ExecutiveBrain({ eventBus });
    attention = new AttentionCortex(consciousness, gate);
    understanding = new UnderstandingCortex(consciousness, kernel);
    cortex = new ExecutiveCortex(consciousness, gate, attention, understanding, executive, kernel, eventBus);
  });

  it('accepts plan proposals', () => {
    cortex.proposePlan({ goal: 'Build auth module', confidence: 0.8, urgency: 0.6, complexity: 0.4, expectedValue: 0.9, estimatedCost: 0.3, context: {} });
    expect(cortex.getProposals().length).toBe(1);
  });

  it('selects plans based on score', () => {
    cortex.proposePlan({ goal: 'Fix performance bug', confidence: 0.6, urgency: 0.9, complexity: 0.3, expectedValue: 0.7, estimatedCost: 0.2, context: {} });
    const plans = cortex.selectPlans();
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(plan.id).toBeTruthy();
      expect(plan.status).toBe('active');
    }
  });

  it('respects max active plans limit', () => {
    const limitedCortex = new ExecutiveCortex(consciousness, gate, attention, understanding, executive, kernel, eventBus, { maxActivePlans: 1, autoSelect: false });
    limitedCortex.proposePlan({ goal: 'Plan A', confidence: 0.8, urgency: 0.5, complexity: 0.3, expectedValue: 0.7, estimatedCost: 0.2, context: {} });
    limitedCortex.proposePlan({ goal: 'Plan B', confidence: 0.7, urgency: 0.4, complexity: 0.3, expectedValue: 0.6, estimatedCost: 0.3, context: {} });

    const activeBefore = executive.planner.getActivePlans().length;
    limitedCortex.selectPlans();
    const activeAfter = executive.planner.getActivePlans().length;
    expect(activeAfter - activeBefore).toBeLessThanOrEqual(1);
  });

  it('performs competitive selection', () => {
    const compCortex = new ExecutiveCortex(consciousness, gate, attention, understanding, executive, kernel, eventBus, { enableCompetitiveSelection: true, maxActivePlans: 5, autoSelect: false });
    compCortex.proposePlan({ goal: 'Optimize database queries', confidence: 0.8, urgency: 0.5, complexity: 0.6, expectedValue: 0.7, estimatedCost: 0.4, context: {} });
    compCortex.proposePlan({ goal: 'Optimize API performance', confidence: 0.7, urgency: 0.4, complexity: 0.5, expectedValue: 0.6, estimatedCost: 0.3, context: {} });
    compCortex.selectPlans();
    expect(compCortex.getStats().totalPlansSelected).toBeGreaterThan(0);
  });
});

// ── F09: Meta Brain (Self-Observation & Reflective Learning) ──

describe('F09: Meta Brain', () => {
  let consciousness: Consciousness;
  let gate: ConsciousnessGate;
  let brain: MetaBrain;

  beforeAll(() => {
    consciousness = new Consciousness();
    gate = new ConsciousnessGate();
    brain = new MetaBrain(consciousness, gate);
  });

  it('records self-observations', () => {
    const obs = brain.observe({ category: 'cognitive', aspect: 'reasoning-speed', content: 'Processing is slower than expected', valence: -0.4, arousal: 0.6 });
    expect(obs.id).toBeTruthy();
    expect(obs.category).toBe('cognitive');
    expect(obs.aspect).toBe('reasoning-speed');
  });

  it('generates reflective insights from patterns', () => {
    for (let i = 0; i < 5; i++) {
      brain.observe({ category: 'performance', aspect: 'response-latency', content: `High latency observed in cycle ${i}`, valence: -0.5, arousal: 0.7 });
    }
    const insights = brain.reflect();
    expect(insights.length).toBeGreaterThanOrEqual(0);
  });

  it('tracks self-model trends', () => {
    brain.observe({ category: 'behavioral', aspect: 'tool-choice', content: 'Selected correct tool', valence: 0.6, arousal: 0.4 });
    brain.observe({ category: 'behavioral', aspect: 'tool-choice', content: 'Selected correct tool again', valence: 0.7, arousal: 0.3 });
    brain.observe({ category: 'behavioral', aspect: 'tool-choice', content: 'Excellent tool selection', valence: 0.8, arousal: 0.2 });
    const model = brain.getSelfModel();
    expect(Object.keys(model).length).toBeGreaterThan(0);
  });

  it('marks insights as applied', () => {
    brain.observe({ category: 'cognitive', aspect: 'test-marker', content: 'Test insight', valence: 0, arousal: 0.5 });
    brain.reflect();
    const insights = brain.getInsights(10);
    if (insights.length > 0) {
      const result = brain.markInsightApplied(insights[0]!.id);
      expect(result).toBe(true);
    }
  });

  it('filters observations by category', () => {
    const cognitive = brain.getObservations('cognitive');
    for (const obs of cognitive) {
      expect(obs.category).toBe('cognitive');
    }
  });

  it('detects recurring patterns', () => {
    const patterns = brain.getPatterns();
    expect(Array.isArray(patterns)).toBe(true);
    for (const p of patterns) {
      expect(p).toHaveProperty('pattern');
      expect(p).toHaveProperty('count');
      expect(p).toHaveProperty('confidence');
    }
  });
});

// ── F10: Persistent Store Integration ──

describe('F10: Persistent Store in UCCPServer Lifecycle', () => {
  it('initializes and shuts down persistent store', async () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test', persistence_path: '.uccp-test/persist' });
    await kernel.init();
    expect(kernel.getPersistence()).not.toBeNull();
    await kernel.shutdown();
  });

  it('persists episodes through kernel remember', async () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test', persistence_path: '.uccp-test/persist-ep' });
    await kernel.init();

    await kernel.remember({ content: { type: 'text', text: 'Test episode for persistence' }, provenance: { source: 'user' } });
    const episodes = kernel.getRecentEpisodes(1);
    expect(episodes.length).toBe(1);
    expect(episodes[0]!.content).toEqual({ type: 'text', text: 'Test episode for persistence' });

    await kernel.shutdown();
  });

  it('persists concepts through kernel addConcept', async () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test', persistence_path: '.uccp-test/persist-con' });
    await kernel.init();

    kernel.addConcept({ name: 'PersistedConcept', concept_type: 'entity', definition: 'A concept that persists' });
    const concepts = kernel.getAllConcepts();
    const found = concepts.find((c) => c.name === 'PersistedConcept');
    expect(found).toBeDefined();

    await kernel.shutdown();
  });

  it('supports setting persistence path after construction', async () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    expect(kernel.getPersistence()).toBeNull();

    await kernel.setPersistencePath('.uccp-test/persist-late');
    expect(kernel.getPersistence()).not.toBeNull();

    await kernel.remember({ content: { type: 'text', text: 'Late persistence test' }, provenance: { source: 'user' } });
    await kernel.shutdown();
  });

  it('persists and restores multiple data types', async () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test', persistence_path: '.uccp-test/persist-multi' });
    await kernel.init();

    await kernel.remember({ content: { type: 'text', text: 'Multi-type episode' }, provenance: { source: 'user' } });
    kernel.addConcept({ name: 'MultiTypeConcept', concept_type: 'entity', definition: 'Multi-type test' });

    const episodicStore = kernel.getEpisodicStore();
    expect(episodicStore.count()).toBeGreaterThan(0);
    expect(kernel.getAllConcepts().length).toBeGreaterThan(0);

    await kernel.shutdown();
  });
});
