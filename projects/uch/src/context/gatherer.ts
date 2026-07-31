import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

export interface WorkspaceContext {
  projectStructure: ProjectStructure;
  gitInfo: GitInfo;
  fileSystem: FileSystemState;
  configFiles: Record<string, string>;
  environment: EnvironmentInfo;
}

export interface ProjectStructure {
  root: string;
  projects: string[];
  packageManager: string | null;
  hasMonorepo: boolean;
  hasTypeScript: boolean;
  hasDocker: boolean;
  readme: string | null;
  languages: string[];
  entryPoints: string[];
}

export interface GitInfo {
  isRepo: boolean;
  branch: string | null;
  currentHash: string | null;
  recentCommits: string[];
  hasChanges: boolean;
  changedFiles: number;
  lastCommitMessage: string | null;
}

export interface FileSystemState {
  totalDirs: number;
  totalFiles: number;
  maxDepth: number;
  largestDirs: string[];
}

export interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  memoryGB: number;
  cpus: number;
  hasGit: boolean;
  hasDocker: boolean;
  hasNpm: boolean;
}

export class WorkspaceContextGatherer {
  private rootPath: string;

  constructor(rootPath?: string) {
    this.rootPath = rootPath ?? process.cwd();
  }

  async gather(): Promise<WorkspaceContext> {
    const [projectStructure, gitInfo, fileSystem, configFiles, environment] = await Promise.all([
      this.gatherProjectStructure(),
      this.gatherGitInfo(),
      this.gatherFileSystem(),
      this.gatherConfigFiles(),
      this.gatherEnvironment(),
    ]);

    return { projectStructure, gitInfo, fileSystem, configFiles, environment };
  }

  async summary(): Promise<string> {
    const ctx = await this.gather();
    const lines: string[] = [
      `Workspace: ${ctx.projectStructure.root}`,
      `Projects: ${ctx.projectStructure.projects.join(', ') || '(root only)'}`,
      `Package Manager: ${ctx.projectStructure.packageManager ?? 'unknown'}`,
      `TypeScript: ${ctx.projectStructure.hasTypeScript ? 'yes' : 'no'}`,
      `Monorepo: ${ctx.projectStructure.hasMonorepo ? 'yes' : 'no'}`,
      `Docker: ${ctx.projectStructure.hasDocker ? 'yes' : 'no'}`,
      `Languages: ${ctx.projectStructure.languages.join(', ') || 'unknown'}`,
      `Git: ${ctx.gitInfo.branch ?? 'none'} (${ctx.gitInfo.changedFiles} changed)`,
      `Node: ${ctx.environment.nodeVersion}, ${ctx.environment.platform}-${ctx.environment.arch}`,
      `Files: ${ctx.fileSystem.totalFiles}, Dirs: ${ctx.fileSystem.totalDirs}`,
    ];
    return lines.join('\n');
  }

  private async gatherProjectStructure(): Promise<ProjectStructure> {
    const projects = await this.discoverProjects();
    const hasMonorepo = fs.existsSync(path.join(this.rootPath, 'pnpm-workspace.yaml'))
      || fs.existsSync(path.join(this.rootPath, 'lerna.json'))
      || fs.existsSync(path.join(this.rootPath, 'turbo.json'));
    const hasTypeScript = fs.existsSync(path.join(this.rootPath, 'tsconfig.json'))
      || await this.globExists('**/tsconfig.json');
    const hasDocker = fs.existsSync(path.join(this.rootPath, 'Dockerfile'))
      || await this.globExists('**/Dockerfile');
    const pm = this.detectPackageManager();
    const readme = this.findReadme();
    const languages = await this.detectLanguages();
    const entryPoints = await this.findEntryPoints();

    return {
      root: this.rootPath,
      projects,
      packageManager: pm,
      hasMonorepo,
      hasTypeScript,
      hasDocker,
      readme,
      languages,
      entryPoints,
    };
  }

  private async gatherGitInfo(): Promise<GitInfo> {
    const info: GitInfo = {
      isRepo: false,
      branch: null,
      currentHash: null,
      recentCommits: [],
      hasChanges: false,
      changedFiles: 0,
      lastCommitMessage: null,
    };

    try {
      const gitDir = this.exec('git rev-parse --git-dir');
      if (gitDir) {
        info.isRepo = true;
        info.branch = this.exec('git rev-parse --abbrev-ref HEAD');
        info.currentHash = this.exec('git rev-parse HEAD');
        info.hasChanges = !!this.exec('git status --porcelain');
        info.changedFiles = this.exec('git status --porcelain').split('\n').filter(Boolean).length;

        const lastCommit = this.exec('git log -1 --format="%s"');
        if (lastCommit) info.lastCommitMessage = lastCommit;

        const log = this.exec('git log --oneline -5 --format="%h %s"');
        if (log) info.recentCommits = log.split('\n').filter(Boolean);
      }
    } catch {
      // not a git repo
    }

    return info;
  }

