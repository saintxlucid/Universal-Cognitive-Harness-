export interface FileInfo {
  path: string;
  isDir?: boolean;
  size?: number;
  modifiedAt?: string;
}

export interface FileData {
  content: string;
  encoding: 'utf-8' | 'base64';
  createdAt?: string;
  modifiedAt?: string;
}

export type FileOperationError =
  | 'file_not_found'
  | 'permission_denied'
  | 'is_directory'
  | 'invalid_path';

export interface ReadResult {
  error: string | null;
  fileData: FileData | null;
}

export interface WriteResult {
  error: string | null;
  path: string | null;
}

export interface EditResult {
  error: string | null;
  path: string | null;
  occurrences: number | null;
}

export interface LsResult {
  error: string | null;
  entries: FileInfo[] | null;
}

export interface GrepMatch {
  path: string;
  line: number;
  text: string;
}

export interface GrepResult {
  error: string | null;
  matches: GrepMatch[] | null;
}

export interface GlobResult {
  error: string | null;
  matches: FileInfo[] | null;
}

export interface UploadResult {
  path: string;
  error: FileOperationError | string | null;
}

export interface DownloadResult {
  path: string;
  content: Uint8Array | null;
  error: FileOperationError | string | null;
}

export interface ExecuteResult {
  output: string;
  exitCode: number | null;
  truncated: boolean;
}

export interface BackendProtocol {
  readonly name: string;
  ls(path: string): Promise<LsResult>;
  read(filePath: string, offset?: number, limit?: number): Promise<ReadResult>;
  grep(pattern: string, path?: string, glob?: string): Promise<GrepResult>;
  glob(pattern: string, path?: string): Promise<GlobResult>;
  write(filePath: string, content: string): Promise<WriteResult>;
  edit(filePath: string, oldString: string, newString: string, replaceAll?: boolean): Promise<EditResult>;
  uploadFiles(files: { path: string; content: Uint8Array }[]): Promise<UploadResult[]>;
  downloadFiles(paths: string[]): Promise<DownloadResult[]>;
}

export interface SandboxBackendProtocol extends BackendProtocol {
  readonly id: string;
  execute(command: string, timeoutMs?: number): Promise<ExecuteResult>;
}

export function isSandboxBackend(backend: BackendProtocol): backend is SandboxBackendProtocol {
  return typeof (backend as SandboxBackendProtocol).execute === 'function';
}

export function resolvePermission(
  path: string,
  rules: FilesystemPermission[],
): FilesystemPermission | null {
  for (const rule of rules) {
    if (rule.matches(path)) return rule;
  }
  return null;
}

export interface FilesystemPermission {
  pattern: string;
  allow: boolean;
  matches(path: string): boolean;
}

export function createPermission(pattern: string, allow: boolean): FilesystemPermission {
  const compiled = compileGlobToRegex(pattern);
  return {
    pattern,
    allow,
    matches: (path: string) => compiled.test(normalizeForMatch(path)),
  };
}

export function compileGlobToRegex(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, '/');
  const source = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\/\*\*\//g, 'UCH_GLOB_DIR')
    .replace(/\*\*/g, 'UCH_GLOB_ANY')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/UCH_GLOB_DIR/g, '(?:/.*)?/')
    .replace(/UCH_GLOB_ANY/g, '.*');
  return new RegExp(`^${source}$`);
}

export function normalizeForMatch(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function matchesAnyPermission(path: string, rules: FilesystemPermission[]): boolean {
  const rule = resolvePermission(path, rules);
  return rule === null ? true : rule.allow;
}
