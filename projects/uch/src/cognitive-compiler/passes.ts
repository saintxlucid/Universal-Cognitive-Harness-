// ─── CIR Optimizer: 17 cognitive passes (RFC-0004 §11) ─────────────────────
// Each pass is a pure function: CIRStream × PassContext → PassResult.
// Passes are deterministic (no wall clock, no randomness) and produce
// reports that become trace events (cir:pass).

import { buildInstruction, composite, streamEnergy, streamTokenEstimate, type CIRInstruction, type CIRStream, type Operand } from './cir.js';

export type PassId =
  | 'normalize' | 'deduplicate' | 'inject-context' | 'memory-entropy-reduction'
  | 'contradiction-elimination' | 'context-compression' | 'knowledge-promotion'
  | 'evidence-verification' | 'hallucination-detection' | 'goal-simplification'
  | 'architecture-validation' | 'task-fusion' | 'skill-injection'
  | 'reasoning-depth' | 'context-window-packing' | 'energy-optimization'
  | 'trust-reweighting';

export interface PassReport {
  pass: PassId;
  changed: boolean;
  rationale?: string;
  energyDelta: number;
  tokenDelta: number;
}

export interface PassResult {
  stream: CIRStream;
  report: PassReport;
}

export interface PassContext {
  provideVerified?: (instruction: CIRInstruction) => Operand[];
  contradictions?: (key: string) => boolean;
  verifiedFacts?: (key: string) => unknown;
  evidenceChain?: (key: string) => number;
  allowScopes?: Set<string>;
  skillsFor?: (op: string) => string[];
  stakeOf?: (goal: string) => 'low' | 'medium' | 'high';
  energyBudget?: number;
  trustOf?: (key: string) => number;
}

export interface OptimizerResult {
  stream: CIRStream;
  reports: PassReport[];
  energyBefore: number;
  energyAfter: number;
  tokenBefore: number;
  tokenAfter: number;
}

const MAX_ITERATIONS = 4;

function cloneStream(stream: CIRStream): CIRStream {
  return JSON.parse(JSON.stringify(stream)) as CIRStream;
}

function reportFor(pass: PassId, before: CIRStream, after: CIRStream, changed: boolean, rationale?: string): PassReport {
  return {
    pass,
    changed,
    ...(rationale ? { rationale } : {}),
    energyDelta: streamEnergy(after) - streamEnergy(before),
    tokenDelta: streamTokenEstimate(after) - streamTokenEstimate(before),
  };
}

function identical(a: Operand, b: Operand): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function operandsKey(operands: Operand[]): string {
  return JSON.stringify(operands);
}

function rewriteDepends(stream: CIRStream, oldId: string, newId: string): CIRStream {
  const rewritten = cloneStream(stream);
  for (const instr of rewritten.instructions) {
    if (instr.depends?.includes(oldId)) {
      instr.depends = instr.depends.map((d) => (d === oldId ? newId : d));
    }
  }
  return rewritten;
}

// ── P1 Normalize ────────────────────────────────────────────────────────────

function normalize(stream: CIRStream, _ctx: PassContext): PassResult {
  let changed = false;
  const normalized = cloneStream(stream);
  for (const instr of normalized.instructions) {
    const sorted = [...instr.operands].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (sorted.some((op, i) => !identical(op, instr.operands[i]!))) changed = true;
    instr.operands = sorted;
    if (instr.depends) {
      const deps = [...new Set(instr.depends)].sort();
      if (JSON.stringify(deps) !== JSON.stringify(instr.depends)) changed = true;
      instr.depends = deps;
    }
  }
  return { stream: normalized, report: reportFor('normalize', stream, normalized, changed, changed ? 'canonical operand order' : undefined) };
}

// ── P2 Deduplicate ──────────────────────────────────────────────────────────

