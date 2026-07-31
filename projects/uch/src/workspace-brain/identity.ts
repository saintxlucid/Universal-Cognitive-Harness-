export interface WorkspaceIdentity {
  workspace_id: string;
  name: string;
  purpose: string;
  domain: string;
  owner: string | null;

  // Personality — derived from code style and patterns
  personality: {
    naming_convention: 'camelCase' | 'snake_case' | 'kebab_case' | 'mixed';
    test_style: 'unit_heavy' | 'integration_heavy' | 'e2e_heavy' | 'minimal';
    commit_style: 'conventional' | 'descriptive' | 'minimal';
    code_formality: 'strict' | 'moderate' | 'relaxed';
    documentation_quality: 'excellent' | 'good' | 'minimal' | 'none';
    error_handling: 'explicit' | 'implicit' | 'mixed';
  };

  // Mission
  mission: string;
  goals: string[];
  constraints: string[];

  // Relationships to other workspaces
  dependencies: Array<{ name: string; relationship: string }>;
  related_projects: string[];

  created_at: Date;
  last_updated: Date;
}

export function createWorkspaceIdentity(params: {
  workspace_id: string;
  name: string;
  purpose?: string;
  mission?: string;
}): WorkspaceIdentity {
  return {
    workspace_id: params.workspace_id,
    name: params.name,
    purpose: params.purpose ?? 'Unknown',
    domain: 'general',
    owner: null,
    personality: {
      naming_convention: 'mixed',
      test_style: 'minimal',
      commit_style: 'minimal',
      code_formality: 'moderate',
      documentation_quality: 'minimal',
      error_handling: 'mixed',
    },
    mission: params.mission ?? 'Build and maintain software',
    goals: [],
    constraints: [],
    dependencies: [],
    related_projects: [],
    created_at: new Date(),
    last_updated: new Date(),
  };
}