  private async gatherFileSystem(): Promise<FileSystemState> {
    let totalDirs = 0;
    let totalFiles = 0;
    let maxDepth = 0;
    const dirSizes: Map<string, number> = new Map();

    const walk = (dir: string, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth);
      if (depth > 6) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        let fileCount = 0;
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            totalDirs++;
            walk(fullPath, depth + 1);
          } else if (entry.isFile()) {
            totalFiles++;
            fileCount++;
          }
        }
        dirSizes.set(dir, fileCount);
      } catch {
        // permission denied or other error
      }
    };

    walk(this.rootPath, 0);

    const largestDirs = [...dirSizes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([dir]) => dir.replace(this.rootPath, '').replace(/^[/\\]/, '') || '.');

    return { totalDirs, totalFiles, maxDepth, largestDirs };
  }

  private async gatherConfigFiles(): Promise<Record<string, string>> {
    const configFiles: Record<string, string> = {};
    const patterns = [
      'package.json', 'tsconfig.json', '.env.example', 'Dockerfile',
      'docker-compose.yml', '.gitignore', '.editorconfig', '.prettierrc',
      'turbo.json', 'lerna.json', 'pnpm-workspace.yaml', 'Makefile',
      'Justfile', 'Cargo.toml', 'Gemfile', 'requirements.txt',
    ];

    for (const file of patterns) {
      const fullPath = path.join(this.rootPath, file);
      if (fs.existsSync(fullPath)) {
        try {
          configFiles[file] = fs.readFileSync(fullPath, 'utf-8').slice(0, 500);
        } catch {
          configFiles[file] = '(unreadable)';
        }
      }
    }

    return configFiles;
  }

  private async gatherEnvironment(): Promise<EnvironmentInfo> {
    const env: EnvironmentInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10 || 0,
      cpus: os.cpus()?.length || 0,
      hasGit: this.checkCommand('git --version'),
      hasDocker: this.checkCommand('docker --version'),
      hasNpm: this.checkCommand('npm --version'),
    };
    return env;
  }

  private checkCommand(cmd: string): boolean {
    try {
      this.exec(cmd);
      return true;
    } catch {
      return false;
    }
  }

  private exec(command: string): string {
    try {
      return execSync(command, { cwd: this.rootPath, encoding: 'utf-8', timeout: 5000 }).trim();
    } catch {
      return '';
    }
  }

  private detectPackageManager(): string | null {
    if (fs.existsSync(path.join(this.rootPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(this.rootPath, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(this.rootPath, 'package-lock.json'))) return 'npm';
    if (fs.existsSync(path.join(this.rootPath, 'bun.lockb'))) return 'bun';
    if (fs.existsSync(path.join(this.rootPath, 'package.json'))) return 'npm';
    return null;
  }

  private findReadme(): string | null {
    for (const name of ['README.md', 'README', 'Readme.md', 'readme.md']) {
      const p = path.join(this.rootPath, name);
      if (fs.existsSync(p)) {
        try {
          return fs.readFileSync(p, 'utf-8').slice(0, 300);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private async discoverProjects(): Promise<string[]> {
    const projectsDir = path.join(this.rootPath, 'projects');
    if (!fs.existsSync(projectsDir)) return [];
    try {
      return fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => d.name)
        .sort();
    } catch {
      return [];
    }
  }

  private async globExists(pattern: string): Promise<boolean> {
    const parts = pattern.split('/');
    const globPart = parts[parts.length - 1] ?? '';
    if (globPart.includes('*')) return false;
    try {
      const { glob } = await import('glob');
      const matches = await glob(pattern, { cwd: this.rootPath, dot: false });
      return matches.length > 0;
    } catch {
      return false;
    }
  }

  private async detectLanguages(): Promise<string[]> {
    const langIndicators: Array<[string, string]> = [
      ['TypeScript', 'tsconfig.json'],
      ['JavaScript', 'package.json'],
      ['Rust', 'Cargo.toml'],
      ['Python', 'requirements.txt'],
      ['Go', 'go.mod'],
      ['Ruby', 'Gemfile'],
      ['Java', 'pom.xml'],
    ];

    const found: string[] = [];
    for (const [lang, indicator] of langIndicators) {
      if (fs.existsSync(path.join(this.rootPath, indicator))) {
        found.push(lang);
      }
    }

    return found;
  }

  private async findEntryPoints(): Promise<string[]> {
    const entries: string[] = [];
    for (const file of ['src/index.ts', 'src/main.ts', 'src/app.ts', 'index.ts', 'main.ts', 'src/index.js', 'index.js']) {
      const fullPath = path.join(this.rootPath, file);
      if (fs.existsSync(fullPath)) {
        entries.push(file);
      }
    }
    return entries;
  }
}
