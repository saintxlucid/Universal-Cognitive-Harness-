const requiredEnvironment = {
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY'
};

export function providerStatus() {
  return Object.fromEntries(
    Object.entries(requiredEnvironment).map(([provider, variable]) => [provider, {
      environmentVariable: variable,
      configured: Boolean(process.env[variable])
    }])
  );
}

export async function loadSdk(provider) {
  switch (provider) {
    case 'openai': return import('openai');
    case 'google': return import('@google/genai');
    case 'anthropic': return import('@anthropic-ai/claude-agent-sdk');
    default: throw new Error(`Unsupported provider: ${provider}`);
  }
}
