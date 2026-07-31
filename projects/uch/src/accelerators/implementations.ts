import type {
  Accelerator,
  AcceleratorKind,
  GatewayCompletion,
  ProviderGateway,
} from './types.js';

export function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text || typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function gatewayText(result: GatewayCompletion): string {
  return typeof result === 'string' ? result : result.text;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string').slice(0, 20);
}

function numberInRange(value: unknown, fallback: number): number {
  if (typeof value === 'number' && value >= 0 && value <= 1) return value;
  return fallback;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'from', 'this', 'that',
  'these', 'those', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'will',
  'would', 'should', 'could', 'can', 'may', 'might', 'must', 'not', 'our',
  'your', 'their', 'its', 'it', 'is', 'of', 'in', 'on', 'at', 'to', 'by', 'as',
  'we', 'you', 'they', 'he', 'she', 'who', 'which', 'when', 'where', 'how',
  'about', 'into', 'over', 'after', 'before', 'while', 'during', 'between',
]);

function extractEntitiesFallback(text: string): string[] {
  const candidates = text.split(/\b([A-Z][A-Za-z0-9_-]{2,})\b/);
  const seen = new Set<string>();
  const entities: string[] = [];
  for (const piece of candidates) {
    const word = piece.trim();
    if (!word || word.length < 3 || STOPWORDS.has(word.toLowerCase())) continue;
    if (seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    entities.push(word);
    if (entities.length >= 8) break;
  }
  return entities;
}

function extractTopicsFallback(text: string): string[] {
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 4 && !STOPWORDS.has(w));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);
}

function importanceFallback(text: string): number {
  if (/critical|error|fail|security|architecture|performance|breaking/i.test(text)) return 0.85;
  if (/prefer|improve|important|risk|bug|fix/i.test(text)) return 0.65;
  return 0.45;
}

export interface SemanticOutput {
  entities: string[];
  topics: string[];
  importance: number;
  confidence: number;
}

export class SemanticAccelerator implements Accelerator<{ text: string }, SemanticOutput> {
  readonly kind: AcceleratorKind = 'semantic';

  async execute(input: { text: string }, gateway: ProviderGateway): Promise<SemanticOutput> {
    const text = gatewayText(await gateway.complete({
      system: 'You are a semantic extraction unit. Return JSON only: {"entities": string[], "topics": string[], "importance": number 0-1, "confidence": number 0-1}.',
      user: input.text.slice(0, 8000),
      temperature: 0,
      maxTokens: 500,
    }));
    const parsed = extractJsonObject(text);
    if (!parsed) return this.fallback(input);
    return {
      entities: stringArray(parsed.entities),
      topics: stringArray(parsed.topics),
      importance: numberInRange(parsed.importance, 0.5),
      confidence: numberInRange(parsed.confidence, 0.7),
    };
  }

  async fallback(input: { text: string }): Promise<SemanticOutput> {
    const entities = extractEntitiesFallback(input.text);
    const topics = extractTopicsFallback(input.text);
    return {
      entities,
      topics,
      importance: importanceFallback(input.text),
      confidence: 0.4,
    };
  }
}

export interface CompressionOutput {
  summary: string;
  ratio: number;
  preservedPoints: string[];
  confidence: number;
}

export class CompressionAccelerator implements Accelerator<{ text: string; maxWords?: number }, CompressionOutput> {
  readonly kind: AcceleratorKind = 'compression';

  async execute(input: { text: string; maxWords?: number }, gateway: ProviderGateway): Promise<CompressionOutput> {
    const text = gatewayText(await gateway.complete({
      system: 'You are a memory compression unit. Compress the text preserving key points. Return JSON only: {"summary": string, "preservedPoints": string[], "confidence": number 0-1}.',
      user: input.text.slice(0, 12000),
      temperature: 0,
      maxTokens: input.maxWords ? Math.min(input.maxWords * 4, 1500) : 600,
    }));
    const parsed = extractJsonObject(text);
    if (!parsed) return this.fallback(input);
    const summary = typeof parsed.summary === 'string' ? parsed.summary : input.text.slice(0, 200);
    const points = stringArray(parsed.preservedPoints);
    const outWords = wordCount(summary);
    const inWords = wordCount(input.text);
    return {
      summary,
      ratio: inWords > 0 ? Math.min(1, outWords / inWords) : 0,
      preservedPoints: points,
      confidence: numberInRange(parsed.confidence, 0.7),
    };
  }

