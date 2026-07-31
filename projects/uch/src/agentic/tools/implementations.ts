import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_DENYLIST, normalizeCommand } from '../../coding/command-runner.js';
import { buildTool, type ToolUseContext } from './types.js';

const isWindows = process.platform === 'win32';

export const MAX_BASH_TIMEOUT_MS = 600_000;

const BASH_DENYLIST: RegExp[] = [
  ...DEFAULT_DENYLIST,
  /\b(?:curl|wget|iwr|Invoke-WebRequest)\b[^\r\n]*(?:&&|\|\||;)[^\r\n]*(?:\bsh\b|\bbash\b|\bpowershell\b|\bcmd\b)/i,
  /\b(?:iwr|Invoke-WebRequest)\b[^\r\n;|&<>]*\|\s*(?:powershell|cmd)\b/i,
  /\bremove-item\b[^\r\n]*\b(?:recurse|force)\b/i,
  /\bdel\s+\/s\b/i,
  /\brm\s+-[a-z]*rf[a-z]*\s+~(?:\/|$)/i,
];

function hasUnquotedInjectionMetachar(command: string): boolean {
  let quote: string | null = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ';' || ch === '`' || ch === '\n' || ch === '\r') return true;
    if (ch === '$' && command[i + 1] === '(') return true;
  }
  return false;
}

export function bashBlockReason(command: string): string | null {
  const normalized = normalizeCommand(command);
  for (const pattern of BASH_DENYLIST) {
    if (pattern.test(normalized)) {
      return `Command blocked by security policy (matches ${pattern})`;
    }
  }
  if (hasUnquotedInjectionMetachar(command)) {
    return 'Command blocked by security policy: unquoted shell metacharacter (; backtick $() newline) is not allowed';
  }
  return null;
}

function runCommand(command: string, context: ToolUseContext, timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = exec(
      command,
      {
        cwd: context.cwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        shell: isWindows ? 'powershell.exe' : '/bin/bash',
      },
      (error, stdout, stderr) => {
        const code = error && typeof error === 'object' && 'code' in error
          ? (error.code as number | undefined) ?? 1
          : 0;
        if (error && code === 0) {
          reject(error);
          return;
        }
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code });
      },
    );
    context.abortController.signal.addEventListener('abort', () => {
      proc.kill();
    });
  });
}

export const BashTool = buildTool({
  name: 'Bash',
  aliases: ['Shell'],
  description: 'Run a shell command. Returns stdout, stderr, and exit code.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to run' },
      description: { type: 'string', description: 'What the command does' },
      timeout: { type: 'number', description: 'Timeout in milliseconds', default: 120000 },
    },
    required: ['command'],
  },
  isConcurrencySafe: (input) => isReadOnlyCommand(String(input.command ?? '')),
  isReadOnly: (input) => isReadOnlyCommand(String(input.command ?? '')),
  isDestructive: (input) => isDestructiveCommand(String(input.command ?? '')),
  validateInput: (input) => {
    const command = String(input.command ?? '');
    if (!command.trim()) return 'Command must not be empty';
    if (command.includes('sudo') && !isWindows) return 'sudo is not allowed';
    if (typeof input.timeout === 'number' && input.timeout > MAX_BASH_TIMEOUT_MS) {
      return `Timeout exceeds maximum of ${MAX_BASH_TIMEOUT_MS}ms`;
    }
    return bashBlockReason(command);
  },
  call: async (input, context, onProgress) => {
    const command = String(input.command ?? '');
    const timeout = typeof input.timeout === 'number' ? input.timeout : 120000;
    const blocked = bashBlockReason(command);
    if (blocked) {
      return { data: blocked, isError: true };
    }
    if (timeout > MAX_BASH_TIMEOUT_MS) {
      return { data: `Timeout exceeds maximum of ${MAX_BASH_TIMEOUT_MS}ms`, isError: true };
    }
    onProgress?.({ type: 'log', message: `Running: ${command}` });
    const { stdout, stderr, code } = await runCommand(command, context, timeout);
    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
    return {
      data: output || '(no output)',
      isError: code !== 0,
    };
  },
});

