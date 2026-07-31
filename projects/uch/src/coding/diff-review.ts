export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: Array<{ type: 'context' | 'added' | 'removed'; text: string }>;
}

export interface DiffFile {
  oldPath: string | null;
  newPath: string | null;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffSummary {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  changedFiles: number;
}

export type FindingSeverity = 'info' | 'warning' | 'error';

export interface ReviewFinding {
  file: string;
  line: number | null;
  severity: FindingSeverity;
  category: string;
  message: string;
  suggestion?: string;
}

export interface DiffReviewResult {
  summary: DiffSummary;
  findings: ReviewFinding[];
  reviewedAt: Date;
}

export interface DiffReviewOptions {
  maxFindingsPerFile?: number;
  checkTodoFixme?: boolean;
  checkDebugLogs?: boolean;
  checkLargeHunks?: boolean;
  checkDuplicateCode?: boolean;
  checkSecretLike?: boolean;
  checkConsoleLog?: boolean;
}

const LARGE_HUNK_THRESHOLD = 30;
const DUPLICATE_MIN_LINES = 4;

const SECRET_PATTERNS = [
  /api[_-]?key\s*[=:]\s*['"][^'"]{8,}['"]/i,
  /password\s*[=:]\s*['"][^'"]{6,}['"]/i,
  /secret\s*[=:]\s*['"][^'"]{8,}['"]/i,
  /token\s*[=:]\s*['"][^'"]{16,}['"]/i,
  /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/i,
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
];

export class DiffReview {
  private options: Required<DiffReviewOptions>;

  constructor(options?: DiffReviewOptions) {
    this.options = {
      maxFindingsPerFile: options?.maxFindingsPerFile ?? 20,
      checkTodoFixme: options?.checkTodoFixme ?? true,
      checkDebugLogs: options?.checkDebugLogs ?? true,
      checkLargeHunks: options?.checkLargeHunks ?? true,
      checkDuplicateCode: options?.checkDuplicateCode ?? true,
      checkSecretLike: options?.checkSecretLike ?? true,
      checkConsoleLog: options?.checkConsoleLog ?? true,
    };
  }

  parseUnifiedDiff(diff: string): DiffSummary {
    const files: DiffFile[] = [];
    let current: DiffFile | null = null;

    const lines = diff.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
      if (fileMatch) {
        if (current) files.push(current);
        const oldPath = fileMatch[1]!.includes('\t') ? fileMatch[1]!.split('\t')[0]! : fileMatch[1]!;
        const newPath = fileMatch[2]!.includes('\t') ? fileMatch[2]!.split('\t')[0]! : fileMatch[2]!;
        current = {
          oldPath,
          newPath,
          status: oldPath === newPath ? 'modified' : 'renamed',
          additions: 0,
          deletions: 0,
          hunks: [],
        };
        continue;
      }

      const addedFileMatch = line.match(/^--- \/dev\/null/);
      if (addedFileMatch && current) {
        current.status = 'added';
      }

      const deletedFileMatch = line.match(/^\+\+\+ \/dev\/null/);
      if (deletedFileMatch && current) {
        current.status = 'deleted';
      }

      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch && current) {
        current.hunks.push({
          oldStart: parseInt(hunkMatch[1]!, 10),
          oldLines: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
          newStart: parseInt(hunkMatch[3]!, 10),
          newLines: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
          lines: [],
        });
        continue;
      }

      if (current && current.hunks.length > 0) {
        const hunk = current.hunks[current.hunks.length - 1]!;
        if (line.startsWith('+') && !line.startsWith('+++')) {
          hunk.lines.push({ type: 'added', text: line.slice(1) });
          current.additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          hunk.lines.push({ type: 'removed', text: line.slice(1) });
          current.deletions++;
        } else if (line.startsWith(' ')) {
          hunk.lines.push({ type: 'context', text: line.slice(1) });
        }
      }
    }

    if (current) files.push(current);

    const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
    const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

