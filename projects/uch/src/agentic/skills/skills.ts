import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface SkillDefinition {
  name: string;
  description: string;
  arguments?: Record<string, { description: string; required?: boolean }>;
  effort?: 'low' | 'medium' | 'high';
  source?: string;
  prompt: string;
  filePath?: string;
  disabled?: boolean;
}

export interface ParsedSkillFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(content: string): ParsedSkillFile {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content.replace(/^\uFEFF/, ''));
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const raw = match[1] ?? '';
  const body = match[2] ?? '';
  const frontmatter: Record<string, unknown> = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key === 'arguments' || key === 'parameters') {
      try {
        frontmatter[key] = JSON.parse(value.replace(/&quot;/g, '"'));
      } catch {
        frontmatter[key] = {};
      }
    } else {
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body };
}

export function skillFromFile(filePath: string, content: string): SkillDefinition | null {
  const { frontmatter, body } = parseFrontmatter(content);
  const name = frontmatter.name;
  const description = frontmatter.description;
  if (typeof name !== 'string' || !name) return null;
  if (typeof description !== 'string' || !description) return null;
  return {
    name,
    description,
    arguments: (frontmatter.arguments as SkillDefinition['arguments']) ?? undefined,
    effort: (frontmatter.effort as SkillDefinition['effort']) ?? undefined,
    source: (frontmatter.source as string) ?? 'disk',
    prompt: body.trim(),
    filePath,
    disabled: frontmatter.disabled === true,
  };
}

export interface LoadSkillsOptions {
  includeDisabled?: boolean;
}

export async function loadSkillsDir(
  dir: string,
  options: LoadSkillsOptions = {},
): Promise<SkillDefinition[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true }).then((files) =>
      files.filter((f) => f.isDirectory()).map((f) => f.name),
    );
  } catch {
    return [];
  }

  const skills: SkillDefinition[] = [];
  for (const entry of entries) {
    const skillDir = path.join(dir, entry);
    const skillFile = path.join(skillDir, 'SKILL.md');
    const content = await fs.readFile(skillFile, 'utf8').catch(() => null);
    if (content === null) continue;
    const skill = skillFromFile(skillFile, content);
    if (!skill) continue;
    if (skill.disabled && !options.includeDisabled) continue;
    skills.push(skill);
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadSkillFile(filePath: string): Promise<SkillDefinition | null> {
  const content = await fs.readFile(filePath, 'utf8').catch(() => null);
  if (content === null) return null;
  return skillFromFile(filePath, content);
}

export function renderSkillPrompt(skill: SkillDefinition, args: Record<string, string> = {}): string {
  let prompt = skill.prompt;
  for (const [key, value] of Object.entries(args)) {
    prompt = prompt.split(`{{${key}}}`).join(value);
  }
  const argDocs = Object.entries(skill.arguments ?? {})
    .map(([key, def]) => `${key}: ${def.description}${def.required ? ' (required)' : ''}`)
    .join('\n');
  if (argDocs) {
    prompt = `Skill: ${skill.name}\nArguments:\n${argDocs}\n\n${prompt}`;
  }
  return prompt;
}

export function validateSkillArgs(
  skill: SkillDefinition,
  args: Record<string, string>,
): string | null {
  for (const [key, def] of Object.entries(skill.arguments ?? {})) {
    if (def.required && !args[key]) {
      return `Missing required skill argument: ${key}`;
    }
  }
  return null;
}

export interface SkillRegistry {
  register(skill: SkillDefinition): void;
  get(name: string): SkillDefinition | undefined;
  list(): SkillDefinition[];
  find(query: string): SkillDefinition[];
}

export function createSkillRegistry(initial: SkillDefinition[] = []): SkillRegistry {
  const skills = new Map<string, SkillDefinition>();
  for (const skill of initial) {
    if (!skill.disabled) skills.set(skill.name, skill);
  }
  return {
    register: (skill) => {
      if (!skill.disabled) skills.set(skill.name, skill);
    },
    get: (name) => skills.get(name),
    list: () => [...skills.values()].sort((a, b) => a.name.localeCompare(b.name)),
    find: (query) => {
      const needle = query.toLowerCase();
      return [...skills.values()].filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.description.toLowerCase().includes(needle) ||
          s.prompt.toLowerCase().includes(needle),
      );
    },
  };
}

export const BUNDLED_SKILLS: SkillDefinition[] = [
  {
    name: 'remember',
    description: 'Store an important fact or decision in long-term memory',
    arguments: {
      content: { description: 'What to remember', required: true },
      importance: { description: 'Importance 0-1', required: false },
    },
    source: 'bundled',
    prompt:
      'Use the Memory tool with action="remember" to store: {{content}} with importance {{importance|0.7}}.\n' +
      'Store facts, decisions, and outcomes. Do not store transient state.',
  },
  {
    name: 'recall',
    description: 'Search long-term memory for relevant past context',
    arguments: {
      query: { description: 'Search query', required: true },
    },
    source: 'bundled',
    prompt:
      'Use the Memory tool with action="recall" and query: {{query}}. ' +
      'Use the results to ground your answer.',
  },
  {
    name: 'plan',
    description: 'Break a task into a step-by-step plan',
    arguments: {
      task: { description: 'Task to plan', required: true },
    },
    source: 'bundled',
    prompt:
      'Break down the task into concrete steps. For each step, note the tool that would ' +
      'execute it and what success looks like. Task: {{task}}',
  },
  {
    name: 'verify',
    description: 'Verify a completed change or claim',
    arguments: {
      what: { description: 'What to verify', required: true },
    },
    source: 'bundled',
    prompt:
      'Verify {{what}} by inspecting the actual files or running commands. ' +
      'Report evidence for each claim, and do not trust assumptions.',
  },
  {
    name: 'simplify',
    description: 'Simplify complex code or text',
    arguments: {
      target: { description: 'What to simplify', required: true },
    },
    source: 'bundled',
    prompt:
      'Read {{target}}, identify unnecessary complexity (over-abstraction, dead code, ' +
      'redundant patterns), and apply minimal simplifications. Preserve behavior.',
  },
  {
    name: 'debug',
    description: 'Systematically debug an issue',
    arguments: {
      issue: { description: 'Issue description or error message', required: true },
    },
    source: 'bundled',
    prompt:
      'Debug systematically: 1) reproduce, 2) inspect relevant files, 3) form hypothesis, ' +
      '4) test with the smallest possible change, 5) verify fix. Issue: {{issue}}',
  },
  {
    name: 'code-review',
    description: 'Review code for bugs, security, and quality',
    arguments: {
      scope: { description: 'Files or changes to review', required: true },
    },
    source: 'bundled',
    prompt:
      'Review {{scope}} for correctness, security vulnerabilities, performance issues, ' +
      'and maintainability. Report findings severity-ordered with file:line references.',
  },
  {
    name: 'status',
    description: 'Report the current state of the environment and memory',
    arguments: {},
    source: 'bundled',
    prompt:
      'Report: git status, current task state from todos, and any relevant memory ' +
      'recalled for this session.',
  },
];

export function renderSkillCatalog(skills: SkillDefinition[]): string {
  return skills
    .map((s) => {
      const args = Object.entries(s.arguments ?? {})
        .map(([key, def]) => `${key}:${def.required ? '' : '?'}${def.description}`)
        .join(', ');
      return `- ${s.name}: ${s.description}${args ? ` (args: ${args})` : ''}`;
    })
    .join('\n');
}
