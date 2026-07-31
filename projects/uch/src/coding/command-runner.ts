import { spawn } from 'node:child_process';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  command: string;
}

export interface CommandRunOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  shell?: boolean;
  input?: string;
  maxOutputBytes?: number;
}

export interface CommandRunnerConfig {
  defaultTimeoutMs?: number;
  maxOutputBytes?: number;
  allowlist?: string[];
  denylist?: (string | RegExp)[];
  shell?: boolean;
}

export function normalizeCommand(command: string): string {
  return command.replace(/\s+/g, ' ').trim();
}

export function hasUnquotedShellMetachar(command: string): boolean {
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
    if (ch === '`') return true;
    if (ch === ';' || ch === '|' || ch === '&' || ch === '>' || ch === '<') return true;
    if (ch === '\n' || ch === '\r') return true;
    if (ch === '$' && command[i + 1] === '(') return true;
  }
  return false;
}

export function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const ch of command) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

export const DEFAULT_DENYLIST: RegExp[] = [
  /\brm\s+-(?:[a-z]*[rf][a-z]*)\b/i,
  /\bformat\s+c:\s*\/?/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:\s*\(\s*\)\s*\{/i,
  /\bfork\s+bomb\b/i,
  /\b(?:curl|wget)[^\r\n;|&<>]*\|\s*(?:ba)?sh\b/i,
  /\b(?:curl|wget)[^\r\n;|&<>]*\|\s*powershell\b/i,
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileDenylist(entries: (string | RegExp)[]): RegExp[] {
  return entries.map((entry) =>
    entry instanceof RegExp ? entry : new RegExp(escapeRegExp(normalizeCommand(entry)), 'i'),
  );
}

export class CommandRunner {
  private config: Required<
    Pick<CommandRunnerConfig, 'defaultTimeoutMs' | 'maxOutputBytes' | 'shell'>
  >;
  private allowlist: string[] | undefined;
  private denylist: RegExp[];

  constructor(config?: CommandRunnerConfig) {
    this.config = {
      defaultTimeoutMs: config?.defaultTimeoutMs ?? 30000,
      maxOutputBytes: config?.maxOutputBytes ?? 1_000_000,
      shell: config?.shell ?? true,
    };
    this.allowlist = config?.allowlist;
    this.denylist = compileDenylist(config?.denylist ?? DEFAULT_DENYLIST);
  }

  isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
    const normalized = normalizeCommand(command);
    if (!normalized) return { allowed: false, reason: 'Empty command' };

    for (const pattern of this.denylist) {
      if (pattern.test(normalized)) {
        return { allowed: false, reason: `Command matches denylist pattern: ${pattern}` };
      }
    }

    if (this.allowlist && this.allowlist.length > 0) {
      if (/\r|\n/.test(command)) {
        return { allowed: false, reason: 'Command contains a line break' };
      }
      const tokens = tokenize(normalized);
      if (tokens.length === 0) return { allowed: false, reason: 'Empty command' };
      const matched = this.allowlist.some((entry) => {
        const entryTokens = tokenize(normalizeCommand(entry));
        if (entryTokens.length === 0 || tokens.length < entryTokens.length) return false;
        for (let i = 0; i < entryTokens.length; i++) {
          if (tokens[i] !== entryTokens[i]) return false;
        }
        return !hasUnquotedShellMetachar(normalized);
      });
      if (!matched) {
        return { allowed: false, reason: `Command prefix not in allowlist: ${tokens[0]}` };
      }
    }
    return { allowed: true };
  }

  run(command: string, options?: CommandRunOptions): Promise<CommandResult> {
    const check = this.isCommandAllowed(command);
    if (!check.allowed) {
      return Promise.resolve({
        stdout: '',
        stderr: check.reason ?? 'Command blocked',
        exitCode: null,
        timedOut: false,
        durationMs: 0,
        command,
      });
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeoutMs = options?.timeoutMs ?? this.config.defaultTimeoutMs;
      const maxOutputBytes = options?.maxOutputBytes ?? this.config.maxOutputBytes;
      const cwd = options?.cwd ?? process.cwd();
      const shell = options?.shell ?? this.config.shell;

      let stdout = '';
      let stderr = '';
      let outputBytes = 0;
      let settled = false;

      const child = spawn(command, {
        cwd,
        env: { ...process.env, ...options?.env },
        shell,
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        resolve({
          stdout,
          stderr: stderr + '\n[timed out after ' + timeoutMs + 'ms]',
          exitCode: null,
          timedOut: true,
          durationMs: Date.now() - startTime,
          command,
        });
      }, timeoutMs);

      const appendOutput = (target: 'stdout' | 'stderr', chunk: Buffer) => {
        if (settled) return;
        outputBytes += chunk.length;
        if (outputBytes > maxOutputBytes) {
          settled = true;
          child.kill('SIGKILL');
          clearTimeout(timer);
          resolve({
            stdout,
            stderr: stderr + '\n[output exceeded ' + maxOutputBytes + ' bytes, process killed]',
            exitCode: null,
            timedOut: true,
            durationMs: Date.now() - startTime,
            command,
          });
          return;
        }
        if (target === 'stdout') stdout += chunk.toString('utf-8');
        else stderr += chunk.toString('utf-8');
      };

      child.stdout?.on('data', (chunk: Buffer) => appendOutput('stdout', chunk));
      child.stderr?.on('data', (chunk: Buffer) => appendOutput('stderr', chunk));

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: stderr + `\n[spawn error: ${err.message}]`,
          exitCode: null,
          timedOut: false,
          durationMs: Date.now() - startTime,
          command,
        });
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: code,
          timedOut: false,
          durationMs: Date.now() - startTime,
          command,
        });
      });

      if (options?.input !== undefined) {
        child.stdin?.write(options.input);
      }
      child.stdin?.end();
    });
  }

  async runWithSuccess(command: string, options?: CommandRunOptions): Promise<CommandResult> {
    const result = await this.run(command, options);
    return result;
  }

  async test(command: string, options?: CommandRunOptions): Promise<boolean> {
    const result = await this.run(command, options);
    return result.exitCode === 0 && !result.timedOut;
  }
}
