/**
 * Kernel-status commands: `productivity` (Productivity Kernel) and `fusion`
 * (Signal Fusion Engine).
 */

import { ProductivityKernel } from '../productivity-kernel/productivity-kernel.js';
import { SignalFusionEngine } from '../cortex_kernel/signal-fusion-engine.js';

export async function handleProductivity(): Promise<void> {
  const kernel = new ProductivityKernel();
  kernel.capture('sample capture', 5);
  kernel.initializeDay([
    { name: 'sample MIT', urgency: 'urgent', importance: 'important', durationMin: 60 },
  ]);
  console.log(JSON.stringify(kernel.getStatus(), null, 2));
  process.exit(0);
}

export async function handleFusion(): Promise<void> {
  const engine = new SignalFusionEngine();
  console.log(JSON.stringify(engine.getStatus(), null, 2));
  console.log('Use the MCP compose-signals tool to fuse candidate sets.');
  process.exit(0);
}
