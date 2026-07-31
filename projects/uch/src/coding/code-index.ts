import * as fs from 'node:fs';
import * as path from 'node:path';

export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'const' | 'import' | 'export' | 'method';

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  endLine: number;
  signature: string;
  exported: boolean;
}

export interface FileIndex {
  file: string;
  symbols: CodeSymbol[];
  imports: Array<{ specifier: string; names: string[] }>;
  language: string;
  indexedAt: Date;
}

export interface DependencyEdge {
  from: string;
  to: string;
  specifier: string;
  kind: 'relative' | 'package' | 'absolute';
}

export interface ImpactReport {
  target: string;
  directDependents: string[];
  transitiveDependents: string[];
  affectedSymbols: Array<{ symbol: string; file: string }>;
  totalFiles: number;
}

export interface CodeIndexConfig {
  include?: string[];
  exclude?: string[];
}

const SUPPORTED_EXT: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript-react',
  '.js': 'javascript',
  '.jsx': 'javascript-react',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
};

const DEFAULT_EXCLUDE = [
  'node_modules', 'dist', 'build', 'out', '.git', '.next', '.turbo', '.cache',
  'coverage', '.venv', 'venv', 'vendor', '.nx', '.opencode', '.agent', '.claude',
  '.codex', '.vscode', '.idea', '__pycache__', '.mypy_cache', 'target', 'bin',
  'obj', '.egg-info',
];

export class CodeIndex {
  private config: Required<CodeIndexConfig>;
  private files: Map<string, FileIndex> = new Map();
  private importsByFile: Map<string, FileIndex['imports']> = new Map();
  private symbolsByName: Map<string, CodeSymbol[]> = new Map();
  private dependencyMap: Map<string, Set<string>> = new Map();
  private reverseDependencyMap: Map<string, Set<string>> = new Map();

  constructor(config?: CodeIndexConfig) {
    this.config = {
      include: config?.include ?? ['**/*.{ts,tsx,js,jsx,mjs,cjs,py,rs,go,java,rb,php,swift,kt}'],
      exclude: config?.exclude ?? DEFAULT_EXCLUDE,
    };
  }

  isSupported(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() in SUPPORTED_EXT;
  }

  languageOf(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_EXT[ext] ?? 'unknown';
  }