  async fallback(input: { text: string; maxWords?: number }): Promise<CompressionOutput> {
    const sentences = input.text.match(/[^.!?]+[.!?]+/g) ?? [];
    const points = input.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 40).slice(0, 3);
    const summary = sentences.slice(0, 2).join(' ').trim().slice(0, 300) || input.text.slice(0, 200);
    const inWords = wordCount(input.text);
    const outWords = wordCount(summary);
    return {
      summary,
      ratio: inWords > 0 ? Math.min(1, outWords / inWords) : 0,
      preservedPoints: points,
      confidence: 0.4,
    };
  }
}

export interface ReasoningStep {
  step: string;
  basis: string;
}

export interface ReasoningOutput {
  conclusion: string | null;
  confidence: number;
  steps: ReasoningStep[];
  undetermined: boolean;
}

export class ReasoningAccelerator implements Accelerator<{ question: string; premises: string[] }, ReasoningOutput> {
  readonly kind: AcceleratorKind = 'reasoning';

  async execute(input: { question: string; premises: string[] }, gateway: ProviderGateway): Promise<ReasoningOutput> {
    const text = gatewayText(await gateway.complete({
      system: 'You are a structured reasoning unit. Reason step by step from the premises only. Return JSON only: {"conclusion": string, "confidence": number 0-1, "steps": [{"step": string, "basis": string}]}.',
      user: `Question: ${input.question}\n\nPremises:\n${input.premises.map((p, i) => `${i + 1}. ${p}`).join('\n')}`,
      temperature: 0,
      maxTokens: 800,
    }));
    const parsed = extractJsonObject(text);
    if (!parsed) return this.fallback(input);
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
          .map((s) => ({ step: String(s.step ?? ''), basis: String(s.basis ?? '') }))
      : [];
    return {
      conclusion: typeof parsed.conclusion === 'string' ? parsed.conclusion : null,
      confidence: numberInRange(parsed.confidence, 0.6),
      steps,
      undetermined: false,
    };
  }

  async fallback(input: { question: string; premises: string[] }): Promise<ReasoningOutput> {
    const contradiction = input.premises.some((p) => /not|never|no\b/i.test(p))
      && input.premises.some((p) => /always|must|guaranteed/i.test(p));
    return {
      conclusion: contradiction ? 'Premises contradict each other' : null,
      confidence: contradiction ? 0.7 : 0.3,
      steps: input.premises.map((p) => ({ step: 'Considered premise', basis: p })),
      undetermined: !contradiction,
    };
  }
}

export interface PredictionOutput {
  prediction: string | null;
  confidence: number;
  horizon: string | null;
}

export class PredictionAccelerator implements Accelerator<{ context: string; question: string }, PredictionOutput> {
  readonly kind: AcceleratorKind = 'prediction';

  async execute(input: { context: string; question: string }, gateway: ProviderGateway): Promise<PredictionOutput> {
    const text = gatewayText(await gateway.complete({
      system: 'You are a prediction unit. Predict based on the context only. Return JSON only: {"prediction": string, "confidence": number 0-1, "horizon": string}.',
      user: `Context: ${input.context.slice(0, 8000)}\n\nQuestion: ${input.question}`,
      temperature: 0.2,
      maxTokens: 400,
    }));
    const parsed = extractJsonObject(text);
    if (!parsed) return this.fallback(input);
    return {
      prediction: typeof parsed.prediction === 'string' ? parsed.prediction : null,
      confidence: numberInRange(parsed.confidence, 0.5),
      horizon: typeof parsed.horizon === 'string' ? parsed.horizon : null,
    };
  }

  async fallback(input: { context: string; question: string }): Promise<PredictionOutput> {
    void input;
    return { prediction: null, confidence: 0, horizon: null };
  }
}

export interface MemoryMergeOutput {
  merge: string[][];
  duplicates: string[];
  recommendedAction: string[];
  confidence: number;
}

