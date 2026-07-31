export interface WorkspaceGenome {
  workspace_id: string;
  name: string;
  root_path: string;
  created_at: Date;
  last_active: Date;

  // DNA — immutable identity markers
  dna: {
    primary_language: string;
    languages: string[];
    framework: string | null;
    package_manager: string | null;
    build_system: string | null;
    project_type: 'monorepo' | 'single_package' | 'multi_project';
    is_ai_project: boolean;
  };

  // Architecture snapshot
  architecture: {
    entry_points: string[];
    test_frameworks: string[];
    ci_provider: string | null;
    deployment_target: string | null;
    module_count: number;
    file_count: number;
    line_count: number;
  };

  // Health metrics
  health: {
    test_count: number;
    test_pass_rate: number;
    lint_errors: number;
    type_errors: number;
    deprecation_warnings: number;
    dependency_count: number;
    outdated_dependencies: number;
    security_vulnerabilities: number;
    technical_debt_estimate: string;
  };

  // Evolution
  evolution: {
    commit_count: number;
    branch_count: number;
    contributor_count: number;
    age_days: number;
    last_release: Date | null;
    version: string | null;
  };
}

export function createGenome(params: {
  workspace_id: string;
  name: string;
  root_path: string;
  primary_language?: string;
  project_type?: WorkspaceGenome['dna']['project_type'];
}): WorkspaceGenome {
  return {
    workspace_id: params.workspace_id,
    name: params.name,
    root_path: params.root_path,
    created_at: new Date(),
    last_active: new Date(),
    dna: {
      primary_language: params.primary_language ?? 'unknown',
      languages: [],
      framework: null,
      package_manager: null,
      build_system: null,
      project_type: params.project_type ?? 'single_package',
      is_ai_project: false,
    },
    architecture: {
      entry_points: [],
      test_frameworks: [],
      ci_provider: null,
      deployment_target: null,
      module_count: 0,
      file_count: 0,
      line_count: 0,
    },
    health: {
      test_count: 0,
      test_pass_rate: 1.0,
      lint_errors: 0,
      type_errors: 0,
      deprecation_warnings: 0,
      dependency_count: 0,
      outdated_dependencies: 0,
      security_vulnerabilities: 0,
      technical_debt_estimate: 'unknown',
    },
    evolution: {
      commit_count: 0,
      branch_count: 0,
      contributor_count: 0,
      age_days: 0,
      last_release: null,
      version: null,
    },
  };
}

export function genomeSummary(genome: WorkspaceGenome): string {
  return [
    `Workspace: ${genome.name}`,
    `Type: ${genome.dna.project_type}`,
    `Language: ${genome.dna.primary_language}`,
    `Framework: ${genome.dna.framework ?? 'none'}`,
    `Files: ${genome.architecture.file_count}`,
    `Modules: ${genome.architecture.module_count}`,
    `Tests: ${genome.health.test_count} (${(genome.health.test_pass_rate * 100).toFixed(0)}% pass)`,
    `Dependencies: ${genome.health.dependency_count}`,
    `Age: ${genome.evolution.age_days} days`,
    `Commits: ${genome.evolution.commit_count}`,
    `Contributors: ${genome.evolution.contributor_count}`,
    `Health: ${genome.health.lint_errors > 0 ? `${genome.health.lint_errors} lint issues` : 'clean'}`,
  ].join('\n');
}