function deduplicate(stream: CIRStream, _ctx: PassContext): PassResult {
  const seen = new Map<string, string>();
  let changed = false;
  let next = cloneStream(stream);
  for (const instr of [...next.instructions]) {
    const key = `${instr.op}:${instr.scope}:${operandsKey(instr.operands)}`;
    const existing = seen.get(key);
    if (existing !== undefined) {
      next = rewriteDepends(next, instr.id, existing);
      next.instructions = next.instructions.filter((i) => i.id !== instr.id);
      changed = true;
    } else {
      seen.set(key, instr.id);
    }
  }
  return { stream: next, report: reportFor('deduplicate', stream, next, changed, changed ? 'merged identical instructions' : undefined) };
}

// ── P3 Inject Context ───────────────────────────────────────────────────────

function injectContext(stream: CIRStream, ctx: PassContext): PassResult {
  if (!ctx.provideVerified) return { stream, report: reportFor('inject-context', stream, stream, false) };
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    if (!instr.operands.some((op) => op.kind === 'query')) continue;
    const injected = ctx.provideVerified(instr);
    if (injected.length === 0) continue;
    instr.operands = [...instr.operands, ...injected];
    changed = true;
  }
  return { stream: next, report: reportFor('inject-context', stream, next, changed, changed ? 'attached verified memory operands' : undefined) };
}

// ── P4 Memory Entropy Reduction ─────────────────────────────────────────────

function memoryEntropyReduction(stream: CIRStream, _ctx: PassContext): PassResult {
  const seen = new Map<string, string>();
  let changed = false;
  let next = cloneStream(stream);
  for (const instr of [...next.instructions]) {
    if (instr.op !== 'retrieve') continue;
    const queryTexts = instr.operands.filter((op): op is Extract<Operand, { kind: 'query' }> => op.kind === 'query').map((op) => op.text.toLowerCase().trim());
    if (queryTexts.length === 0) continue;
    const key = queryTexts.join('|');
    const existing = seen.get(key);
    if (existing !== undefined) {
      next = rewriteDepends(next, instr.id, existing);
      next.instructions = next.instructions.filter((i) => i.id !== instr.id);
      changed = true;
    } else {
      seen.set(key, instr.id);
    }
  }
  return { stream: next, report: reportFor('memory-entropy-reduction', stream, next, changed, changed ? 'collapsed redundant retrievals to one strong source' : undefined) };
}

// ── P5 Contradiction Elimination ────────────────────────────────────────────

function contradictionElimination(stream: CIRStream, ctx: PassContext): PassResult {
  if (!ctx.contradictions) return { stream, report: reportFor('contradiction-elimination', stream, stream, false) };
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    for (const operand of instr.operands) {
      if (operand.kind !== 'ref') continue;
      if (!ctx.contradictions(operand.key)) continue;
      const idx = instr.operands.indexOf(operand);
      instr.operands[idx] = { kind: 'literal', value: { quarantined: true, key: operand.key } };
      changed = true;
    }
  }
  return { stream: next, report: reportFor('contradiction-elimination', stream, next, changed, changed ? 'quarantined conflicting beliefs' : undefined) };
}

// ── P6 Context Compression ──────────────────────────────────────────────────

function contextCompression(stream: CIRStream, _ctx: PassContext): PassResult {
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    const literals = instr.operands.filter((op) => op.kind === 'literal');
    if (literals.length < 2) continue;
    const merged = { kind: 'literal' as const, value: Object.assign({}, ...literals.map((l) => (typeof l.value === 'object' && l.value !== null ? l.value : { value: l.value }))) };
    instr.operands = [merged, ...instr.operands.filter((op) => op.kind !== 'literal')];
    changed = true;
  }
  return { stream: next, report: reportFor('context-compression', stream, next, changed, changed ? 'merged literal operands into one context object' : undefined) };
}

// ── P7 Knowledge Promotion ──────────────────────────────────────────────────

function knowledgePromotion(stream: CIRStream, ctx: PassContext): PassResult {
  if (!ctx.verifiedFacts) return { stream, report: reportFor('knowledge-promotion', stream, stream, false) };
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    const promoted: Operand[] = [];
    for (const operand of instr.operands) {
      if (operand.kind !== 'ref') continue;
      const fact = ctx.verifiedFacts(operand.key);
      if (fact === undefined) continue;
      promoted.push({ kind: 'literal', value: { verified_fact: fact } });
      changed = true;
    }
    if (promoted.length > 0) instr.operands = [...instr.operands, ...promoted];
  }
  return { stream: next, report: reportFor('knowledge-promotion', stream, next, changed, changed ? 'promoted verified facts into operands' : undefined) };
}