function normalizeMemory(text: string): string {
  return text.toLowerCase().replace(/\W+/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a: string, b: string): number {
  const na = normalizeMemory(a);
  const nb = normalizeMemory(b);
  if (!na || !nb) return 0;
  const sa = new Set(na.split(' '));
  const sb = new Set(nb.split(' '));
  const intersection = [...sa].filter((w) => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;
  return union > 0 ? intersection / union : 0;
}

export class MemoryAccelerator implements Accelerator<{ memories: string[] }, MemoryMergeOutput> {
  readonly kind: AcceleratorKind = 'memory';

  async execute(input: { memories: string[] }, gateway: ProviderGateway): Promise<MemoryMergeOutput> {
    const text = gatewayText(await gateway.complete({
      system: 'You are a memory consolidation unit. Group near-duplicate memories. Return JSON only: {"merge": string[][], "duplicates": string[], "recommendedAction": string[], "confidence": number 0-1}.',
      user: input.memories.map((m, i) => `${i}: ${m}`).join('\n'),
      temperature: 0,
      maxTokens: 800,
    }));
    const parsed = extractJsonObject(text);
    if (!parsed) return this.fallback(input);
    const merge = Array.isArray(parsed.merge)
      ? parsed.merge
          .filter((g): g is unknown[] => Array.isArray(g))
          .map((g) => g.filter((v): v is string => typeof v === 'string'))
      : [];
    return {
      merge,
      duplicates: stringArray(parsed.duplicates),
      recommendedAction: stringArray(parsed.recommendedAction),
      confidence: numberInRange(parsed.confidence, 0.7),
    };
  }

  async fallback(input: { memories: string[] }): Promise<MemoryMergeOutput> {
    const merge: string[][] = [];
    const duplicates: string[] = [];
    const used = new Set<number>();
    for (let i = 0; i < input.memories.length; i++) {
      if (used.has(i)) continue;
      const group = [input.memories[i]!];
      for (let j = i + 1; j < input.memories.length; j++) {
        if (used.has(j)) continue;
        if (similarity(input.memories[i]!, input.memories[j]!) >= 0.8) {
          group.push(input.memories[j]!);
          used.add(j);
          duplicates.push(input.memories[j]!);
        }
      }
      used.add(i);
      if (group.length > 1) merge.push(group);
    }
    return {
      merge,
      duplicates,
      recommendedAction: merge.length > 0 ? ['Consolidate duplicate memories into canonical entries'] : [],
      confidence: merge.length > 0 ? 0.8 : 0.5,
    };
  }
}

export interface Relationship {
  from: string;
  to: string;
  type: string;
  strength: number;
}

export interface OntologyOutput {
  relationships: Relationship[];
  confidence: number;
}

export class OntologyAccelerator implements Accelerator<{ objects: string[] }, OntologyOutput> {
  readonly kind: AcceleratorKind = 'ontology';

  async execute(input: { objects: string[] }, gateway: ProviderGateway): Promise<OntologyOutput> {
    const text = gatewayText(await gateway.complete({
      system: 'You are an ontology building unit. Infer relationships between the given objects. Return JSON only: {"relationships": [{"from": string, "to": string, "type": string, "strength": number 0-1}], "confidence": number 0-1}.',
      user: input.objects.join('\n'),
      temperature: 0,
      maxTokens: 600,
    }));
    const parsed = extractJsonObject(text);
    if (!parsed) return this.fallback(input);
    const relationships = Array.isArray(parsed.relationships)
      ? parsed.relationships
          .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
          .map((r) => ({
            from: String(r.from ?? ''),
            to: String(r.to ?? ''),
            type: String(r.type ?? 'related'),
            strength: numberInRange(r.strength, 0.5),
          }))
          .filter((r) => r.from && r.to)
      : [];
    return {
      relationships,
      confidence: numberInRange(parsed.confidence, 0.6),
    };
  }

  async fallback(input: { objects: string[] }): Promise<OntologyOutput> {
    const relationships: Relationship[] = [];
    const normalized = input.objects.map((o) => o.toLowerCase());
    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        const overlap = normalized[i]!.split(/\W+/).filter((w) => w.length > 3 && normalized[j]!.includes(w)).length;
        if (overlap > 0) {
          relationships.push({
            from: input.objects[i]!,
            to: input.objects[j]!,
            type: 'related',
            strength: Math.min(0.9, 0.4 + overlap * 0.15),
          });
        }
      }
    }
    return { relationships, confidence: relationships.length > 0 ? 0.5 : 0.3 };
  }
}

