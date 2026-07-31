import * as os from 'node:os';
import type { NeuralEventBus, EventType } from '../../event-bus/neural-event-bus.js';

export interface RuntimeStats {
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    heapTotal: number;
    heapUsed: number;
  };
  cpu: {
    loadAverage: number[];
    cores: number;
    usagePercent: number;
  };
  uptime: {
    process: number;
    system: number;
  };
  environment: {
    platform: string;
    arch: string;
    hostname: string;
    nodeVersion: string;
    pid: number;
  };
}

export interface RuntimeDriverConfig {
  sampleInterval?: number;
  memoryWarningThreshold?: number;
  cpuSpikeThreshold?: number;
  memoryWarningCooldown?: number;
  cpuSpikeCooldown?: number;
}

export class RuntimeDriver {
  private eventBus: NeuralEventBus;
  private config: Required<RuntimeDriverConfig>;
  private stats: RuntimeStats | null = null;
  private sampleInterval: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private lastMemoryWarning = 0;
  private lastCpuSpike = 0;
  private lastCpuUsage: { idle: number; total: number } | null = null;

  constructor(eventBus: NeuralEventBus, config?: RuntimeDriverConfig) {
    this.eventBus = eventBus;
    this.config = {
      sampleInterval: config?.sampleInterval ?? 10000,
      memoryWarningThreshold: config?.memoryWarningThreshold ?? 0.85,
      cpuSpikeThreshold: config?.cpuSpikeThreshold ?? 0.9,
      memoryWarningCooldown: config?.memoryWarningCooldown ?? 60000,
      cpuSpikeCooldown: config?.cpuSpikeCooldown ?? 60000,
    };
  }

  start(): void {
    if (this.active) return;
    this.active = true;

    this.sampleStats();
    this.sampleInterval = setInterval(() => {
      this.sampleStats();
    }, this.config.sampleInterval);
  }

  stop(): void {
    this.active = false;
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
  }

  getMemoryUsage(): RuntimeStats['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total,
      free,
      used,
      usagePercent: total > 0 ? used / total : 0,
      heapTotal: process.memoryUsage().heapTotal,
      heapUsed: process.memoryUsage().heapUsed,
    };
  }

  getCPUUsage(): RuntimeStats['cpu'] {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const [, times] of Object.entries(cpu.times)) {
        totalTick += times;
      }
      totalIdle += cpu.times.idle;
    }

    const usagePercent = this.calculateCPUPercent(totalIdle, totalTick);

    return {
      loadAverage: os.loadavg(),
      cores: cpus.length,
      usagePercent,
    };
  }

  getUptime(): RuntimeStats['uptime'] {
    return {
      process: process.uptime(),
      system: os.uptime(),
    };
  }

  getEnvironmentInfo(): RuntimeStats['environment'] {
    return {
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      nodeVersion: process.version,
      pid: process.pid,
    };
  }

  getProcessList(): Array<{ pid: number; name: string; memory: number }> {
    try {
      return [
        {
          pid: process.pid,
          name: process.title || 'node',
          memory: process.memoryUsage().rss,
        },
      ];
    } catch {
      return [];
    }
  }

  getStats(): RuntimeStats | null {
    return this.stats;
  }

  private async sampleStats(): Promise<void> {
    try {
      const memory = this.getMemoryUsage();
      const cpu = this.getCPUUsage();
      const uptime = this.getUptime();
      const environment = this.getEnvironmentInfo();

      this.stats = { memory, cpu, uptime, environment };

      await this.eventBus.publish({
        type: 'runtime:health_check' as EventType,
        source: 'runtime-driver',
        payload: { stats: this.stats },
      });

      const now = Date.now();

      if (
        memory.usagePercent >= this.config.memoryWarningThreshold &&
        now - this.lastMemoryWarning >= this.config.memoryWarningCooldown
      ) {
        this.lastMemoryWarning = now;
        await this.eventBus.publish({
          type: 'runtime:memory_warning' as EventType,
          source: 'runtime-driver',
          payload: {
            usagePercent: memory.usagePercent,
            threshold: this.config.memoryWarningThreshold,
            memory,
          },
        });
      }

      if (
        cpu.usagePercent >= this.config.cpuSpikeThreshold &&
        now - this.lastCpuSpike >= this.config.cpuSpikeCooldown
      ) {
        this.lastCpuSpike = now;
        await this.eventBus.publish({
          type: 'runtime:cpu_spike' as EventType,
          source: 'runtime-driver',
          payload: {
            usagePercent: cpu.usagePercent,
            threshold: this.config.cpuSpikeThreshold,
            cpu,
          },
        });
      }
    } catch {
      // Sampling failure should not crash the driver
    }
  }

  private calculateCPUPercent(idle: number, total: number): number {
    if (this.lastCpuUsage) {
      const idleDelta = idle - this.lastCpuUsage.idle;
      const totalDelta = total - this.lastCpuUsage.total;
      this.lastCpuUsage = { idle, total };

      if (totalDelta > 0) {
        return 1 - idleDelta / totalDelta;
      }
      return 0;
    }

    this.lastCpuUsage = { idle, total };
    return 0;
  }
}