// ── P8 Evidence Verification ────────────────────────────────────────────────

const KNOWN_STORE_PREFIXES = ['memory:', 'belief:', 'knowledge:', 'skill:', 'episode:', 'graph:'];

function evidenceVerification(stream: CIRStream, ctx: PassContext): PassResult {
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    for (const operand of instr.operands) {
      if (operand.kind !== 'ref') continue;
      const chain = ctx.evidenceChain ? ctx.evidenceChain(operand.key) : undefined;
      const known = KNOWN_STORE_PREFIXES.some((p) => operand.key.startsWith(p));
      if (chain !== undefined && chain > 0) continue;
      if (chain === undefined && known) continue;
      instr.operands = [...instr.operands, { kind: 'literal', value: { evidence_gap: true, key: operand.key } }];
      changed = true;
    }
  }
  return { stream: next, report: reportFor('evidence-verification', stream, next, changed, changed ? 'flagged operands without evidence chains' : undefined) };
}

// ── P9 Hallucination Detection ──────────────────────────────────────────────

function hallucinationDetection(stream: CIRStream, _ctx: PassContext): PassResult {
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    const delegated = instr.op === 'infer' || instr.op === 'evaluate' || instr.op === 'critique' || instr.op === 'predict';
    if (!delegated) continue;
    if (instr.provenance) continue;
    instr.operands = [...instr.operands, { kind: 'literal', value: { hallucination_risk: true, reason: 'no provenance' } }];
    changed = true;
  }
  return { stream: next, report: reportFor('hallucination-detection', stream, next, changed, changed ? 'flagged delegated instructions lacking provenance' : undefined) };
}

// ── P10 Goal Simplification ─────────────────────────────────────────────────

const GOAL_SPLIT = /\band\b|,\s*/i;

function goalSimplification(stream: CIRStream, _ctx: PassContext): PassResult {
  let changed = false;
  const next = cloneStream(stream);
  const plans = next.instructions.filter((i) => i.op === 'plan');
  for (const plan of plans) {
    const queryOp = plan.operands.find((op): op is Extract<Operand, { kind: 'query' }> => op.kind === 'query');
    if (!queryOp) continue;
    const parts = queryOp.text.split(GOAL_SPLIT).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const primitives = parts.map((goal, index) =>
      buildInstruction({
        id: `${plan.id}.g${index}`,
        op: 'plan',
        // Fresh policy object: encodeStream's stableStringify rejects any
        // object referenced by more than one instruction.
        operands: [{ kind: 'query', text: goal, policy: { ...queryOp.policy } }],
        scope: plan.scope,
        ...(index > 0 ? { depends: [`${plan.id}.g${index - 1}`] } : { depends: plan.depends }),
      }),
    );
    const idx = next.instructions.findIndex((i) => i.id === plan.id);
    next.instructions.splice(idx, 1, ...primitives);
    for (const dependent of next.instructions) {
      if (dependent.depends?.includes(plan.id)) {
        dependent.depends = [...dependent.depends.filter((d) => d !== plan.id), primitives[primitives.length - 1]!.id];
      }
    }
    changed = true;
  }
  return { stream: next, report: reportFor('goal-simplification', stream, next, changed, changed ? 'reduced compound goals to primitives' : undefined) };
}

// ── P11 Architecture Validation ─────────────────────────────────────────────

function architectureValidation(stream: CIRStream, ctx: PassContext): PassResult {
  if (!ctx.allowScopes) return { stream, report: reportFor('architecture-validation', stream, stream, false) };
  const next = cloneStream(stream);
  const before = next.instructions.length;
  next.instructions = next.instructions.filter((instr) => ctx.allowScopes?.has(instr.scope));
  const changed = next.instructions.length !== before;
  return { stream: next, report: reportFor('architecture-validation', stream, next, changed, changed ? 'rejected out-of-projection instructions' : undefined) };
}

