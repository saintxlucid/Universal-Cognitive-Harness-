import * as readline from 'node:readline';
import type { CognitiveExoskeleton, ExoskeletonTransport } from '../exoskeleton/exoskeleton.js';

export interface CLITransportConfig {
  prompt: string;
  welcomeMessage: string;
  historyFile: string;
  maxHistory: number;
}

export interface CLICommand {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[], context: CLITransport) => Promise<void>;
}

export class CLITransport implements ExoskeletonTransport {
  name = 'cli';
  private exoskeleton: CognitiveExoskeleton | null = null;
  private config: Required<CLITransportConfig>;
  private commands: Map<string, CLICommand> = new Map();
  private rl: readline.Interface | null = null;
  private running = false;
  private history: string[] = [];

  constructor(config?: Partial<CLITransportConfig>) {
    this.config = {
      prompt: config?.prompt ?? 'uch> ',
      welcomeMessage: config?.welcomeMessage ?? 'UCH Cognitive Runtime — CLI Transport',
      historyFile: config?.historyFile ?? '.uccp/cli_history.json',
      maxHistory: config?.maxHistory ?? 100,
    };

    this.registerBuiltinCommands();
  }

  attach(exoskeleton: CognitiveExoskeleton): void {
    this.exoskeleton = exoskeleton;
  }

  detach(): void {
    this.stop();
    this.exoskeleton = null;
  }

  registerCommand(cmd: CLICommand): void {
    this.commands.set(cmd.name, cmd);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    console.log(this.config.welcomeMessage);
    console.log('Type "help" for available commands, "exit" to quit.\n');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.config.prompt,
    });

    this.rl.on('line', async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        this.rl?.prompt();
        return;
      }

      this.addToHistory(trimmed);
      await this.processInput(trimmed);
      this.rl?.prompt();
    });

    this.rl.on('close', () => {
      if (this.running) {
        this.running = false;
        console.log('\nCLI transport stopped');
      }
    });

    this.rl.prompt();
  }

  stop(): void {
    this.running = false;
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  status(): Record<string, unknown> {
    return {
      running: this.running,
      commands: this.commands.size,
      historySize: this.history.length,
    };
  }

  printOutput(message: string): void {
    console.log(message);
  }

  printError(message: string): void {
    console.error(`Error: ${message}`);
  }

  printTable(headers: string[], rows: string[][]): void {
    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
    );
    const headerLine = headers.map((h, i) => h.padEnd(colWidths[i]!)).join(' | ');
    const separator = colWidths.map((w) => '-'.repeat(w)).join('-+-');
    console.log(headerLine);
    console.log(separator);
    for (const row of rows) {
      console.log(row.map((cell, i) => cell.padEnd(colWidths[i]!)).join(' | '));
    }
  }

  private registerBuiltinCommands(): void {
    this.registerCommand({
      name: 'help',
      description: 'Show available commands',
      usage: 'help [command]',
      handler: async (args) => {
        if (args.length > 0) {
          const cmd = this.commands.get(args[0]!);
          if (cmd) {
            this.printOutput(`\n  ${cmd.name} - ${cmd.description}`);
            this.printOutput(`  Usage: ${cmd.usage}\n`);
          } else {
            this.printError(`Unknown command: ${args[0]}`);
          }
          return;
        }
        this.printOutput('\nAvailable commands:');
        for (const [, cmd] of this.commands) {
          this.printOutput(`  ${cmd.name.padEnd(15)} ${cmd.description}`);
        }
        this.printOutput('');
      },
    });

    this.registerCommand({
      name: 'exit',
      description: 'Exit the CLI',
      usage: 'exit',
      handler: async () => {
        this.printOutput('Goodbye.');
        this.stop();
      },
    });

    this.registerCommand({
      name: 'status',
      description: 'Show system status',
      usage: 'status',
      handler: async () => {
        if (!this.exoskeleton) {
          this.printError('Not attached to exoskeleton');
          return;
        }
        const stats = this.exoskeleton.getStats();
        this.printOutput(JSON.stringify(stats, null, 2));
      },
    });

    this.registerCommand({
      name: 'observe',
      description: 'Observe a thought',
      usage: 'observe <layer> <content>',
      handler: async (args) => {
        if (args.length < 2) {
          this.printError('Usage: observe <layer> <content>');
          return;
        }
        if (!this.exoskeleton) {
          this.printError('Not attached to exoskeleton');
          return;
        }
        const layer = args[0]! as 'reflex' | 'working' | 'strategic' | 'meta';
        const content = args.slice(1).join(' ');
        this.exoskeleton.aether.observeThought(layer, content, 'cli');
        this.printOutput(`Observed [${layer}]: ${content}`);
      },
    });

    this.registerCommand({
      name: 'plan',
      description: 'Create a plan',
      usage: 'plan <goal>',
      handler: async (args) => {
        if (args.length === 0) {
          this.printError('Usage: plan <goal>');
          return;
        }
        if (!this.exoskeleton) {
          this.printError('Not attached to exoskeleton');
          return;
        }
        const goal = args.join(' ');
        const plan = this.exoskeleton.executive.createPlan(goal);
        this.printOutput(`Plan created: ${plan.id}`);
        this.printOutput(`  Goal: ${plan.goal}`);
      },
    });

    this.registerCommand({
      name: 'reflect',
      description: 'Show current reflection state',
      usage: 'reflect',
      handler: async () => {
        if (!this.exoskeleton) {
          this.printError('Not attached to exoskeleton');
          return;
        }
        const state = this.exoskeleton.getState();
        const insights = this.exoskeleton.cortexKernel.getInsights(5);
        this.printOutput('=== Reflection ===');
        this.printOutput(`Phase: ${state.aetherPhase}`);
        this.printOutput(`Conscious layers: ${state.consciousness.activeLayers.join(', ')}`);
        this.printOutput(`Recent insights (${insights.length}):`);
        for (const i of insights) {
          this.printOutput(`  [${i.layer}] ${i.content} (conf: ${i.confidence})`);
        }
      },
    });

    this.registerCommand({
      name: 'history',
      description: 'Show command history',
      usage: 'history [n]',
      handler: async (args) => {
        const n = args.length > 0 ? parseInt(args[0]!) : 20;
        const recent = this.history.slice(-n);
        for (let i = 0; i < recent.length; i++) {
          this.printOutput(`  ${i + 1}. ${recent[i]!}`);
        }
      },
    });

    this.registerCommand({
      name: 'clear',
      description: 'Clear the console',
      usage: 'clear',
      handler: async () => {
        console.clear();
      },
    });
  }

  private async processInput(input: string): Promise<void> {
    const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
    const cmdName = parts[0]?.toLowerCase() ?? '';
    const args = parts.slice(1).map((a) => a.replace(/^"(.*)"$/, '$1'));

    const cmd = this.commands.get(cmdName);
    if (cmd) {
      try {
        await cmd.handler(args, this);
      } catch (err) {
        this.printError(`Command failed: ${err}`);
      }
    } else {
      this.printError(`Unknown command: ${cmdName}. Type "help" for available commands.`);
    }
  }

  private addToHistory(input: string): void {
    this.history.push(input);
    if (this.history.length > this.config.maxHistory) {
      this.history.shift();
    }
  }

  getHistory(): string[] {
    return [...this.history];
  }
}