    return { files, totalAdditions, totalDeletions, changedFiles: files.length };
  }

  review(diff: string, options?: DiffReviewOptions): DiffReviewResult {
    const opts = { ...this.options, ...options };
    const summary = this.parseUnifiedDiff(diff);
    const findings: ReviewFinding[] = [];

    for (const file of summary.files) {
      let fileFindings = 0;
      const targetPath = file.newPath ?? file.oldPath ?? '';

      const addedLines: Array<{ text: string; line: number }> = [];
      const newLineCounter = file.hunks[0]?.newStart ?? 1;

      for (const hunk of file.hunks) {
        if (opts.checkLargeHunks && hunk.lines.filter((l) => l.type !== 'context').length > LARGE_HUNK_THRESHOLD) {
          fileFindings++;
          findings.push({
            file: targetPath,
            line: hunk.newStart,
            severity: 'warning',
            category: 'complexity',
            message: `Large hunk with ${hunk.lines.filter((l) => l.type !== 'context').length} changed lines — consider splitting`,
          });
        }

        let currentNewLine = hunk.newStart;
        for (const line of hunk.lines) {
          if (line.type === 'added') {
            addedLines.push({ text: line.text, line: currentNewLine });
            currentNewLine++;
          } else if (line.type === 'context') {
            currentNewLine++;
          }
        }
      }

      for (const added of addedLines) {
        const text = added.text;

        if (opts.checkTodoFixme && /(TODO|FIXME|HACK|XXX)\b/i.test(text)) {
          fileFindings++;
          findings.push({
            file: targetPath,
            line: added.line,
            severity: 'info',
            category: 'tech-debt',
            message: `Leftover marker in new code: ${text.trim().slice(0, 80)}`,
          });
        }

        if (opts.checkDebugLogs && /\b(debugger\b|console\.debug\()/.test(text)) {
          fileFindings++;
          findings.push({
            file: targetPath,
            line: added.line,
            severity: 'warning',
            category: 'debugging',
            message: 'Debug statement added to new code',
            suggestion: 'Remove debugger/console.debug before committing',
          });
        }

        if (opts.checkConsoleLog && /\bconsole\.(log|info)\s*\(/.test(text)) {
          fileFindings++;
          findings.push({
            file: targetPath,
            line: added.line,
            severity: 'warning',
            category: 'debugging',
            message: 'console.log/info left in new code',
            suggestion: 'Use a proper logger or remove the statement',
          });
        }

        if (opts.checkSecretLike && SECRET_PATTERNS.some((re) => re.test(text))) {
          fileFindings++;
          findings.push({
            file: targetPath,
            line: added.line,
            severity: 'error',
            category: 'security',
            message: 'Possible secret or credential in new code',
            suggestion: 'Move secrets to environment variables or a secret store',
          });
        }
      }

      if (opts.checkDuplicateCode) {
        const addedTexts = addedLines.map((a) => a.text.trim());
        const seen = new Map<string, number>();
        const blocks: Array<{ key: string; count: number; line: number }> = [];
        for (let i = 0; i + DUPLICATE_MIN_LINES <= addedTexts.length; i++) {
          const block = addedTexts.slice(i, i + DUPLICATE_MIN_LINES).join('\n');
          if (block.length < 40) continue;
          const count = (seen.get(block) ?? 0) + 1;
          seen.set(block, count);
          if (count >= 2) {
            blocks.push({ key: block, count, line: addedLines[i]!.line });
          }
        }
        if (blocks.length > 0) {
          const first = blocks[0]!;
          fileFindings++;
          findings.push({
            file: targetPath,
            line: first.line,
            severity: 'warning',
            category: 'duplication',
            message: `Duplicate code block (${first.count} occurrences of ${DUPLICATE_MIN_LINES}+ lines)`,
            suggestion: 'Extract to a shared helper',
          });
        }
      }

      if (fileFindings > opts.maxFindingsPerFile) {
        findings.push({
          file: targetPath,
          line: null,
          severity: 'info',
          category: 'truncated',
          message: `Additional findings in ${targetPath} suppressed (limit ${opts.maxFindingsPerFile})`,
        });
      }

      void newLineCounter;
    }

    return { summary, findings, reviewedAt: new Date() };
  }

  summarize(result: DiffReviewResult): string {
    const s = result.summary;
    const lines = [
      `Changed files: ${s.changedFiles}`,
      `Additions: ${s.totalAdditions}, Deletions: ${s.totalDeletions}`,
      `Findings: ${result.findings.length} (errors: ${result.findings.filter((f) => f.severity === 'error').length}, warnings: ${result.findings.filter((f) => f.severity === 'warning').length})`,
    ];
    return lines.join('\n');
  }
}