// ── P12 Task Fusion ─────────────────────────────────────────────────────────

function taskFusion(stream: CIRStream, _ctx: PassContext): PassResult {
  let changed = false;
  const next = cloneStream(stream);
  const fused: CIRInstruction[] = [];
  let run: CIRInstruction[] = [];
  const flush = (): void => {
    if (run.length < 2) {
      fused.push(...run);
    } else {
      const head = run[0]!;
      // External dependents must not reference fused (removed) ids: every
      // instruction outside the run whose depends mentions a fused id is
      // redirected to the surviving head id. Without this, a stream where a
      // non-plan instruction depends on a fused plan fails validation
      // ("depends on unknown instruction") after optimization.
      const fusedIds = new Set(run.map((r) => r.id));
      fusedIds.delete(head.id);
      for (const instr of next.instructions) {
        if (fusedIds.has(instr.id)) continue;
        if (!instr.depends) continue;
        const redirects = instr.depends.filter((d) => fusedIds.has(d));
        if (redirects.length === 0) continue;
        instr.depends = [...new Set([...instr.depends.filter((d) => !fusedIds.has(d)), head.id])];
      }
      // The composite stream must be self-contained: any object shared with
      // the outer stream (header or operand references) makes encodeStream's
      // stableStringify treat the stream as circular.
      const compositeOperand = composite(
        cloneStream({ header: next.header, instructions: run }),
        head.scope,
      );
      fused.push({
        ...head,
        operands: [...head.operands, compositeOperand],
      });
      changed = true;
    }
    run = [];
  };
  for (const instr of next.instructions) {
    if (instr.op === 'plan' && instr.scope === run[0]?.scope) run.push(instr);
    else {
      flush();
      run = instr.op === 'plan' ? [instr] : [];
      if (instr.op !== 'plan') fused.push(instr);
    }
  }
  flush();
  next.instructions = fused;
  return { stream: next, report: reportFor('task-fusion', stream, next, changed, changed ? 'fused adjacent sub-goals into composite instructions' : undefined) };
}

// ── P13 Skill Injection ─────────────────────────────────────────────────────

function skillInjection(stream: CIRStream, ctx: PassContext): PassResult {
  if (!ctx.skillsFor) return { stream, report: reportFor('skill-injection', stream, stream, false) };
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    const skills = ctx.skillsFor(instr.op);
    if (skills.length === 0) continue;
    instr.operands = [...instr.operands, { kind: 'literal', value: { skills } }];
    changed = true;
  }
  return { stream: next, report: reportFor('skill-injection', stream, next, changed, changed ? 'bound proven skills to matching instructions' : undefined) };
}

// ── P14 Reasoning Depth ─────────────────────────────────────────────────────

function reasoningDepth(stream: CIRStream, ctx: PassContext): PassResult {
  if (!ctx.stakeOf) return { stream, report: reportFor('reasoning-depth', stream, stream, false) };
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    if (instr.op !== 'plan') continue;
    const queryOp = instr.operands.find((op): op is Extract<Operand, { kind: 'query' }> => op.kind === 'query');
    if (!queryOp) continue;
    const stake = ctx.stakeOf(queryOp.text);
    if (stake === 'low') continue;
    const depth = stake === 'high' ? 3 : 2;
    if (instr.deadline !== depth) {
      instr.deadline = depth;
      changed = true;
    }
  }
  return { stream: next, report: reportFor('reasoning-depth', stream, next, changed, changed ? 'allocated reasoning depth by stake' : undefined) };
}

// ── P15 Context Window Packing ──────────────────────────────────────────────

function contextWindowPacking(stream: CIRStream, _ctx: PassContext): PassResult {
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    for (const operand of instr.operands) {
      if (operand.kind !== 'query') continue;
      const packed = operand.text.replace(/\s+/g, ' ').trim();
      if (packed !== operand.text) {
        operand.text = packed;
        changed = true;
      }
    }
  }
  return { stream: next, report: reportFor('context-window-packing', stream, next, changed, changed ? 'packed query text into the tightest window' : undefined) };
}

