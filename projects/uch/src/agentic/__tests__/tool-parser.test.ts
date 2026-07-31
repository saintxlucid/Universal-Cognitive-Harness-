import { describe, it, expect } from 'vitest';
import { parseToolCallsFromText, parseToolInput, parseKeyValuePairs, hasToolCallSyntax, renderToolCallXml } from '../model/tool-parser.js';

describe('tool parser', () => {
  it('parses tool calls with JSON input', () => {
    const calls = parseToolCallsFromText(
      'Let me check.\n<tool_call name="Read" id="call_1"><input>{"file_path":"src/main.ts"}</input></tool_call>',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('Read');
    expect(calls[0]?.id).toBe('call_1');
    expect(calls[0]?.input).toEqual({ file_path: 'src/main.ts' });
  });

  it('parses multiple tool calls', () => {
    const calls = parseToolCallsFromText(
      '<tool_call name="Grep" id="a"><input>{"pattern":"foo"}</input></tool_call>\n<tool_call name="Read" id="b"><input>{"file_path":"x"}</input></tool_call>',
    );
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.name)).toEqual(['Grep', 'Read']);
  });

  it('generates ids when missing', () => {
    const calls = parseToolCallsFromText('<tool_call name="Bash"><input>{"command":"ls"}</input></tool_call>');
    expect(calls[0]?.id).toBeTruthy();
    expect(calls[0]?.id).toMatch(/^tc_/);
  });

  it('parses inline self-closing calls', () => {
    const calls = parseToolCallsFromText('text <tool_call name="TodoWrite" />');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('TodoWrite');
    expect(calls[0]?.input).toEqual({});
  });

  it('skips malformed calls', () => {
    const calls = parseToolCallsFromText('no calls here');
    expect(calls).toHaveLength(0);
  });

  it('handles input without JSON wrapper', () => {
    const input = parseToolInput('command=ls timeout=5');
    expect(input).toEqual({ command: 'ls', timeout: '5' });
  });

  it('handles empty input', () => {
    expect(parseToolInput('')).toEqual({});
  });

  it('handles XML-wrapped input', () => {
    expect(parseToolInput('<input>{"a":1}</input>')).toEqual({ a: 1 });
  });

  it('detects tool call syntax', () => {
    expect(hasToolCallSyntax('<tool_call name="Bash">')).toBe(true);
    expect(hasToolCallSyntax('plain text')).toBe(false);
  });

  it('renders XML back', () => {
    const xml = renderToolCallXml([{ id: 'c1', name: 'Read', input: { file_path: 'a' } }]);
    expect(xml).toContain('name="Read"');
    expect(xml).toContain('id="c1"');
    expect(xml).toContain('"file_path":"a"');
  });

  it('parses key-value pairs', () => {
    expect(parseKeyValuePairs('a=1\nb="hello world"')).toEqual({ a: '1', b: 'hello world' });
    expect(parseKeyValuePairs('garbage line')).toEqual({});
  });
});
