import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface SystemContext {
  cwd: string;
  gitStatus: string | null;
  date: string;
  cacheBreaker: string;
  projectGuidance: string | null;
}

export async function getSystemContext(cwd: string): Promise<SystemContext> {
  const gitStatus = await readGitStatus(cwd).catch(() => null);
  const projectGuidance = await findProjectGuidance(cwd);
  return {
    cwd,
    gitStatus,
    date: new Date().toISOString(),
    cacheBreaker: `context-${Date.now()}`,
    projectGuidance,
  };
}

export function getProjectGuidanceSearchPaths(cwd: string): string[] {
  const parts = cwd.split(path.sep).filter(Boolean);
  const paths: string[] = [];
  for (let i = parts.length; i > 0; i--) {
    const dir = path.join(path.sep, ...parts.slice(0, i));
    paths.push(path.join(dir, 'AGENTS.md'));
    paths.push(path.join(dir, 'CLAUDE.md'));
  }
  return paths;
}

export async function findProjectGuidance(cwd: string): Promise<string | null> {
  for (const candidate of getProjectGuidanceSearchPaths(cwd)) {
    try {
      const content = await fs.readFile(candidate, 'utf8');
      return `### ${candidate}\n${content}`;
    } catch {
      continue;
    }
  }
  return null;
}

export interface MemoryDirContents {
  memoryMd: string | null;
  memoriesDirFiles: string[];
}

export async function readMemoryDir(cwd: string): Promise<MemoryDirContents> {
  const memoryMdPath = path.join(cwd, 'MEMORY.md');
  const memoryMd = await fs.readFile(memoryMdPath, 'utf8').catch(() => null);
  const memoriesDir = path.join(cwd, 'memories');
  let memoriesDirFiles: string[];
  try {
    memoriesDirFiles = await fs.readdir(memoriesDir);
  } catch {
    memoriesDirFiles = [];
  }
  return { memoryMd, memoriesDirFiles };
}

async function readGitStatus(cwd: string): Promise<string | null> {
  const { execFile } = await import('node:child_process');
  return new Promise((resolve) => {
    execFile(
      'git',
      ['status', '--short', '--branch'],
      { cwd, timeout: 5000, windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve(stdout.slice(0, 4000));
      },
    );
  });
}

export interface SystemPromptParts {
  systemPrompt: string;
  userContext: string;
  systemContextText: string;
}

export async function fetchSystemPromptParts(options: {
  cwd: string;
  tools: { name: string; description: string }[];
  systemPrompt?: string;
  appendSystemPrompt?: string;
}): Promise<SystemPromptParts> {
  const ctx = await getSystemContext(options.cwd);
  const toolList = options.tools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join('\n');
  const systemContextText = [
    `Current date: ${ctx.date.slice(0, 10)}`,
    ctx.gitStatus ? `Git status:\n${ctx.gitStatus}` : null,
    ctx.projectGuidance ? `Project guidance:\n${ctx.projectGuidance}` : null,
  ].filter(Boolean).join('\n\n');

  const userContext = `You are operating in workspace: ${options.cwd}\n\n${systemContextText}`;

  const systemPrompt = options.systemPrompt
    ? options.systemPrompt
    : `You are a cognitive agent running inside UCH (Universal Cognitive Harness).\n` +
      `You can use tools to interact with the environment. Available tools:\n${toolList}\n\n` +
      `When you need to use a tool, emit a tool_call block (see protocol).\n` +
      `When done, emit your final answer as plain text.\n`;

  const withAppend = options.appendSystemPrompt
    ? `${systemPrompt}\n\n${options.appendSystemPrompt}`
    : systemPrompt;

  return { systemPrompt: withAppend, userContext, systemContextText };
}

export function getCacheBreakpointPrompt(): string {
  return `\n\n<cache_breakpoint>\n</cache_breakpoint>`;
}