export function isReadOnlyCommand(command: string): boolean {
  const readOnlyPatterns = [
    /^ls\b/, /^cat\b/, /^head\b/, /^tail\b/, /^wc\b/, /^grep\b/, /^rg\b/,
    /^find\b/, /^git\s+(status|log|diff|show|branch|remote|config)\b/,
    /^pwd\b/, /^echo\b/, /^type\b/, /^which\b/, /^tree\b/, /^du\b/,
    /^npm\s+(view|ls)\b/, /^node\s+--version\b/, /^npm\s+--version\b/,
    /^Get-ChildItem\b/, /^Get-Content\b/, /^Get-Location\b/, /^Test-Path\b/,
  ];
  return readOnlyPatterns.some((pattern) => pattern.test(command.trim()));
}

export function isDestructiveCommand(command: string): boolean {
  const destructivePatterns = [
    /^rm\b/, /^rmdir\b/, /^del\b/, /^Remove-Item\b/, /^git\s+(reset|clean|rebase)\b/,
    /^mkfs/, /^format\b/, /^shutdown\b/, /^kill\b/, /^pkill\b/, /^taskkill\b/,
    /^drop\b/, /^truncate\b/, /^dd\b/,
  ];
  return destructivePatterns.some((pattern) => pattern.test(command.trim()));
}

const MAX_READ_CHARS = 100000;

function resolveWithinRoot(
  cwd: string,
  roots: string[] | undefined,
  filePath: string,
): { path: string } | { error: string } {
  const resolved = path.resolve(cwd, String(filePath ?? ''));
  const allowed = roots && roots.length > 0 ? roots : [cwd];
  for (const root of allowed) {
    if (isInsideRoot(path.resolve(root), resolved)) return { path: resolved };
  }
  return { error: `Path escapes workspace root: ${filePath}` };
}

function isInsideRoot(rootResolved: string, resolved: string): boolean {
  const rel = path.relative(rootResolved, resolved);
  if (rel === '') return true;
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const rootSep = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
  return resolved.toLowerCase().startsWith(rootSep.toLowerCase());
}

export const FileReadTool = buildTool({
  name: 'Read',
  aliases: ['FileRead'],
  description: 'Read a file. Provide offset and limit for large files.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute or relative path to read' },
      offset: { type: 'number', description: 'Byte offset to start from', default: 0 },
      limit: { type: 'number', description: 'Max characters to return', default: MAX_READ_CHARS },
    },
    required: ['file_path'],
  },
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  maxResultSizeChars: Infinity,
  call: async (input, context) => {
    const containment = resolveWithinRoot(context.cwd, context.roots, String(input.file_path ?? ''));
    if ('error' in containment) {
      return { data: containment.error, isError: true };
    }
    const filePath = containment.path;
    const offset = typeof input.offset === 'number' ? input.offset : 0;
    const limit = typeof input.limit === 'number' ? input.limit : MAX_READ_CHARS;
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 5 * 1024 * 1024 && limit >= MAX_READ_CHARS) {
        return { data: `File too large (${stat.size} bytes). Use offset/limit parameters.` };
      }
      const content = await fs.readFile(filePath, 'utf8');
      const slice = content.slice(offset, offset + limit);
      const truncated = content.length > offset + limit;
      return { data: truncated ? `${slice}\n<output truncated>` : slice };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { data: `Error reading ${filePath}: ${message}`, isError: true };
    }
  },
});

export const FileWriteTool = buildTool({
  name: 'Write',
  aliases: ['FileWrite'],
  description: 'Write content to a file, creating it if it does not exist.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to write to' },
      content: { type: 'string', description: 'Full content to write' },
    },
    required: ['file_path', 'content'],
  },
  call: async (input, context) => {
    const containment = resolveWithinRoot(context.cwd, context.roots, String(input.file_path ?? ''));
    if ('error' in containment) {
      return { data: containment.error, isError: true };
    }
    const filePath = containment.path;
    const parent = path.dirname(filePath);
    await fs.mkdir(parent, { recursive: true });
    const content = String(input.content ?? '');
    const existing = await fs.readFile(filePath, 'utf8').catch(() => null);
    await fs.writeFile(filePath, content, 'utf8');
    const oldLines = existing ? existing.split('\n').length : 0;
    const newLines = content.split('\n').length;
    return {
      data: `Wrote ${newLines} lines to ${filePath}${existing !== null ? ` (was ${oldLines} lines)` : ' (created)'}`,
    };
  },
});

