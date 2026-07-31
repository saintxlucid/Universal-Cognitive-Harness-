export type PID = number;

/**
 * running — attach (join) allowed; threads attach and detach freely.
 * suspended — join denied; existing threads remain (no new execution).
 * draining — join denied; active threads are being drained toward kill.
 * terminated — terminal; join denied; threads drained; record preserved.
 */
export type ProcessStatus = 'running' | 'suspended' | 'draining' | 'terminated';

export interface ProcessThread {
  threadId: number;
  driverLabel: string;
  attachedAt: Date;
}

export interface CognitiveProcess {
  pid: PID;
  name: string;
  ownerLabel: string;
  status: ProcessStatus;
  goals: string[];
  capabilities: string[];
  permissions: string[];
  openFiles: string[];
  /** JSON-serializable process working memory — shared by every thread (COGNITIVE-PROCESSES.md §2). */
  workingMemory?: Record<string, unknown>;
  episodeId?: string;
  contextRef?: string;
  pendingSignals: string[];
  threads: ProcessThread[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessSpec {
  name: string;
  ownerLabel: string;
  goals?: string[];
  capabilities?: string[];
  permissions?: string[];
  openFiles?: string[];
  workingMemory?: Record<string, unknown>;
  episodeId?: string;
  contextRef?: string;
}
