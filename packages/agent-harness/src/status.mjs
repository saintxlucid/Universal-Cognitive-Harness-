import { providerStatus } from './providers.mjs';

console.log(JSON.stringify({
  package: '@workspace/agent-harness',
  providers: providerStatus(),
  note: 'SDK availability does not authorize API use. Configure credentials outside source control.'
}, null, 2));