export const FileEditTool = buildTool({
  name: 'Edit',
  aliases: ['FileEdit'],
  description: 'Replace an exact string match in a file. old_string must be unique.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to edit' },
      old_string: { type: 'string', description: 'Exact text to replace' },
      new_string: { type: 'string', description: 'Replacement text' },
      replace_all: { type: 'boolean', description: 'Replace all occurrences', default: false },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  call: async (input, context) => {
    const containment = resolveWithinRoot(context.cwd, context.roots, String(input.file_path ?? ''));
    if ('error' in containment) {
      return { data: containment.error, isError: true };
    }
    const filePath = containment.path;
    const oldString = String(input.old_string ?? '');
    const newString = String(input.new_string ?? '');
    const replaceAll = input.replace_all === true;
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.includes(oldString)) {
      return { data: `old_string not found in ${filePath}`, isError: true };
    }
    const count = content.split(oldString).length - 1;
    if (!replaceAll && count > 1) {
      return {
        data: `old_string matches ${count} times in ${filePath}. Provide more context or set replace_all=true.`,
        isError: true,
      };
    }
    const updated = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString);
    await fs.writeFile(filePath, updated, 'utf8');
    return { data: `Edited ${filePath} (${count} replacement${count > 1 ? 's' : ''})` };
  },
});

export const GlobTool = buildTool({
  name: 'Glob',
  description: 'Find files by glob pattern.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern, e.g. **/*.ts' },
      path: { type: 'string', description: 'Directory to search in', default: '.' },
    },
    required: ['pattern'],
  },
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  call: async (input, context) => {
    const { glob } = await import('node:fs/promises');
    const containment = resolveWithinRoot(context.cwd, context.roots, String(input.path ?? '.'));
    if ('error' in containment) {
      return { data: containment.error, isError: true };
    }
    const base = containment.path;
    const pattern = String(input.pattern ?? '');
    const files: string[] = [];
    for await (const entry of glob(pattern, { cwd: base })) {
      if (!entry) continue;
      files.push(path.resolve(base, entry));
      if (files.length >= 1000) break;
    }
    files.sort();
    const truncated = files.length === 1000;
    return {
      data: files.length === 0 ? 'No files matched' : files.join('\n') + (truncated ? '\n<results truncated at 1000>' : ''),
    };
  },
});

export const GrepTool = buildTool({
  name: 'Grep',
  description: 'Search file contents with a regular expression.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex to search for' },
      path: { type: 'string', description: 'Directory to search in', default: '.' },
      include: { type: 'string', description: 'File glob to filter, e.g. *.ts' },
    },
    required: ['pattern'],
  },
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  call: async (input, context) => {
    const { glob } = await import('node:fs/promises');
    const containment = resolveWithinRoot(context.cwd, context.roots, String(input.path ?? '.'));
    if ('error' in containment) {
      return { data: containment.error, isError: true };
    }
    const base = containment.path;
    const regex = new RegExp(String(input.pattern ?? ''));
    const include = String(input.include ?? '**/*');
    const results: string[] = [];
    let filesScanned = 0;
    for await (const entry of glob(include, { cwd: base })) {
      if (!entry) continue;
      if (filesScanned >= 500) break;
      const full = path.join(base, entry);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat || !stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
      filesScanned++;
      const content = await fs.readFile(full, 'utf8').catch(() => '');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line !== undefined && regex.test(line)) {
          results.push(`${entry}:${i + 1}:${line.slice(0, 200)}`);
          if (results.length >= 200) break;
        }
      }
      if (results.length >= 200) break;
    }
    return {
      data: results.length === 0
        ? 'No matches'
        : results.join('\n') + (results.length >= 200 ? '\n<results truncated at 200>' : ''),
    };
  },
});

export const WebFetchTool = buildTool({
  name: 'WebFetch',
  description: 'Fetch a URL and return its content as text.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      max_length: { type: 'number', description: 'Max characters', default: 50000 },
    },
    required: ['url'],
  },
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  call: async (input) => {
    const url = String(input.url ?? '');
    const maxLength = typeof input.max_length === 'number' ? input.max_length : 50000;
    if (!/^https?:\/\//i.test(url)) {
      return { data: 'Only http/https URLs are allowed', isError: true };
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      return { data: `HTTP ${response.status} ${response.statusText}`, isError: true };
    }
    const text = await response.text();
    return { data: text.slice(0, maxLength) };
  },
});

