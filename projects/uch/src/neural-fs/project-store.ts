import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';

export interface ProjectMemory {
  projectId: string;
  name: string;
  description: string;
  episodeCount: number;
  conceptCount: number;
  lastActivity: string;
}

export class ProjectStore {
  private kernel: CognitiveKernel;
  private projects: Map<string, ProjectMemory> = new Map();

  constructor(kernel: CognitiveKernel) {
    this.kernel = kernel;
  }

  register(projectId: string, name: string, description: string): ProjectMemory {
    const entry: ProjectMemory = {
      projectId,
      name,
      description,
      episodeCount: 0,
      conceptCount: 0,
      lastActivity: new Date().toISOString(),
    };
    this.projects.set(projectId, entry);
    return entry;
  }

  get(projectId: string): ProjectMemory | undefined {
    return this.projects.get(projectId);
  }

  async recordActivity(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      project.lastActivity = new Date().toISOString();
      project.episodeCount = this.kernel.getEpisodesByTimeRange(
        new Date(0), new Date(),
      ).filter((ep) => ep.project_id === projectId).length;
      project.conceptCount = this.kernel.getStats().concepts;
    }
  }

  listProjects(): ProjectMemory[] {
    return Array.from(this.projects.values()).sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
    );
  }

  async recallProjectContext(projectId: string, query: string, limit = 5): Promise<string> {
    return this.kernel.recallFormatted({ text: query, limit });
  }
}