// ── P16 Energy Optimization ─────────────────────────────────────────────────

function energyOptimization(stream: CIRStream, ctx: PassContext): PassResult {
  const budget = ctx.energyBudget;
  if (budget === undefined) return { stream, report: reportFor('energy-optimization', stream, stream, false) };
  let next = cloneStream(stream);
  let changed = false;
  while (streamEnergy(next) > budget) {
    const droppable = next.instructions.filter((i) => i.op === 'status' || i.op === 'ping' || i.op === 'list');
    if (droppable.length === 0) break;
    const dropId = droppable[0]!.id;
    next.instructions = next.instructions.filter((i) => i.id !== dropId);
    next = rewriteDepends(next, dropId, next.instructions[0]?.id ?? dropId);
    changed = true;
  }
  return { stream: next, report: reportFor('energy-optimization', stream, next, changed, changed ? 'dropped housekeeping instructions to meet budget' : undefined) };
}

// ── P17 Trust Reweighting ───────────────────────────────────────────────────

function trustReweighting(stream: CIRStream, ctx: PassContext): PassResult {
  if (!ctx.trustOf) return { stream, report: reportFor('trust-reweighting', stream, stream, false) };
  let changed = false;
  const next = cloneStream(stream);
  for (const instr of next.instructions) {
    for (const operand of instr.operands) {
      if (operand.kind !== 'ref') continue;
      const trust = ctx.trustOf(operand.key);
      if (trust >= 0.5) continue;
      instr.operands = [...instr.operands, { kind: 'literal', value: { trust: trust, low_trust: true } }];
      changed = true;
    }
  }
  return { stream: next, report: reportFor('trust-reweighting', stream, next, changed, changed ? 'scaled authority of low-trust operands' : undefined) };
}

// ── Registry + pipeline ─────────────────────────────────────────────────────

export const PASSES: ReadonlyArray<{ id: PassId; run: (stream: CIRStream, ctx: PassContext) => PassResult; peephole?: boolean }> = [
  { id: 'normalize', run: normalize },
  { id: 'deduplicate', run: deduplicate },
  { id: 'inject-context', run: injectContext },
  { id: 'memory-entropy-reduction', run: memoryEntropyReduction },
  { id: 'contradiction-elimination', run: contradictionElimination },
  { id: 'context-compression', run: contextCompression },
  { id: 'knowledge-promotion', run: knowledgePromotion },
  { id: 'evidence-verification', run: evidenceVerification },
  { id: 'hallucination-detection', run: hallucinationDetection },
  { id: 'goal-simplification', run: goalSimplification },
  { id: 'architecture-validation', run: architectureValidation },
  { id: 'task-fusion', run: taskFusion },
  { id: 'skill-injection', run: skillInjection },
  { id: 'reasoning-depth', run: reasoningDepth },
  { id: 'context-window-packing', run: contextWindowPacking, peephole: true },
  { id: 'energy-optimization', run: energyOptimization },
  { id: 'trust-reweighting', run: trustReweighting },
];

export const PASS_ORDER: readonly PassId[] = PASSES.map((p) => p.id);

export function runPasses(stream: CIRStream, ctx: PassContext = {}): OptimizerResult {
  const energyBefore = streamEnergy(stream);
  const tokenBefore = streamTokenEstimate(stream);
  let current = cloneStream(stream);
  const reports: PassReport[] = [];

  for (const spec of PASSES) {
    if (spec.peephole) {
      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
        const result = spec.run(current, ctx);
        reports.push(result.report);
        current = result.stream;
        if (!result.report.changed) break;
        if (iteration === MAX_ITERATIONS - 1) {
          reports.push({ pass: spec.id, changed: false, rationale: 'no_fixpoint after max iterations', energyDelta: 0, tokenDelta: 0 });
        }
      }
    } else {
      const result = spec.run(current, ctx);
      reports.push(result.report);
      current = result.stream;
    }
  }

  return {
    stream: current,
    reports,
    energyBefore,
    energyAfter: streamEnergy(current),
    tokenBefore,
    tokenAfter: streamTokenEstimate(current),
  };
}
