import * as crypto from 'node:crypto';

export interface AuthConfig {
  jwtSecret?: string;
  tokenExpiryMs?: number;
}

export interface AgentIdentity {
  agentId: string;
  agentType: string;
  name: string;
  permissions: string[];
}

export interface AuthToken {
  token: string;
  agentId: string;
  agentType: string;
  issuedAt: Date;
  expiresAt: Date;
  permissions: string[];
}

export class Auth {
  private jwtSecret: string;
  private tokenExpiryMs: number;
  private apiKeys: Map<string, AgentIdentity> = new Map();
  private activeTokens: Map<string, AuthToken> = new Map();

  constructor(config?: AuthConfig) {
    this.jwtSecret = config?.jwtSecret ?? crypto.randomBytes(32).toString('hex');
    this.tokenExpiryMs = config?.tokenExpiryMs ?? 86_400_000;
  }

  registerAgent(agentId: string, agentType: string, name: string, permissions: string[]): { apiKey: string; identity: AgentIdentity } {
    const apiKey = `uccp_${crypto.randomBytes(24).toString('hex')}`;
    const identity: AgentIdentity = { agentId, agentType, name, permissions };
    this.apiKeys.set(apiKey, identity);
    return { apiKey, identity };
  }

  unregisterAgent(agentId: string): void {
    for (const [key, identity] of this.apiKeys) {
      if (identity.agentId === agentId) {
        this.apiKeys.delete(key);
      }
    }
    for (const [token, authToken] of this.activeTokens) {
      if (authToken.agentId === agentId) {
        this.activeTokens.delete(token);
      }
    }
  }

  authenticate(apiKey: string): { success: boolean; identity?: AgentIdentity; error?: string } {
    const identity = this.apiKeys.get(apiKey);
    if (!identity) {
      return { success: false, error: 'Invalid API key' };
    }
    return { success: true, identity };
  }

  createToken(apiKey: string): { token?: AuthToken; error?: string } {
    const auth = this.authenticate(apiKey);
    if (!auth.success || !auth.identity) {
      return { error: auth.error ?? 'Authentication failed' };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.tokenExpiryMs);
    const tokenId = crypto.randomBytes(16).toString('hex');

    const payload = JSON.stringify({
      sub: auth.identity.agentId,
      type: auth.identity.agentType,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      permissions: auth.identity.permissions,
      jti: tokenId,
    });

    const signature = crypto.createHmac('sha256', this.jwtSecret).update(payload).digest('hex');
    const tokenStr = `${Buffer.from(payload).toString('base64url')}.${signature}`;

    const token: AuthToken = {
      token: tokenStr,
      agentId: auth.identity.agentId,
      agentType: auth.identity.agentType,
      issuedAt: now,
      expiresAt,
      permissions: auth.identity.permissions,
    };

    this.activeTokens.set(tokenStr, token);
    return { token };
  }

  verifyToken(tokenStr: string): { valid: boolean; identity?: AgentIdentity; error?: string } {
    const token = this.activeTokens.get(tokenStr);
    if (!token) {
      return { valid: false, error: 'Token not found or revoked' };
    }

    if (new Date() > token.expiresAt) {
      this.activeTokens.delete(tokenStr);
      return { valid: false, error: 'Token expired' };
    }

    const [payloadB64, actualSig] = tokenStr.split('.');
    if (!payloadB64 || !actualSig) return { valid: false, error: 'Malformed token' };
    const decodedPayload = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const expectedSig = crypto.createHmac('sha256', this.jwtSecret).update(decodedPayload).digest('hex');
    if (expectedSig !== actualSig) {
      return { valid: false, error: 'Token signature invalid' };
    }

    return {
      valid: true,
      identity: { agentId: token.agentId, agentType: token.agentType, name: token.agentId, permissions: token.permissions },
    };
  }

  revokeToken(tokenStr: string): void {
    this.activeTokens.delete(tokenStr);
  }

  getAgents(): AgentIdentity[] {
    return [...this.apiKeys.values()];
  }

  checkPermission(agentId: string, requiredPermission: string): boolean {
    for (const [, identity] of this.apiKeys) {
      if (identity.agentId === agentId && identity.permissions.includes(requiredPermission)) {
        return true;
      }
    }
    return false;
  }

  registerApiKey(apiKey: string, identity: AgentIdentity): void {
    this.apiKeys.set(apiKey, identity);
  }

  generateServerToken(): string {
    const payload = JSON.stringify({
      sub: 'uccp-server',
      type: 'server',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      permissions: ['*'],
    });
    const signature = crypto.createHmac('sha256', this.jwtSecret).update(payload).digest('hex');
    const tokenStr = `${Buffer.from(payload).toString('base64url')}.${signature}`;
    return tokenStr;
  }
}