export interface ClassificationOutput {
  label: string | null;
  confidence: number;
  alternatives: string[];
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  security: ['auth', 'token', 'password', 'login', 'credential', 'permission', 'encrypt', 'secret', 'session', 'jwt', 'oauth', 'expired', 'reject', 'attack', 'threat', 'vulnerab', 'firewall', 'phish'],
  database: ['sql', 'query', 'schema', 'table', 'index', 'record', 'migration', 'transaction', 'postgres', 'mysql', 'sqlite', 'prisma', 'database', 'storage'],
  ui: ['button', 'page', 'render', 'component', 'layout', 'click', 'style', 'css', 'design', 'frontend', 'responsive'],
  frontend: ['react', 'vue', 'component', 'render', 'dom', 'html', 'css', 'javascript', 'typescript'],
  backend: ['server', 'api', 'endpoint', 'middleware', 'worker', 'queue', 'service'],
  performance: ['latency', 'benchmark', 'throughput', 'slow', 'optimiz', 'cache', 'bottleneck', 'profile'],
  testing: ['test', 'assert', 'coverage', 'suite', 'mock', 'e2e', 'unit'],
  api: ['endpoint', 'rest', 'graphql', 'route', 'http', 'request', 'response', 'header', 'json'],
  devops: ['deploy', 'pipeline', 'docker', 'kubernetes', 'terraform', 'ci', 'infra', 'monitor'],
  networking: ['tcp', 'socket', 'dns', 'bandwidth', 'proxy', 'load'],
  ai: ['model', 'llm', 'inference', 'token', 'prompt', 'embedding', 'training', 'neural'],
  data: ['dataset', 'pipeline', 'etl', 'analysis', 'statistics', 'feature', 'csv'],
};

export class ClassificationAccelerator implements Accelerator<{ text: string; categories: string[] }, ClassificationOutput> {
  readonly kind: AcceleratorKind = 'classification';

  async execute(input: { text: string; categories: string[] }, gateway: ProviderGateway): Promise<ClassificationOutput> {
    const text = gatewayText(await gateway.complete({
      system: 'You are a classification unit. Classify the text into one of the given categories. Return JSON only: {"label": string, "confidence": number 0-1, "alternatives": string[]}.',
      user: `Categories: ${input.categories.join(', ')}\n\nText: ${input.text.slice(0, 6000)}`,
      temperature: 0,
      maxTokens: 300,
    }));
    const parsed = extractJsonObject(text);
    if (!parsed) return this.fallback(input);
    return {
      label: typeof parsed.label === 'string' ? parsed.label : null,
      confidence: numberInRange(parsed.confidence, 0.6),
      alternatives: stringArray(parsed.alternatives),
    };
  }

  async fallback(input: { text: string; categories: string[] }): Promise<ClassificationOutput> {
    const text = input.text.toLowerCase();
    const scores = input.categories.map((category) => {
      const key = category.toLowerCase();
      const tokens = key.split(/\W+/).filter((w) => w.length > 3);
      const keywords = CATEGORY_KEYWORDS[key] ?? [];
      const hits = [...tokens, ...keywords].filter((t) => text.includes(t)).length;
      const total = tokens.length + keywords.length;
      return { category, score: total > 0 ? hits / total : 0 };
    });
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    if (!best || best.score === 0) {
      return { label: null, confidence: 0, alternatives: input.categories.slice(0, 3) };
    }
    return {
      label: best.category,
      confidence: Math.min(0.9, 0.4 + best.score * 0.5),
      alternatives: scores.slice(1, 4).map((s) => s.category),
    };
  }
}

export const ACCELERATORS = {
  semantic: new SemanticAccelerator(),
  compression: new CompressionAccelerator(),
  reasoning: new ReasoningAccelerator(),
  prediction: new PredictionAccelerator(),
  memory: new MemoryAccelerator(),
  ontology: new OntologyAccelerator(),
  classification: new ClassificationAccelerator(),
} as const;
