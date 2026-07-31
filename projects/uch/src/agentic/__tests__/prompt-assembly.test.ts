import { describe, it, expect } from 'vitest';
import {
  assembleSystemPrompt,
  assembleSystemMessage,
  profileMatchesModel,
  findProfileForModel,
  applyProfileToolExclusions,
  type PromptProfile,
} from '../context/prompt-assembly.js';
import type { Tool } from '../tools/types.js';

const tools: Tool[] = [
  { name: 'read_file', description: 'r', inputSchema: { type: 'object', properties: {} }, call: async () => ({ data: '' }) },
  { name: 'write_file', aliases: ['write'], description: 'w', inputSchema: { type: 'object', properties: {} }, call: async () => ({ data: '' }) },
  { name: 'bash', description: 'b', inputSchema: { type: 'object', properties: {} }, call: async () => ({ data: '' }) },
];

describe('profileMatchesModel', () => {
  it('matches exact model names', () => {
    const profile: PromptProfile = { name: 'p', models: ['gpt-4o'] };
    expect(profileMatchesModel(profile, 'gpt-4o')).toBe(true);
    expect(profileMatchesModel(profile, 'claude-sonnet-4-5')).toBe(false);
  });

  it('matches wildcard patterns case-insensitively', () => {
    const profile: PromptProfile = { name: 'p', models: ['claude-*'] };
    expect(profileMatchesModel(profile, 'Claude-Sonnet-4-5')).toBe(true);
    expect(profileMatchesModel(profile, 'gpt-4o')).toBe(false);
  });

  it('matches all models when list is empty', () => {
    const profile: PromptProfile = { name: 'p' };
    expect(profileMatchesModel(profile, 'anything')).toBe(true);
  });
});

describe('findProfileForModel', () => {
  it('picks the first matching profile', () => {
    const profiles: PromptProfile[] = [
      { name: 'default' },
      { name: 'claude', models: ['claude-*'] },
    ];
    expect(findProfileForModel(profiles, 'claude-sonnet-4-5')?.name).toBe('default');
  });

  it('returns null when nothing matches', () => {
    const profiles: PromptProfile[] = [
      { name: 'only-openai', models: ['gpt-*'] },
    ];
    expect(findProfileForModel(profiles, 'llama')).toBeNull();
  });
});

describe('assembleSystemPrompt', () => {
  it('orders USER → BASE → SUFFIX', () => {
    const result = assembleSystemPrompt({
      userPrompt: 'user-part',
      profile: { name: 'p', baseSystemPrompt: 'base-part', suffix: 'suffix-part' },
    });
    expect(result.content).toBe('user-part\n\nbase-part\n\nsuffix-part');
  });

  it('falls back to profileBase for missing fields', () => {
    const result = assembleSystemPrompt({
      userPrompt: 'u',
      profile: { name: 'child', suffix: 's' },
      profileBase: { name: 'base', baseSystemPrompt: 'inherited-base' },
    });
    expect(result.content).toBe('u\n\ninherited-base\n\ns');
    expect(result.baseSystemPrompt).toBe('inherited-base');
    expect(result.suffix).toBe('s');
  });

  it('drops empty parts', () => {
    const result = assembleSystemPrompt({
      userPrompt: 'only',
      profile: { name: 'p' },
    });
    expect(result.content).toBe('only');
  });

  it('trims surrounding whitespace between parts', () => {
    const result = assembleSystemPrompt({
      userPrompt: '  u  ',
      profile: { name: 'p', baseSystemPrompt: ' b ' },
    });
    expect(result.content).toBe('u\n\nb');
  });
});

describe('assembleSystemMessage', () => {
  it('produces a system message with profile metadata', () => {
    const message = assembleSystemMessage({
      userPrompt: 'u',
      profile: { name: 'my-profile', baseSystemPrompt: 'b' },
    });
    expect(message.role).toBe('system');
    expect(message.metadata?.profile).toBe('my-profile');
    expect(message.content[0]).toMatchObject({ type: 'text', text: 'u\n\nb' });
  });
});

describe('applyProfileToolExclusions', () => {
  it('excludes tools by name', () => {
    const profile: PromptProfile = { name: 'p', excludedTools: ['bash'] };
    const result = applyProfileToolExclusions(profile, tools);
    expect(result.map((t) => t.name)).toEqual(['read_file', 'write_file']);
  });

  it('excludes tools by alias', () => {
    const profile: PromptProfile = { name: 'p', excludedTools: ['write'] };
    const result = applyProfileToolExclusions(profile, tools);
    expect(result.map((t) => t.name)).toEqual(['read_file', 'bash']);
  });

  it('returns a copy when nothing is excluded', () => {
    const profile: PromptProfile = { name: 'p' };
    const result = applyProfileToolExclusions(profile, tools);
    expect(result).toHaveLength(3);
    expect(result).not.toBe(tools);
  });
});
