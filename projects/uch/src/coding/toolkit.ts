import { CodeIndex } from './code-index.js';
import { FileEditor } from './file-editor.js';
import { CommandRunner } from './command-runner.js';
import { DiffReview } from './diff-review.js';
import { CodingSkills } from './coding-skills.js';

export interface CodingToolkitConfig {
  workspaceRoot?: string;
  commandAllowlist?: string[];
  commandDenylist?: string[];
  defaultCommandTimeoutMs?: number;
}

export class CodingToolkit {
  readonly index: CodeIndex;
  readonly files: FileEditor;
  readonly commands: CommandRunner;
  readonly review: DiffReview;
  readonly skills: CodingSkills;
  readonly workspaceRoot: string;

  constructor(config?: CodingToolkitConfig) {
    this.workspaceRoot = config?.workspaceRoot ?? process.cwd();
    this.index = new CodeIndex();
    this.files = new FileEditor({ root: this.workspaceRoot });
    this.commands = new CommandRunner({
      defaultTimeoutMs: config?.defaultCommandTimeoutMs ?? 30000,
      allowlist: config?.commandAllowlist,
      denylist: config?.commandDenylist,
    });
    this.review = new DiffReview();
    this.skills = new CodingSkills();
  }

  async analyzeProject(dirPath = this.workspaceRoot): Promise<{ files: number; stats: ReturnType<CodeIndex['getStats']> }> {
    const files = await this.index.indexDirectory(dirPath);
    return { files, stats: this.index.getStats() };
  }

  suggestSkill(task: string): ReturnType<CodingSkills['suggest']> {
    return this.skills.suggest(task);
  }

  getContextForFile(filePath: string): {
    symbols: ReturnType<CodeIndex['getSymbols']>;
    imports: ReturnType<CodeIndex['getImports']>;
    dependents: string[];
    dependencies: string[];
  } {
    const resolved = filePath;
    return {
      symbols: this.index.getSymbols(resolved),
      imports: this.index.getImports(resolved),
      dependents: this.index.getDependents(resolved),
      dependencies: this.index.getDependencies(resolved),
    };
  }

  getStats(): {
    index: ReturnType<CodeIndex['getStats']>;
    skills: number;
    undoHistory: number;
  } {
    return {
      index: this.index.getStats(),
      skills: this.skills.count,
      undoHistory: 0,
    };
  }
}

export type { CodeIndexConfig, CodeSymbol, FileIndex, DependencyEdge, ImpactReport, SymbolKind } from './code-index.js';
export type { ReadOptions, EditResult, FileBackup, FileEditorConfig } from './file-editor.js';
export type { CommandResult, CommandRunOptions, CommandRunnerConfig } from './command-runner.js';
export type {
  DiffHunk,
  DiffFile,
  DiffSummary,
  FindingSeverity,
  ReviewFinding,
  DiffReviewResult,
  DiffReviewOptions,
} from './diff-review.js';
export type { CodingSkill, CodingSkillCategory, CodingSkillStep, SkillMatch } from './coding-skills.js';
