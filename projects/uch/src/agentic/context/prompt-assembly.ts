import type { Message } from '../types.js';
import type { Tool } from '../tools/types.js';

export interface PromptProfile {
  name: string;
  models?: string[];
  baseSystemPrompt?: string;
  suffix?: string;
  excludedTools?: string[];
  excludedMiddleware?: string[];
}

export interface AssemblyInput {
  userPrompt: string;
  profile: PromptProfile;
  profileBase?: PromptProfile;
}

export interface AssemblyResult {
  content: string;
  baseSystemPrompt: string;
  suffix: string;
  appliedProfile: PromptProfile;
}

export function profileMatchesModel(profile: PromptProfile, model: string): boolean {
  if (!profile.models || profile.models.length === 0) return true;
  const normalized = model.toLowerCase();
  return profile.models.some((candidate) => {
    const c = candidate.toLowerCase();
    if (c === normalized) return true;
    if (c.includes('*')) {
      const regex = new RegExp(`^${c.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
      return regex.test(normalized);
    }
    return false;
  });
}

export function findProfileForModel(profiles: PromptProfile[], model: string): PromptProfile | null {
  for (const profile of profiles) {
    if (profileMatchesModel(profile, model)) return profile;
  }
  return null;
}

export function assembleSystemPrompt(input: AssemblyInput): AssemblyResult {
  const { userPrompt, profile, profileBase } = input;
  const base = profile.baseSystemPrompt ?? profileBase?.baseSystemPrompt ?? '';
  const suffix = profile.suffix ?? profileBase?.suffix ?? '';
  const parts = [userPrompt, base, suffix]
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return {
    content: parts.join('\n\n'),
    baseSystemPrompt: base,
    suffix,
    appliedProfile: profile,
  };
}

export function assembleSystemMessage(input: AssemblyInput): Message {
  const { content } = assembleSystemPrompt(input);
  return {
    id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'system',
    content: [{ type: 'text', text: content }],
    timestamp: new Date().toISOString(),
    metadata: { profile: input.profile.name },
  };
}

export function applyProfileToolExclusions(profile: PromptProfile, tools: Tool[]): Tool[] {
  if (!profile.excludedTools || profile.excludedTools.length === 0) return [...tools];
  const excluded = new Set(profile.excludedTools);
  return tools.filter((tool) => !excluded.has(tool.name) && !tool.aliases?.some((alias) => excluded.has(alias)));
}
