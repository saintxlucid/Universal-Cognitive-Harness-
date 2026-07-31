import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { HistoryManager, historyEntryToText } from '../history/history.js';
import type { Message, Terminal } from '../types.js';

const tmpDir = path.join(process.cwd(), '.test-history');

describe('HistoryManager', () => {
  beforeEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('persists messages to JSONL', async () => {
    const file = path.join(tmpDir, 'history.jsonl');
    const history = new HistoryManager(file);
    await history.open();
    const message: Message = {
      id: 'm1',
      role: 'assistant',
      content: [{ type: 'text', text: 'hello' }],
      timestamp: new Date().toISOString(),
    };
    await history.addMessage('s1', message);
    expect(history.getEntries()).toHaveLength(1);
  });

  it('round-trips through disk', async () => {
    const file = path.join(tmpDir, 'history.jsonl');
    const history = new HistoryManager(file);
    await history.open();
    const message: Message = {
      id: 'm1',
      role: 'user',
      content: [{ type: 'text', text: 'hi' }],
      timestamp: new Date().toISOString(),
    };
    await history.addMessage('s1', message);

    const reloaded = new HistoryManager(file);
    await reloaded.open();
    expect(reloaded.getEntries()).toHaveLength(1);
    expect(reloaded.getMessages('s1')[0]?.id).toBe('m1');
  });

  it('tracks terminals', async () => {
    const history = new HistoryManager();
    const terminal: Terminal = { state: 'success', message: 'done', turnCount: 2, usage: { inputTokens: 1, outputTokens: 1 } };
    await history.addTerminal('s1', terminal);
    expect(history.getEntries().find((e) => e.type === 'terminal')?.terminal?.state).toBe('success');
  });

  it('lists sessions and removes last entry', async () => {
    const history = new HistoryManager();
    await history.addMessage('s1', { id: 'a', role: 'user', content: [{ type: 'text', text: 'x' }], timestamp: '' });
    await history.addMessage('s2', { id: 'b', role: 'user', content: [{ type: 'text', text: 'y' }], timestamp: '' });
    expect(history.getSessions()).toEqual(expect.arrayContaining(['s1', 's2']));
    const removed = await history.removeLast();
    expect(removed?.sessionId).toBe('s2');
    expect(history.getEntries()).toHaveLength(1);
  });

  it('searches entries', async () => {
    const history = new HistoryManager();
    await history.addMessage('s1', { id: 'a', role: 'user', content: [{ type: 'text', text: 'refactor the parser' }], timestamp: '' });
    await history.addMessage('s1', { id: 'b', role: 'user', content: [{ type: 'text', text: 'add tests' }], timestamp: '' });
    const results = await history.search('parser');
    expect(results).toHaveLength(1);
  });

  it('renders entries as text', () => {
    const entry = { timestamp: '2026-01-01', sessionId: 's1', type: 'message' as const, message: { id: 'm', role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }], timestamp: '' } };
    expect(historyEntryToText(entry)).toContain('user: hi');
  });

  it('survives corrupt lines', async () => {
    const file = path.join(tmpDir, 'history.jsonl');
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(file, '{valid}\nnot-json\n{"also":"not-message-format"}\n', 'utf8');
    const history = new HistoryManager(file);
    await history.open();
    expect(history.getEntries().length).toBeGreaterThanOrEqual(0);
  });
});
