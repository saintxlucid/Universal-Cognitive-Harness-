/**
 * UCH Bootstrapper
 *
 * Auto-loads the cognitive exoskeleton for any AI coding agent.
 * Each runtime (Claude Code, Codex, OpenCode, VS Code, Cursor, etc.)
 * sources this file at workspace load time to get transparent
 * memory, context, session continuity, and code-aware cognition.
 *
 * ── Usage ──────────────────────────────────────────────
 *   import { bootUCH } from 'uch';
 *   const uch = await bootUCH({ toolName: 'claude-code' });
 *
 *   // Before each message:
 *   const ctx = await uch.getContext(userMessage, { currentFile });
 *
 *   // After each response:
 *   await uch.learnFromInteraction(userMessage, assistantResponse);
 *
 *   // On shutdown:
 *   const { handoff } = await uch.saveAndHandoff();
 *
 * ── Auto-load (zero-code) ──────────────────────────────
 * Each agent runtime loads UCH automatically via:
 *   CLAUDE.md  → `source projects/uch/src/agent/boot.ts`
 *   AGENTS.md  → same
 *   .opencode/ → plugin config
 */

import { UCHAgentPlugin, type AgentPluginConfig } from './plugin.js';

let _globalInstance: UCHAgentPlugin | null = null;

export async function bootUCH(config?: AgentPluginConfig): Promise<UCHAgentPlugin> {
  if (_globalInstance) {
    return _globalInstance;
  }

  const plugin = new UCHAgentPlugin(config);
  await plugin.boot();
  _globalInstance = plugin;
  return plugin;
}

export function getUCH(): UCHAgentPlugin | null {
  return _globalInstance;
}

export { UCHAgentPlugin } from './plugin.js';
export type { AgentPluginConfig, AgentContext, AgentTool } from './plugin.js';
