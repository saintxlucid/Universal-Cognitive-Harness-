import { loadSdk } from './providers.mjs';

for (const provider of ['openai', 'google', 'anthropic']) {
  await loadSdk(provider);
  console.log(`loaded ${provider}`);
}