  async indexFile(filePath: string, content?: string): Promise<FileIndex> {
    const resolved = path.resolve(filePath);
    const source = content ?? (fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf-8') : '');
    const language = this.languageOf(resolved);

    const symbols: CodeSymbol[] = [];
    const imports: Array<{ specifier: string; names: string[] }> = [];

    const lines = source.split('\n');

    if (language === 'typescript' || language === 'typescript-react' || language === 'javascript' || language === 'javascript-react') {
      this.extractJSTypescript(lines, resolved, symbols, imports);
    } else if (language === 'python') {
      this.extractPython(lines, resolved, symbols, imports);
    } else {
      this.extractGeneric(lines, resolved, symbols, imports, language);
    }

    const fileIndex: FileIndex = {
      file: resolved,
      symbols,
      imports,
      language,
      indexedAt: new Date(),
    };

    this.files.set(resolved, fileIndex);
    this.importsByFile.set(resolved, imports);

    for (const symbol of symbols) {
      const existing = this.symbolsByName.get(symbol.name) ?? [];
      existing.push(symbol);
      this.symbolsByName.set(symbol.name, existing);
    }

    const dependencies = new Set<string>();
    for (const imp of imports) {
      const target = this.resolveImport(resolved, imp.specifier);
      if (target) {
        dependencies.add(target);
        const rev = this.reverseDependencyMap.get(target) ?? new Set<string>();
        rev.add(resolved);
        this.reverseDependencyMap.set(target, rev);
      }
    }
    this.dependencyMap.set(resolved, dependencies);

    return fileIndex;
  }

  indexDirectory(dirPath: string): Promise<number> {
    const files = this.walkFiles(dirPath);
    for (const file of files) {
      this.indexFile(file);
    }
    return Promise.resolve(files.length);
  }

  private walkFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (this.config.exclude.includes(entry.name)) continue;
        this.walkFiles(full, out);
      } else if (entry.isFile() && this.isSupported(full)) {
        out.push(full);
      }
    }
    return out;
  }

  private resolveImport(fromFile: string, specifier: string): string | null {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const baseDir = path.dirname(fromFile);
      const candidates = [
        path.resolve(baseDir, specifier),
        path.resolve(baseDir, specifier + '.ts'),
        path.resolve(baseDir, specifier + '.tsx'),
        path.resolve(baseDir, specifier + '.js'),
        path.resolve(baseDir, specifier + '.jsx'),
        path.resolve(baseDir, specifier, 'index.ts'),
        path.resolve(baseDir, specifier, 'index.js'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate) && this.isSupported(candidate)) return candidate;
      }
    }
    return null;
  }

  private extractJSTypescript(
    lines: string[],
    file: string,
    symbols: CodeSymbol[],
    imports: Array<{ specifier: string; names: string[] }>,
  ): void {
    const importRe = /^\s*import\s+(?:type\s+)?(?:\{([^}]*)\}|\*\s+as\s+(\w+)|(\w+))(?:,\s*\{([^}]*)\})?\s+from\s+['"]([^'"]+)['"]/;
    const dynamicRe = /^\s*(?:export\s+)?import\s*\(\s*['"]([^'"]+)['"]\s*\)/;
    const functionRe = /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/;
    const classRe = /^\s*(?:export\s+(?:default\s+)?)?class\s+(\w+)/;
    const interfaceRe = /^\s*(?:export\s+)?interface\s+(\w+)/;
    const typeRe = /^\s*(?:export\s+)?type\s+(\w+)\s*=/;
    const constRe = /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>|function)/;
    const methodRe = /^\s{2,}(?:async\s+)?(\w+)\(([^)]*)\)\s*[:{]/;
    const arrowConstRe = /^\s*(?:export\s+)?const\s+(\w+)\s*=/;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i]!;

      const importMatch = line.match(importRe);
      if (importMatch) {
        const specifier = importMatch[5] ?? '';
        const names: string[] = [];
        if (importMatch[1]) {
          for (const n of importMatch[1]!.split(',')) {
            const trimmed = n.trim().split(/\s+as\s+/)[0]!.trim();
            if (trimmed) names.push(trimmed);
          }
        }
        if (importMatch[2]) names.push(importMatch[2]);
        if (importMatch[3]) names.push(importMatch[3]);
        if (importMatch[4]) {
          for (const n of importMatch[4]!.split(',')) {
            const trimmed = n.trim().split(/\s+as\s+/)[0]!.trim();
            if (trimmed) names.push(trimmed);
          }
        }
        imports.push({ specifier, names });
        for (const name of names) {
          symbols.push({
            name,
            kind: 'import',
            file,
            line: i + 1,
            endLine: i + 1,
            signature: `import { ${name} } from '${specifier}'`,
            exported: false,
          });
        }
        i++;
        continue;
      }

      const dynamicMatch = line.match(dynamicRe);
      if (dynamicMatch) {
        imports.push({ specifier: dynamicMatch[1]!, names: [] });
        i++;
        continue;
      }

      const functionMatch = line.match(functionRe);
      if (functionMatch) {
        const startLine = i + 1;
        let endLine = startLine;
        let depth = 0;
        let j = i;
        while (j < lines.length) {
          endLine = j + 1;
          depth += (lines[j]!.match(/{/g) ?? []).length - (lines[j]!.match(/}/g) ?? []).length;
          if (depth <= 0 && j > i) break;
          j++;
        }
        symbols.push({
          name: functionMatch[1]!,
          kind: 'function',
          file,
          line: startLine,
          endLine,
          signature: line.trim().replace(/\s+/g, ' '),
          exported: line.includes('export'),
        });
        i = Math.max(i + 1, j);
        continue;
      }

      const classMatch = line.match(classRe);
      if (classMatch) {
        let endLine = i + 1;
        let depth = 0;
        let j = i;
        while (j < lines.length) {
          endLine = j + 1;
          depth += (lines[j]!.match(/{/g) ?? []).length - (lines[j]!.match(/}/g) ?? []).length;
          if (depth <= 0 && j > i) break;
          j++;
        }
        symbols.push({
          name: classMatch[1]!,
          kind: 'class',
          file,
          line: i + 1,
          endLine,
          signature: line.trim().replace(/\s+/g, ' '),
          exported: line.includes('export'),
        });
        i = Math.max(i + 1, j);
        continue;
      }

      const interfaceMatch = line.match(interfaceRe);
      if (interfaceMatch) {
        symbols.push({
          name: interfaceMatch[1]!,
          kind: 'interface',
          file,
          line: i + 1,
          endLine: i + 1,
          signature: line.trim().replace(/\s+/g, ' '),
          exported: line.includes('export'),
        });
        i++;
        continue;
      }

      const typeMatch = line.match(typeRe);
      if (typeMatch) {
        symbols.push({
          name: typeMatch[1]!,
          kind: 'type',
          file,
          line: i + 1,
          endLine: i + 1,
          signature: line.trim().replace(/\s+/g, ' '),
          exported: line.includes('export'),
        });
        i++;
        continue;
      }

      const constMatch = line.match(constRe);
      if (constMatch) {
        symbols.push({
          name: constMatch[1]!,
          kind: 'const',
          file,
          line: i + 1,
          endLine: i + 1,
          signature: line.trim().replace(/\s+/g, ' '),
          exported: line.includes('export'),
        });
        i++;
        continue;
      }

      const arrowMatch = line.match(arrowConstRe);
      if (arrowMatch) {
        symbols.push({
          name: arrowMatch[1]!,
          kind: 'const',
          file,
          line: i + 1,
          endLine: i + 1,
          signature: line.trim().replace(/\s+/g, ' '),
          exported: line.includes('export'),
        });
        i++;
        continue;
      }

      const methodMatch = line.match(methodRe);
      if (methodMatch && (line.includes(') {') || line.includes('):') || line.includes(') {'))) {
        symbols.push({
          name: methodMatch[1]!,
          kind: 'method',
          file,
          line: i + 1,
          endLine: i + 1,
          signature: line.trim().replace(/\s+/g, ' '),
          exported: false,
        });
      }

      i++;
    }
  }

  private extractPython(
    lines: string[],
    file: string,
    symbols: CodeSymbol[],
    imports: Array<{ specifier: string; names: string[] }>,
  ): void {
    const defRe = /^\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/;
    const classRe = /^\s*class\s+(\w+)/;
    const importRe = /^\s*(?:from\s+([\w.]+)\s+import\s+(.+)|import\s+(.+))$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const defMatch = line.match(defRe);
      if (defMatch) {
        symbols.push({
          name: defMatch[1]!,
          kind: 'function',
          file,
          line: i + 1,
          endLine: i + 1,
          signature: line.trim(),
          exported: !line.startsWith(' '),
        });
        continue;
      }
      const classMatch = line.match(classRe);
      if (classMatch) {
        symbols.push({
          name: classMatch[1]!,
          kind: 'class',
          file,
          line: i + 1,
          endLine: i + 1,
          signature: line.trim(),
          exported: !line.startsWith(' '),
        });
        continue;
      }
      const importMatch = line.match(importRe);
      if (importMatch) {
        if (importMatch[1]) {
          const names = importMatch[2]!.split(',').map((n) => n.trim().split(/\s+as\s+/)[0]!).filter(Boolean);
          imports.push({ specifier: importMatch[1], names });
        } else if (importMatch[3]) {
          const names = importMatch[3]!.split(',').map((n) => n.trim().split(/\s+as\s+/)[0]!).filter(Boolean);
          imports.push({ specifier: '', names });
        }
      }
    }
  }

  private extractGeneric(
    lines: string[],
    file: string,
    symbols: CodeSymbol[],
    imports: Array<{ specifier: string; names: string[] }>,
    language: string,
  ): void {
    const fnPatterns: Array<{ re: RegExp; kind: SymbolKind }> = [];
    if (language === 'go') {
      fnPatterns.push({ re: /^func\s+(\w+)/, kind: 'function' }, { re: /^type\s+(\w+)\s+struct/, kind: 'class' });
    } else if (language === 'rust') {
      fnPatterns.push({ re: /^(?:pub\s+)?fn\s+(\w+)/, kind: 'function' }, { re: /^(?:pub\s+)?struct\s+(\w+)/, kind: 'class' }, { re: /^(?:pub\s+)?trait\s+(\w+)/, kind: 'interface' });
    } else if (language === 'java' || language === 'kotlin') {
      fnPatterns.push({ re: /(?:public|private|protected)?\s*(?:static\s+)?[\w<>[\]]+\s+(\w+)\s*\(/, kind: 'method' }, { re: /(?:public|private|protected)?\s*(?:abstract\s+)?class\s+(\w+)/, kind: 'class' });
    } else if (language === 'ruby') {
      fnPatterns.push({ re: /^\s*def\s+(\w+)/, kind: 'method' }, { re: /^\s*class\s+(\w+)/, kind: 'class' });
    } else if (language === 'php') {
      fnPatterns.push({ re: /^\s*(?:public|private|protected)?\s*function\s+(\w+)/, kind: 'method' }, { re: /^\s*(?:abstract\s+)?class\s+(\w+)/, kind: 'class' });
    } else if (language === 'swift') {
      fnPatterns.push({ re: /^\s*(?:public|private|internal)?\s*func\s+(\w+)/, kind: 'function' }, { re: /^\s*(?:public|private|internal)?\s*(?:final\s+)?class\s+(\w+)/, kind: 'class' });
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const { re, kind } of fnPatterns) {
        const match = line.match(re);
        if (match) {
          symbols.push({
            name: match[1]!,
            kind,
            file,
            line: i + 1,
            endLine: i + 1,
            signature: line.trim(),
            exported: language === 'rust' ? line.includes('pub') : true,
          });
          break;
        }
      }
    }
  }

  getFileIndex(filePath: string): FileIndex | undefined {
    return this.files.get(path.resolve(filePath));
  }

  getAllFiles(): string[] {
    return [...this.files.keys()];
  }

  getSymbols(filePath: string): CodeSymbol[] {
    const resolved = path.resolve(filePath);
    return [...(this.files.get(resolved)?.symbols ?? [])];
  }

  findSymbol(name: string): CodeSymbol[] {
    return [...(this.symbolsByName.get(name) ?? [])];
  }

  getImports(filePath: string): FileIndex['imports'] {
    return [...(this.importsByFile.get(path.resolve(filePath)) ?? [])];
  }

  getDependencies(filePath: string): string[] {
    return [...(this.dependencyMap.get(path.resolve(filePath)) ?? [])];
  }

  getDependents(filePath: string): string[] {
    return [...(this.reverseDependencyMap.get(path.resolve(filePath)) ?? [])];
  }

  getImportGraph(): Array<{ from: string; to: string; specifier: string; kind: DependencyEdge['kind'] }> {
    const edges: Array<{ from: string; to: string; specifier: string; kind: DependencyEdge['kind'] }> = [];
    for (const [from, deps] of this.dependencyMap) {
      for (const to of deps) {
        const imports = this.importsByFile.get(from) ?? [];
        const specifier = imports.find((imp) => this.resolveImport(from, imp.specifier) === to)?.specifier ?? '';
        edges.push({
          from,
          to,
          specifier,
          kind: specifier.startsWith('.') || specifier.startsWith('/') ? 'relative' : 'package',
        });
      }
    }
    return edges;
  }

  impactAnalysis(filePath: string): ImpactReport {
    const resolved = path.resolve(filePath);
    const direct = this.getDependents(resolved);
    const visited = new Set<string>([resolved]);
    const transitive = new Set<string>();

    const queue = [...direct];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      transitive.add(current);
      for (const dep of this.getDependents(current)) {
        if (!visited.has(dep)) queue.push(dep);
      }
    }

    const affectedSymbols: Array<{ symbol: string; file: string }> = [];
    for (const file of [resolved, ...direct, ...transitive]) {
      for (const symbol of this.getSymbols(file)) {
        if (symbol.kind !== 'import') {
          affectedSymbols.push({ symbol: symbol.name, file });
        }
      }
    }

    return {
      target: resolved,
      directDependents: [...direct],
      transitiveDependents: [...transitive],
      affectedSymbols,
      totalFiles: affectedSymbols.length > 0 ? 1 + direct.length + transitive.size : 0,
    };
  }

  findUsages(name: string): Array<{ file: string; line: number }> {
    const usages: Array<{ file: string; line: number }> = [];
    for (const [file, fileIndex] of this.files) {
      const resolved = file;
      if (!fs.existsSync(resolved)) continue;
      const content = fs.readFileSync(resolved, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes(name)) {
          usages.push({ file: resolved, line: i + 1 });
        }
      }
      void fileIndex;
    }
    return usages;
  }

  getStats(): { files: number; symbols: number; imports: number; dependencies: number } {
    let symbols = 0;
    let imports = 0;
    let dependencies = 0;
    for (const [, fileIndex] of this.files) {
      symbols += fileIndex.symbols.length;
      imports += fileIndex.imports.length;
      dependencies += this.dependencyMap.get(fileIndex.file)?.size ?? 0;
    }
    return { files: this.files.size, symbols, imports, dependencies };
  }

  clear(): void {
    this.files.clear();
    this.importsByFile.clear();
    this.symbolsByName.clear();
    this.dependencyMap.clear();
    this.reverseDependencyMap.clear();
  }
}
