import type { Provenance } from './provenance.js';

export type EpisodeContent =
  | { type: 'text'; text: string }
  | { type: 'structured'; data: Record<string, unknown> }
  | { type: 'tool_call'; tool: string; input: unknown; output: unknown }
  | { type: 'observation'; observation: string };

export interface Episode {
  id: string;
  timestamp: Date;
  content: EpisodeContent;
  session_id: string;
  agent_id: string;
  user_id: string;
  project_id: string;
  concepts: string[];
  preceding_episode: string | null;
  provenance: Provenance;
  compressed: boolean;
  summary: string | null;
  access_count: number;
  last_access: Date;
}

export function createEpisode(params: {
  content: EpisodeContent;
  session_id: string;
  agent_id?: string;
  user_id?: string;
  project_id?: string;
  provenance: Provenance;
  preceding_episode?: string;
}): Episode {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    timestamp: now,
    content: params.content,
    session_id: params.session_id,
    agent_id: params.agent_id ?? 'default',
    user_id: params.user_id ?? 'default',
    project_id: params.project_id ?? 'default',
    concepts: [],
    preceding_episode: params.preceding_episode ?? null,
    provenance: params.provenance,
    compressed: false,
    summary: null,
    access_count: 0,
    last_access: now,
  };
}
