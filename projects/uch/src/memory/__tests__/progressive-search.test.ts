import { describe, it, expect } from 'vitest';
import { EpisodicStore } from '../../kernel/storage/episodic-store.js';
import { createProvenance } from '../../kernel/types/provenance.js';
import { ProgressiveMemorySearch, stripPrivate, scoreText } from '../progressive-search.js';

function makeStore(): EpisodicStore {
  const store = new EpisodicStore();
  void store.append({
    content: { type: 'observation', observation: 'Fixed the authentication bug in login flow' },
    session_id: 's1',
    project_id: 'proj-a',
    provenance: createProvenance('user', 'test'),
  });
  void store.append({
    content: { type: 'observation', observation: 'Deployed the new dashboard to production' },
    session_id: 's1',
    project_id: 'proj-a',
    provenance: createProvenance('user', 'test'),
  });
  void store.append({
    content: { type: 'observation', observation: 'Meeting with Alice about pricing tiers' },
    session_id: 's2',
    project_id: 'proj-b',
    provenance: createProvenance('user', 'test'),
  });
  return store;
}

describe('stripPrivate', () => {
  it('removes private blocks', () => {
    expect(stripPrivate('public text <private>secret</private> more')).toBe('public text [private] more');
  });
});

describe('scoreText', () => {
  it('scores matching terms and phrase bonus', () => {
    const result = scoreText('authentication bug', 'the authentication bug appeared twice');
    expect(result.terms).toContain('authentication');
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns zero for non-matches', () => {
    const result = scoreText('pricing tiers', 'nothing about deploy here');
    expect(result.score).toBe(0);
  });
});

describe('ProgressiveMemorySearch', () => {
  it('layer 1: returns compact index with token estimates', () => {
    const searcher = new ProgressiveMemorySearch(makeStore());
    const result = searcher.search('authentication bug', { limit: 5 });
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.entries[0]?.id).toBeDefined();
    expect(result.entries[0]?.tokenEstimate).toBeGreaterThan(0);
    expect(result.tokenCostHint).toContain('fetch details only for relevant IDs');
  });

  it('filters by project', () => {
    const searcher = new ProgressiveMemorySearch(makeStore());
    const result = searcher.search('meeting', { limit: 5, projectId: 'proj-b' });
    expect(result.totalMatches).toBe(1);
    expect(result.entries[0]?.sessionId).toBe('s2');
  });

  it('layer 2: builds timeline around an anchor', () => {
    const store = makeStore();
    const episodes = store.getRecent(10);
    const anchor = episodes.find((e) => e.session_id === 's1')!;
    const searcher = new ProgressiveMemorySearch(store);
    const timeline = searcher.timeline({ anchorId: anchor.id, before: 5, after: 3 });
    expect(timeline.some((t) => t.relation === 'anchor')).toBe(true);
    expect(timeline.every((t) => t.sessionId === 's1')).toBe(true);
  });

  it('layer 3: fetches full observations for requested IDs only', () => {
    const store = makeStore();
    const episodes = store.getRecent(10);
    const searcher = new ProgressiveMemorySearch(store);
    const details = searcher.getObservations([episodes[0]!.id, 'missing-id']);
    expect(details).toHaveLength(1);
    expect(details[0]?.id).toBe(episodes[0]!.id);
  });

  it('timeline returns empty for unknown anchor', () => {
    const searcher = new ProgressiveMemorySearch(makeStore());
    expect(searcher.timeline({ anchorId: 'nope' })).toHaveLength(0);
  });
});
