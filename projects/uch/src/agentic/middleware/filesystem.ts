import type { AgentMiddleware } from './types.js';
import { buildTool } from '../tools/types.js';
import type { BackendProtocol, FilesystemPermission } from '../backends/protocol.js';
import { matchesAnyPermission } from '../backends/protocol.js';

export class FilesystemMiddleware implements AgentMiddleware {
  readonly name = 'FilesystemMiddleware';

  constructor(
    private readonly backend: BackendProtocol,
    private readonly permissions: FilesystemPermission[] = [],
  ) {}

  private allowed(path: string): boolean {
    return matchesAnyPermission(path, this.permissions);
  }

  tools() {
    const backend = this.backend;
    const permissions = this.permissions;

    const checkPath = (path: string): string | null => {
      if (!path.startsWith('/')) return 'Paths must be absolute (start with /)';
      if (!matchesAnyPermission(path, permissions)) {
        return `Permission denied for path: ${path}`;
      }
      return null;
    };

    return [
      buildTool({
        name: 'ls',
        description: 'List files and directories in the backend at the given absolute path.',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Absolute directory path' } },
          required: ['path'],
        },
        call: async (input: { path: string }) => {
          const error = checkPath(input.path);
          if (error) return { data: error, isError: true };
          const result = await backend.ls(input.path);
          if (result.error) return { data: `Error: ${result.error}`, isError: true };
          return { data: JSON.stringify(result.entries) };
        },
      }),
      buildTool({
        name: 'read_file',
        description: 'Read a file with line numbers (offset/limit for large files).',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute file path' },
            offset: { type: 'number', description: 'Starting line (0-based)', default: 0 },
            limit: { type: 'number', description: 'Max lines to read', default: 2000 },
          },
          required: ['path'],
        },
        call: async (input: { path: string; offset?: number; limit?: number }) => {
          const error = checkPath(input.path);
          if (error) return { data: error, isError: true };
          const result = await backend.read(input.path, input.offset ?? 0, input.limit ?? 2000);
          if (result.error) return { data: `Error: ${result.error}`, isError: true };
          const lines = (result.fileData?.content ?? '').split('\n');
          const numbered = lines.map((line, index) => `${(input.offset ?? 0) + index + 1}: ${line}`).join('\n');
          return { data: numbered };
        },
      }),
      buildTool({
        name: 'write_file',
        description: 'Write content to a NEW file. Fails if the file already exists.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute file path' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['path', 'content'],
        },
        call: async (input: { path: string; content: string }) => {
          const error = checkPath(input.path);
          if (error) return { data: error, isError: true };
          const result = await backend.write(input.path, input.content);
          if (result.error) return { data: `Error: ${result.error}`, isError: true };
          return { data: `Wrote ${input.path}` };
        },
      }),
      buildTool({
        name: 'edit_file',
        description: 'Edit a file by exact string replacement. Use replaceAll for multiple occurrences.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute file path' },
            old_string: { type: 'string', description: 'Exact string to replace' },
            new_string: { type: 'string', description: 'Replacement string' },
            replace_all: { type: 'boolean', description: 'Replace all occurrences', default: false },
          },
          required: ['path', 'old_string', 'new_string'],
        },
        call: async (input: { path: string; old_string: string; new_string: string; replace_all?: boolean }) => {
          const error = checkPath(input.path);
          if (error) return { data: error, isError: true };
          const result = await backend.edit(input.path, input.old_string, input.new_string, input.replace_all ?? false);
          if (result.error) return { data: `Error: ${result.error}`, isError: true };
          return { data: `Edited ${input.path} (${result.occurrences} occurrence${(result.occurrences ?? 0) === 1 ? '' : 's'})` };
        },
      }),
      buildTool({
        name: 'glob',
        description: 'Find files matching a glob pattern (e.g. **/*.ts) under a base path.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob pattern' },
            path: { type: 'string', description: 'Base directory', default: '/' },
          },
          required: ['pattern'],
        },
        call: async (input: { pattern: string; path?: string }) => {
          const base = input.path ?? '/';
          const error = checkPath(base);
          if (error) return { data: error, isError: true };
          const result = await backend.glob(input.pattern, base);
          if (result.error) return { data: `Error: ${result.error}`, isError: true };
          return { data: JSON.stringify(result.matches?.map((m) => m.path) ?? []) };
        },
      }),
      buildTool({
        name: 'grep',
        description: 'Search file contents for a literal string pattern.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Literal text to search (not regex)' },
            path: { type: 'string', description: 'Directory to search', default: '/' },
            glob: { type: 'string', description: 'Optional filename glob filter' },
          },
          required: ['pattern'],
        },
        call: async (input: { pattern: string; path?: string; glob?: string }) => {
          const error = checkPath(input.path ?? '/');
          if (error) return { data: error, isError: true };
          const result = await backend.grep(input.pattern, input.path ?? '/', input.glob);
          if (result.error) return { data: `Error: ${result.error}`, isError: true };
          return { data: JSON.stringify(result.matches) };
        },
      }),
    ];
  }
}
