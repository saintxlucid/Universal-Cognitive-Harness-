export interface Subsystem {
  id: string;
  name: string;
  path: string;
  type: 'service' | 'library' | 'app' | 'package' | 'config' | 'docs';
  dependencies: string[];
  consumers: string[];
  ownership: string | null;
  health: 'healthy' | 'degraded' | 'unknown';
  description: string;
}

export interface DecisionRecord {
  id: string;
  title: string;
  date: Date;
  context: string;
  decision: string;
  alternatives: string[];
  rationale: string;
  consequences: string[];
  status: 'active' | 'superseded' | 'rejected' | 'proposed';
}

export interface CodingStandard {
  id: string;
  category: 'style' | 'pattern' | 'convention' | 'architecture';
  rule: string;
  enforcement: 'strict' | 'suggested' | 'documented';
  source: string;
}

export interface WorkspaceWorldModel {
  last_updated: Date;
  subsystems: Map<string, Subsystem>;
  decisions: DecisionRecord[];
  standards: CodingStandard[];
  key_terms: Map<string, string>;
  current_sprint: string | null;
  open_issues_count: number;
  known_failures: string[];
  performance_bottlenecks: string[];
  security_risks: string[];
}

export function createWorldModel(): WorkspaceWorldModel {
  return {
    last_updated: new Date(),
    subsystems: new Map(),
    decisions: [],
    standards: [],
    key_terms: new Map(),
    current_sprint: null,
    open_issues_count: 0,
    known_failures: [],
    performance_bottlenecks: [],
    security_risks: [],
  };
}

export function addDecision(model: WorkspaceWorldModel, decision: Omit<DecisionRecord, 'id' | 'date'>): DecisionRecord {
  const record: DecisionRecord = { ...decision, id: crypto.randomUUID(), date: new Date() };
  model.decisions.push(record);
  model.last_updated = new Date();
  return record;
}

export function addSubsystem(
  model: WorkspaceWorldModel,
  subsystem: Omit<Subsystem, 'id'>,
): Subsystem {
  const sys: Subsystem = { ...subsystem, id: crypto.randomUUID() };
  model.subsystems.set(sys.id, sys);
  model.last_updated = new Date();
  return sys;
}

export function worldModelSummary(model: WorkspaceWorldModel): string {
  const lines = [
    `Subsystems: ${model.subsystems.size}`,
    `Decisions: ${model.decisions.length}`,
    `Standards: ${model.standards.length}`,
    `Key Terms: ${model.key_terms.size}`,
    `Open Issues: ${model.open_issues_count}`,
    `Known Failures: ${model.known_failures.length}`,
    `Security Risks: ${model.security_risks.length}`,
    `Sprint: ${model.current_sprint ?? 'none'}`,
  ];
  return lines.join('\n');
}
