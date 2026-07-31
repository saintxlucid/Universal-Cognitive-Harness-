import { describe, it, expect, vi, afterEach } from 'vitest';
import { GoogleDriver } from '../drivers/google-driver.js';
import { LLMClient } from '../provider.js';

function mockFetch(body: unknown, ok = true, status = 200): void {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok,
    status,
    text: async () => text,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    body: null,
  })));
}

function mockStreamFetch(chunks: string[]): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({}),
    body: {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield new TextEncoder().encode(chunk);
        }
      },
    },
  })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GoogleDriver', () => {
  it('reports availability only with an API key', () => {
    expect(new GoogleDriver({ apiKey: '', model: 'gemini-2.0-flash' }).isAvailable).toBe(false);
    expect(new GoogleDriver({ apiKey: 'key', model: 'gemini-2.0-flash' }).isAvailable).toBe(true);
  });

  it('completes by posting generateContent and extracting text', async () => {
    mockFetch({
      candidates: [{ content: { parts: [{ text: 'hello from gemini' }] }, finishReason: 'STOP' }],
    });
    const driver = new GoogleDriver({ apiKey: 'k', model: 'gemini-2.0-flash' });
    const result = await driver.complete({
      messages: [{ role: 'user', content: 'say hello' }],
      temperature: 0.2,
      maxTokens: 100,
    });
    expect(result).toBe('hello from gemini');

    const fetchMock = vi.mocked(fetch);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(':generateContent');
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'k' });
    const body = JSON.parse(String(init.body));
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'say hello' }] }]);
    expect(body.generationConfig.maxOutputTokens).toBe(100);
  });

  it('sends system instructions separately', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
    const driver = new GoogleDriver({ apiKey: 'k', model: 'gemini-2.0-flash' });
    await driver.complete({
      messages: [
        { role: 'system', content: 'be terse' },
        { role: 'user', content: 'hi' },
      ],
    });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'be terse' }] });
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
  });

  it('maps assistant messages to model role', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
    const driver = new GoogleDriver({ apiKey: 'k', model: 'gemini-2.0-flash' });
    await driver.complete({
      messages: [
        { role: 'assistant', content: 'previous' },
        { role: 'user', content: 'next' },
      ],
    });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].role).toBe('model');
  });

  it('throws on API errors with status', async () => {
    mockFetch({ error: { message: 'quota' } }, false, 429);
    const driver = new GoogleDriver({ apiKey: 'k', model: 'gemini-2.0-flash' });
    await expect(driver.complete({ messages: [{ role: 'user', content: 'x' }] }))
      .rejects.toThrow(/Google API error 429/);
  });

  it('streams SSE deltas', async () => {
    mockStreamFetch([
      'data: {"candidates":[{"content":{"parts":[{"text":"hel"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"lo"}]}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
    const driver = new GoogleDriver({ apiKey: 'k', model: 'gemini-2.0-flash' });
    const chunks: string[] = [];
    for await (const text of driver.completeStream({ messages: [{ role: 'user', content: 'x' }] })) {
      chunks.push(text);
    }
    expect(chunks).toEqual(['hel', 'lo']);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain(':streamGenerateContent?alt=sse');
  });

  it('embeds via batchEmbedContents', async () => {
    mockFetch({
      embeddings: [
        { values: [0.1, 0.2] },
        { values: [0.3, 0.4] },
      ],
    });
    const driver = new GoogleDriver({ apiKey: 'k', model: 'gemini-2.0-flash' });
    const embeddings = await driver.embed({ input: ['a', 'b'] });
    expect(embeddings).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain(':batchEmbedContents');
    const body = JSON.parse(String(init.body));
    expect(body.requests).toHaveLength(2);
  });

  it('rejects mismatched embedding counts', async () => {
    mockFetch({ embeddings: [{ values: [0.1] }] });
    const driver = new GoogleDriver({ apiKey: 'k', model: 'gemini-2.0-flash' });
    await expect(driver.embed({ input: ['a', 'b'] })).rejects.toThrow(/returned 1 embeddings/);
  });
});

describe('LLMClient driver dispatch', () => {
  it('selects the google driver for provider google', () => {
    vi.stubEnv('UCH_LLM_PROVIDER', 'google');
    vi.stubEnv('GOOGLE_API_KEY', 'test-key');
    const llm = new LLMClient();
    expect(llm.provider).toBe('google');
    expect(llm.isAvailable).toBe(true);
    expect(llm.modelName).toBe('gemini-2.0-flash');
  });

  it('selects google in auto mode for gemini models', () => {
    vi.stubEnv('UCH_LLM_PROVIDER', 'auto');
    vi.stubEnv('GOOGLE_API_KEY', 'test-key');
    const llm = new LLMClient({ model: 'gemini-2.5-pro' });
    expect(llm.provider).toBe('google');
  });

  it('preserves the no-key no-op mode', () => {
    vi.stubEnv('OPENAI_API_KEY', undefined);
    vi.stubEnv('ANTHROPIC_API_KEY', undefined);
    vi.stubEnv('GOOGLE_API_KEY', undefined);
    const llm = new LLMClient();
    expect(llm.isAvailable).toBe(false);
  });
});
