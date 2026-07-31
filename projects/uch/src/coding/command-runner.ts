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
  denylist?: string[];
  shell?: boolean;
}

const DEFAULT_DENYLIST = [
  'rm -rf /', 'rm -rf ~', 'format c:', 'shutdown', 'reboot', 'mkfs',
  'dd if=', ':(){', 'fork bomb', 'curl.*|.*sh', 'wget.*|.*sh',
];

export class CommandRunner {
  private config: Required<Pick<CommandRunnerConfig, 'defaultTimeoutMs' | 'maxOutputBytes' | 'shell'>>;
  private allowlist: string[] | undefined;
  private denylist: string[];

  constructor(config?: CommandRunnerConfig) {
    this.config = {
      defaultTimeoutMs: config?.defaultTimeoutMs ?? 30000,
      maxOutputBytes: config?.maxOutputBytes ?? 1_000_000,
      shell: config?.shell ?? true,
    };
    this.allowlist = config?.allowlist;
    this.denylist = config?.denylist ?? DEFAULT_DENYLIST;
  }

  isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
    for (const pattern of this.denylist) {
      if (command.includes(pattern)) {
        return { allowed: false, reason: `Command matches denylist pattern: ${pattern}` };
      }
    }
    if (this.allowlist && this.allowlist.length > 0) {
      const firstToken = command.trim().split(/\s+/)[0] ?? '';
      if (!this.allowlist.some((a) => firstToken === a || command.startsWith(a))) {
        return { allowed: false, reason: `Command prefix not in allowlist: ${firstToken}` };
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

      const child = spawn(command, { cwd, env: { ...process.env, ...options?.env }, shell, windowsHide: true });

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