export interface TodoItem {
  content: string;
  status: 'pending' | 'completed';
}

const todoStore = new Map<string, TodoItem[]>();

export const TodoWriteTool = buildTool({
  name: 'TodoWrite',
  description: 'Write or update the todo list for the current task.',
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'Full list of todos with status',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'completed'] },
          },
        },
      },
    },
    required: ['todos'],
  },
  call: async (input, context) => {
    const sessionId = context.getSessionId();
    const todos = (input.todos as { content: string; status: string }[] | undefined) ?? [];
    const items: TodoItem[] = todos.map((t) => ({
      content: String(t.content),
      status: t.status === 'completed' ? 'completed' : 'pending',
    }));
    todoStore.set(sessionId, items);
    const done = items.filter((t) => t.status === 'completed').length;
    return { data: `Todos updated: ${done}/${items.length} complete` };
  },
});

export function getTodos(sessionId: string): TodoItem[] {
  return todoStore.get(sessionId) ?? [];
}

export const MemoryTool = buildTool({
  name: 'Memory',
  description: 'Store or retrieve long-term memory via the cognitive kernel.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['remember', 'recall'], description: 'Operation to perform' },
      content: { type: 'string', description: 'Text to remember or query to recall' },
      importance: { type: 'number', description: 'Importance 0-1 for remember', default: 0.5 },
    },
    required: ['action', 'content'],
  },
  isConcurrencySafe: () => true,
  isReadOnly: (input) => input.action === 'recall',
  call: async (input, context) => {
    const action = String(input.action ?? '');
    const content = String(input.content ?? '');
    if (!context.memory) {
      return { data: 'Memory subsystem not attached', isError: true };
    }
    if (action === 'remember') {
      const importance = typeof input.importance === 'number' ? input.importance : 0.5;
      await context.memory.remember(content, importance);
      return { data: `Remembered: ${content}` };
    }
    const result = await context.memory.recall(content);
    return { data: typeof result === 'string' ? result : JSON.stringify(result) };
  },
});

export const AskUserQuestionTool = buildTool({
  name: 'AskUserQuestion',
  description: 'Ask the user a question when you need clarification or a decision.',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question to ask' },
      options: {
        type: 'array',
        description: 'Answer options',
        items: { type: 'string' },
      },
    },
    required: ['question'],
  },
  requiresUserInteraction: () => true,
  call: async (input, context) => {
    const question = String(input.question ?? '');
    const options = Array.isArray(input.options) ? (input.options as string[]) : [];
    if (!context.requestPrompt) {
      return { data: `Need user input: ${question}`, isError: true };
    }
    const prompt = options.length > 0
      ? `${question}\nOptions:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
      : question;
    const answer = await context.requestPrompt(prompt, { isRequired: true });
    return { data: `User answer: ${answer}` };
  },
});

export const SleepTool = buildTool({
  name: 'Sleep',
  description: 'Wait for a duration. Useful for polling or giving background processes time.',
  inputSchema: {
    type: 'object',
    properties: {
      seconds: { type: 'number', description: 'Seconds to sleep (max 60)', default: 5 },
    },
  },
  call: async (input) => {
    const seconds = Math.min(Math.max(typeof input.seconds === 'number' ? input.seconds : 5, 1), 60);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return { data: `Slept for ${seconds} seconds` };
  },
});

export interface SubagentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
}

export const SubagentTool = buildTool({
  name: 'Subagent',
  description: 'Delegate a task to a subagent. Returns the subagent result.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'The task description for the subagent' },
      subagent_type: { type: 'string', description: 'Subagent type name', default: 'general' },
      model: { type: 'string', description: 'Model override for the subagent' },
    },
    required: ['prompt'],
  },
  call: async (input, context) => {
    const runner = context.getSubagentRunner?.();
    if (!runner) {
      return { data: 'Subagent runner not attached to this context', isError: true };
    }
    const result = await runner({
      prompt: String(input.prompt ?? ''),
      type: String(input.subagent_type ?? 'general'),
      model: input.model ? String(input.model) : undefined,
      parentSessionId: context.getSessionId(),
    });
    return { data: result };
  },
});
