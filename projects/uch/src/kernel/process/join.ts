import {
  attach,
  type AttachOptions,
  type AttachmentResult,
} from '../../workspace-manifest/attach.js';
import { ProcessTable, type PID, type ProcessSpec, type ProcessThread } from './index.js';

export interface JoinProcessOptions {
  processTable: ProcessTable;
  /** PID of an existing process; omit to spawn a fresh one (create-or-join). */
  pid?: PID;
  /** Agent identity attaching; becomes the thread's driverLabel. */
  agent_id: string;
  user_id?: string;
  startDir?: string;
  /** Definition used when a fresh process is spawned. */
  processSpec?: ProcessSpec;
  /** Extra options forwarded to attach() (grants, drivers, governance, …). */
  attachOptions?: Omit<AttachOptions, 'agent_id' | 'user_id' | 'startDir'>;
}

export type JoinProcessResult =
  | { ok: true; created: boolean; pid: PID; thread: ProcessThread; attachment: AttachmentResult }
  | { ok: false; reason: string; attachment?: AttachmentResult };

/**
 * Attach = join a PID (ADR-006 §4, COGNITIVE-PROCESSES.md §8).
 *
 * The existing attach() pipeline keeps its job — manifest discovery, version
 * negotiation, grant issuance, projections — and the driver becomes a thread
 * of the given process (`ProcessTable.attach`). Nothing transfers; nothing
 * syncs.
 *
 * Create-or-join: with no pid, a fresh process is spawned first and rolled
 * back (killed) if attachment fails. An existing process is never rolled back
 * by a failed attach.
 */
export async function joinProcess(options: JoinProcessOptions): Promise<JoinProcessResult> {
  const table = options.processTable;

  let pid = options.pid;
  let created = false;
  if (pid === undefined) {
    const spawned = table.spawn(options.processSpec ?? { name: options.agent_id, ownerLabel: options.agent_id });
    pid = spawned.pid;
    created = true;
  } else if (!table.get(pid)) {
    return { ok: false, reason: `process ${pid} not found` };
  }

  const attachment = await attach({
    agent_id: options.agent_id,
    user_id: options.user_id,
    startDir: options.startDir,
    ...options.attachOptions,
  });

  if (!attachment.attached) {
    if (created) {
      table.kill(pid);
    }
    return { ok: false, reason: attachment.reason ?? 'attachment failed', attachment };
  }

  try {
    const thread = table.attach(pid, options.agent_id);
    return { ok: true, created, pid, thread, attachment };
  } catch (err) {
    if (created) {
      table.kill(pid);
    }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      attachment,
    };
  }
}
