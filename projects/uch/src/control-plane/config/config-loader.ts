import * as fs from 'node:fs';
import * as path from 'node:path';

export interface UCCPConfig {
  server?: {
    name?: string;
    version?: string;
    host?: string;
    port?: number;
  };
  controlPlane?: {
    auth?: { jwtSecret?: string; tokenExpiryMs?: number };
    budgets?: { maxTokensPerDay?: number; maxCostPerDay?: number; maxToolCallsPerSession?: number };
    policies?: Array<{ id: string; effect: string; principals: string[]; actions: string[]; resources: string[]; priority: number }>;
  };
  persistence?: {
    baseDir?: string;
    files?: {
      constitution?: string; genome?: string; scientificMemory?: string;
      knowledgeCompiler?: string; trustEngine?: string; reflection?: string;
      decisionLog?: string; patternLibrary?: string; suggestions?: string;
      taskScheduler?: string; projectHealth?: string; tasteEngine?: string;
      dreaming?: string; creativity?: string; webhookDispatcher?: string;
      signalStore?: string; secretsStore?: string;
    };
  };
  cognitivePlane?: {
    persistence?: { traceFile?: string; signalFile?: string; secretsFile?: string };
    replay?: { enabled?: boolean; autoTrigger?: boolean };
  };
  telemetry?: {
    otlpEndpoint?: string;
    serviceName?: string;
    enabled?: boolean;
  };
  drivers?: {
    filesystem?: { watchPaths?: string[]; rootPath?: string };
    git?: { repoPath?: string };
  };
}

export class ConfigLoader {
  private config: UCCPConfig;

  constructor(config?: UCCPConfig) {
    this.config = config ?? {};
  }

  static fromFile(filePath: string): ConfigLoader {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return new ConfigLoader({});
    }

    const ext = path.extname(filePath).toLowerCase();
    let raw: string;
    try {
      raw = fs.readFileSync(resolved, 'utf-8');
    } catch {
      return new ConfigLoader({});
    }

    let parsed: UCCPConfig;
    switch (ext) {
      case '.json':
        parsed = JSON.parse(raw) as UCCPConfig;
        break;
      case '.jsonc': {
        const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        parsed = JSON.parse(stripped) as UCCPConfig;
        break;
      }
      default:
        parsed = JSON.parse(raw) as UCCPConfig;
    }

    return new ConfigLoader(parsed);
  }

  static fromEnv(): ConfigLoader {
    return new ConfigLoader({
      server: {
        host: process.env.UCCP_HOST,
        port: process.env.UCCP_PORT ? parseInt(process.env.UCCP_PORT) : undefined,
      },
      controlPlane: {
        auth: { jwtSecret: process.env.UCCP_JWT_SECRET },
        budgets: process.env.UCCP_MAX_TOKENS_PER_DAY ? { maxTokensPerDay: parseInt(process.env.UCCP_MAX_TOKENS_PER_DAY) } : undefined,
      },
      telemetry: {
        otlpEndpoint: process.env.UCCP_OTLP_ENDPOINT,
        enabled: process.env.UCCP_TELEMETRY_ENABLED === 'true',
      },
    });
  }

  get(): UCCPConfig {
    return this.config;
  }

  merge(other: UCCPConfig): void {
    this.config = {
      ...this.config,
      ...other,
      server: { ...this.config.server, ...other.server },
      controlPlane: { ...this.config.controlPlane, ...other.controlPlane, auth: { ...this.config.controlPlane?.auth, ...other.controlPlane?.auth }, budgets: { ...this.config.controlPlane?.budgets, ...other.controlPlane?.budgets } },
      persistence: { ...this.config.persistence, ...other.persistence, files: { ...this.config.persistence?.files, ...other.persistence?.files } },
      cognitivePlane: { ...this.config.cognitivePlane, ...other.cognitivePlane, persistence: { ...this.config.cognitivePlane?.persistence, ...other.cognitivePlane?.persistence } },
      telemetry: { ...this.config.telemetry, ...other.telemetry },
      drivers: { ...this.config.drivers, ...other.drivers, filesystem: { ...this.config.drivers?.filesystem, ...other.drivers?.filesystem }, git: { ...this.config.drivers?.git, ...other.drivers?.git } },
    };
  }

  resolve(): UCCPConfig {
    return this.config;
  }
}
