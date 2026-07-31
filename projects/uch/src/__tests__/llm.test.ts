import { describe, it, expect, vi, afterEach } from 'vitest';
import { LLMClient } from '../llm/provider.js';
import { Embedder } from '../embeddings/embedder.js';
import { SessionManager } from '../session/manager.js';
import { GitIngester } from '../git/ingester.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';

describe('LLMClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates without API key (no-op mode)', () => {
    vi.stubEnv('OPENAI_API_KEY', undefined);
    vi.stubEnv('ANTHROPIC_API_KEY', undefined);
    const llm = new LLMClient();
    expect(llm.isAvailable).toBe(false);
    expect(llm.provider).toBeDefined();
    expect(llm.modelName).toBeDefined();
  });

  it('passes through explicit model without rewriting', () => {
    const llm = new LLMClient({ provider: 'anthropic', apiKey: 'test-key', model: 'my-custom-model' });
    expect(llm.modelName).toBe('my-custom-model');
    expect(llm.provider).toBe('anthropic');
  });

  it('uses provider default model when none given', () => {
    const anthropic = new LLMClient({ provider: 'anthropic', apiKey: 'test-key' });
    expect(anthropic.modelName).toBe('claude-sonnet-4-5');
    const openai = new LLMClient({ provider: 'openai', apiKey: 'test-key' });
    expect(openai.modelName).toBe('gpt-4o');
  });

  it('respects UCH_LLM_MODEL env override', () => {
    vi.stubEnv('UCH_LLM_MODEL', 'my-env-model');
    const llm = new LLMClient({ provider: 'openai', apiKey: 'test-key' });
    expect(llm.modelName).toBe('my-env-model');
  });
});

describe('Embedder', () => {
  it('falls back to local hash embeddings when no LLM', () => {
    const embedder = new Embedder();
    expect(embedder.useLocalFallback).toBe(true);
  });

  it('generates deterministic embeddings locally', async () => {
    const embedder = new Embedder();
    const v1 = await embedder.embed('hello world');
    const v2 = await embedder.embed('hello world');
    const v3 = await embedder.embed('different text');

    expect(v1).toHaveLength(1536);
    expect(v1).toEqual(v2);
    expect(v1).not.toEqual(v3);
  });

  it('computes cosine similarity correctly', () => {
    const embedder = new Embedder();
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    const c = [0, 1, 0];

    expect(embedder.cosineSimilarity(a, b)).toBeCloseTo(1, 5);
    expect(embedder.cosineSimilarity(a, c)).toBeCloseTo(0, 5);
  });

  it('searches by similarity', async () => {
    const embedder = new Embedder();
    const items = [
      { id: '1', text: 'deployment failed during rollout' },
      { id: '2', text: 'user authentication flow' },
      { id: '3', text: 'database migration complete' },
    ];

    const results = await embedder.search('deployment', items, 2);
    expect(results).toHaveLength(2);
    expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
  });

  it('batch embeds multiple texts', async () => {
    const embedder = new Embedder();
    const vectors = await embedder.embedBatch(['a', 'b', 'c']);
    expect(vectors).toHaveLength(3);
    for (const v of vectors) {
      expect(v).toHaveLength(1536);
    }
  });

  it('clears cache', async () => {
    const embedder = new Embedder();
    await embedder.embed('test');
    embedder.clearCache();
    // No crash means success
  });
});

describe('SessionManager', () => {
  it('creates and manages sessions', () => {
    const sm = new SessionManager({ baseDir: '.uccp-test/sessions' });
    const session = sm.startSession('test-tool', 'ws-1');
    expect(session.id).toBeTruthy();
    expect(session.toolName).toBe('test-tool');
  });

  it('adds conversation entries', () => {
    const sm = new SessionManager({ baseDir: '.uccp-test/sessions' });
    sm.startSession('test', 'ws-1');
    sm.addEntry({ role: 'user', content: 'hello' });
    sm.addEntry({ role: 'assistant', content: 'hi there' });
    expect(sm.getSession()?.conversation).toHaveLength(2);
  });

  it('adds memories', () => {
    const sm = new SessionManager({ baseDir: '.uccp-test/sessions' });
    sm.startSession('test', 'ws-1');
    const key = sm.addMemory({ value: 'Use TypeScript strict mode', type: 'convention', importance: 0.9 });
    expect(key).toBeTruthy();
    expect(sm.getSession()?.memories).toHaveLength(1);
  });

  it('exports handoff document', () => {
    const sm = new SessionManager({ baseDir: '.uccp-test/sessions' });
    sm.startSession('opencode', 'ws-1');
    sm.addMemory({ value: 'Use vitest for testing', type: 'convention', importance: 0.8 });
    sm.addMemory({ value: 'Switch to ESM modules', type: 'decision', importance: 0.9 });
    sm.addEntry({ role: 'user', content: 'fix the build' });
    sm.addEntry({ role: 'assistant', content: 'fixed' });
    const handoff = sm.exportSessionHandoff();
    expect(handoff).toContain('Session Handoff');
    expect(handoff).toContain('opencode');
    expect(handoff).toContain('Use vitest');
    expect(handoff).toContain('Switch to ESM');
  });

  it('saves and loads sessions', async () => {
    const sm = new SessionManager({ baseDir: '.uccp-test/sessions' });
    sm.startSession('test', 'ws-1');
    sm.addMemory({ value: 'test memory', type: 'fact', importance: 0.5 });
    const filePath = await sm.saveSession('test-session');
    expect(filePath).toBeTruthy();

    const sm2 = new SessionManager({ baseDir: '.uccp-test/sessions' });
    const loaded = await sm2.loadSession('test-session');
    expect(loaded).not.toBeNull();
    expect(loaded!.memories).toHaveLength(1);
    expect(loaded!.memories[0]!.value).toBe('test memory');
  });

  it('lists sessions', () => {
    const sm = new SessionManager({ baseDir: '.uccp-test/sessions' });
    const sessions = sm.listSessions();
    expect(Array.isArray(sessions)).toBe(true);
  });

  it('sets context', () => {
    const sm = new SessionManager({ baseDir: '.uccp-test/sessions' });
    sm.startSession('test', 'ws-1');
    sm.setContext('project', 'uch');
    expect(sm.getSession()?.context.project).toBe('uch');
  });

  it('errors without active session for entries', () => {
    const sm = new SessionManager({ baseDir: '.uccp-test/sessions' });
    expect(() => sm.addEntry({ role: 'user', content: 'x' })).toThrow('No active session');
  });
});

describe('GitIngester', () => {
  it('parses conventional commits', () => {
    const kernel = new CognitiveKernel({
      agent_id: 'test', user_id: 'test', project_id: 'test',
    });
    const ingester = new GitIngester({ kernel, repoPath: process.cwd() });

    const feat = ingester.parseConventionalCommit('feat(auth): add login flow');
    expect(feat.type).toBe('feat');
    expect(feat.scope).toBe('auth');
    expect(feat.breaking).toBe(false);
    expect(feat.description).toBe('add login flow');

    const breaking = ingester.parseConventionalCommit('feat!: breaking change');
    expect(breaking.breaking).toBe(true);

    const fix = ingester.parseConventionalCommit('fix: resolve memory leak');
    expect(fix.type).toBe('fix');
    expect(fix.scope).toBeUndefined();

    const plain = ingester.parseConventionalCommit('just a message');
    expect(plain.type).toBe('other');
    expect(plain.breaking).toBe(false);
  });
});
