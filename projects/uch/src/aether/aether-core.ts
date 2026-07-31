import {
  Consciousness,
  type ConsciousnessLayer,
  type ConsciousnessState,
} from './consciousness.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

export interface AetherConfig {
  tickIntervalMs: number;
  enableStrategicThinking: boolean;
  enableReflectiveCycles: boolean;
  enableMetaCognition: boolean;
}

export interface AetherState {
  running: boolean;
  startedAt: Date | null;
  ticksCompleted: number;
  lastTickDuration: number;
  consciousness: ConsciousnessState;
  connectedAgents: number;
  cyclePhase: AetherPhase;
  subsystems: string[];
}

export type AetherPhase = 'idle' | 'active' | 'thinking' | 'sleeping' | 'evolving';

export interface AetherSubsystem {
  name: string;
  tick(): Promise<void>;
  status(): Record<string, unknown>;
}

export class AetherCore {
  private consciousness: Consciousness;
  private eventBus: NeuralEventBus;
  private config: Required<AetherConfig>;
  private state: AetherState;
  private subsystems: Map<string, AetherSubsystem> = new Map();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private _phase: AetherPhase = 'idle';

  constructor(eventBus: NeuralEventBus, config?: Partial<AetherConfig>) {
    this.eventBus = eventBus;
    this.consciousness = new Consciousness();
    this.config = {
      tickIntervalMs: config?.tickIntervalMs ?? 5000,
      enableStrategicThinking: config?.enableStrategicThinking ?? true,
      enableReflectiveCycles: config?.enableReflectiveCycles ?? true,
      enableMetaCognition: config?.enableMetaCognition ?? true,
    };
    this.state = {
      running: false,
      startedAt: null,
      ticksCompleted: 0,
      lastTickDuration: 0,
      consciousness: this.consciousness.getState(),
      connectedAgents: 0,
      cyclePhase: 'idle',
      subsystems: [],
    };
  }

  register(name: string, subsystem: AetherSubsystem): void {
    this.subsystems.set(name, subsystem);
  }

  start(): void {
    if (this.state.running) return;
    this.state.running = true;
    this.state.startedAt = new Date();
    this._phase = 'active';

    this.tickTimer = setInterval(async () => {
      await this.tick();
    }, this.config.tickIntervalMs);

    this.consciousness.observe('working', 'Aether core started', 'aether', ['startup']);
    this.eventBus.publish({
      type: 'aether:started',
      source: 'aether-core',
      payload: { startedAt: this.state.startedAt },
    });
  }

  stop(): void {
    if (!this.state.running) return;
    this.state.running = false;
    this._phase = 'idle';

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    this.consciousness.observe('working', 'Aether core stopped', 'aether', ['shutdown']);
    this.eventBus.publish({ type: 'aether:stopped', source: 'aether-core', payload: {} });
  }

  private async tick(): Promise<void> {
    const tickStart = Date.now();

    for (const [name, sub] of this.subsystems) {
      try {
        await sub.tick();
      } catch (err) {
        this.consciousness.observe('reflex', `Subsystem ${name} tick failed: ${err}`, 'aether', [
          'error',
        ]);
      }
    }

    this.state.ticksCompleted++;
    this.state.lastTickDuration = Date.now() - tickStart;
    this.state.consciousness = this.consciousness.getState();

    this.broadcastState();
  }

  get phase(): AetherPhase {
    return this._phase;
  }
  set phase(p: AetherPhase) {
    this._phase = p;
  }

  get cons(): Consciousness {
    return this.consciousness;
  }

  getState(): AetherState {
    return {
      ...this.state,
      consciousness: this.consciousness.getState(),
      cyclePhase: this._phase,
      subsystems: [...this.subsystems.keys()],
    };
  }

  setAgentCount(n: number): void {
    this.state.connectedAgents = n;
  }

  private broadcastState(): void {
    this.eventBus.publish({
      type: 'aether:tick',
      source: 'aether-core',
      payload: {
        ticks: this.state.ticksCompleted,
        phase: this._phase,
        consciousness: this.state.consciousness,
        subsystemCount: this.subsystems.size,
      },
    });
  }

  observeThought(
    layer: ConsciousnessLayer,
    content: string,
    source: string,
    tags?: string[],
  ): void {
    this.consciousness.observe(layer, content, source ?? 'aether', tags);
  }

  getStats(): Record<string, unknown> {
    return {
      running: this.state.running,
      startedAt: this.state.startedAt,
      ticksCompleted: this.state.ticksCompleted,
      lastTickDuration: this.state.lastTickDuration,
      phase: this._phase,
      consciousness: this.consciousness.getStats(),
      subsystems: [...this.subsystems.keys()],
      connectedAgents: this.state.connectedAgents,
    };
  }
}
