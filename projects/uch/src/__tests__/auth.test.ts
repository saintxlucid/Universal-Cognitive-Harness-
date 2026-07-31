import { describe, it, expect } from 'vitest';
import { Auth } from '../control-plane/auth/auth.js';

describe('Auth', () => {
  it('registers agents with API keys', () => {
    const auth = new Auth({ jwtSecret: 'test-secret' });
    const { apiKey, identity } = auth.registerAgent('agent-1', 'cli', 'Test Agent', ['read', 'write']);
    expect(apiKey).toMatch(/^uccp_/);
    expect(identity.agentId).toBe('agent-1');
    expect(identity.permissions).toContain('write');
  });

  it('authenticates with valid API key', () => {
    const auth = new Auth({ jwtSecret: 'test-secret' });
    auth.registerAgent('agent-1', 'cli', 'Test', ['read']);
    const { apiKey } = auth.registerAgent('agent-2', 'agent', 'Test2', ['read']);

    const result = auth.authenticate(apiKey);
    expect(result.success).toBe(true);
    expect(result.identity?.agentId).toBe('agent-2');
  });

  it('rejects invalid API key', () => {
    const auth = new Auth({ jwtSecret: 'test-secret' });
    const result = auth.authenticate('invalid-key');
    expect(result.success).toBe(false);
  });

  it('creates and verifies tokens', () => {
    const auth = new Auth({ jwtSecret: 'test-secret', tokenExpiryMs: 60000 });
    const { apiKey } = auth.registerAgent('agent-1', 'cli', 'Test', ['read']);

    const { token } = auth.createToken(apiKey);
    expect(token).toBeDefined();
    expect(token!.agentId).toBe('agent-1');

    const verification = auth.verifyToken(token!.token);
    expect(verification.valid).toBe(true);
    expect(verification.identity?.agentId).toBe('agent-1');
  });

  it('revokes tokens', () => {
    const auth = new Auth({ jwtSecret: 'test-secret' });
    const { apiKey } = auth.registerAgent('agent-1', 'cli', 'Test', ['read']);
    const { token } = auth.createToken(apiKey);

    auth.revokeToken(token!.token);
    const verification = auth.verifyToken(token!.token);
    expect(verification.valid).toBe(false);
  });

  it('checks permissions', () => {
    const auth = new Auth({ jwtSecret: 'test-secret' });
    auth.registerAgent('agent-1', 'cli', 'Test', ['read', 'write']);

    expect(auth.checkPermission('agent-1', 'read')).toBe(true);
    expect(auth.checkPermission('agent-1', 'delete')).toBe(false);
    expect(auth.checkPermission('unknown-agent', 'read')).toBe(false);
  });

  it('lists registered agents', () => {
    const auth = new Auth({ jwtSecret: 'test-secret' });
    auth.registerAgent('a1', 'cli', 'Agent 1', ['read']);
    auth.registerAgent('a2', 'agent', 'Agent 2', ['write']);

    const agents = auth.getAgents();
    expect(agents).toHaveLength(2);
  });

  it('unregisters agents', () => {
    const auth = new Auth({ jwtSecret: 'test-secret' });
    auth.registerAgent('agent-1', 'cli', 'Test', ['read']);
    auth.unregisterAgent('agent-1');

    expect(auth.getAgents()).toHaveLength(0);
  });

  it('generates server token', () => {
    const auth = new Auth({ jwtSecret: 'test-secret' });
    const token = auth.generateServerToken();
    expect(token).toContain('.');
  });
});
