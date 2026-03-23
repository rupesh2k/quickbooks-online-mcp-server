import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TokenData {
  refreshToken: string;
  realmId: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
  lastUpdated?: number;
}

/**
 * TokenManager handles automatic storage and refresh of QuickBooks OAuth tokens
 * Tokens are stored in a persistent file and automatically refreshed when needed
 */
export class TokenManager {
  private tokenFilePath: string;
  private tokens: TokenData | null = null;

  constructor() {
    // Store tokens in the project root (gitignored)
    this.tokenFilePath = path.join(__dirname, '../../.qb-tokens.json');
    this.loadTokens();
  }

  /**
   * Load tokens from persistent storage
   */
  private loadTokens(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const data = fs.readFileSync(this.tokenFilePath, 'utf-8');
        this.tokens = JSON.parse(data);
        console.log('✓ Loaded existing tokens from storage');
      }
    } catch (error) {
      console.warn('Could not load tokens from storage:', error);
      this.tokens = null;
    }
  }

  /**
   * Save tokens to persistent storage
   */
  private saveTokens(): void {
    try {
      if (this.tokens) {
        fs.writeFileSync(
          this.tokenFilePath,
          JSON.stringify(this.tokens, null, 2),
          'utf-8'
        );
        console.log('✓ Saved tokens to persistent storage');
      }
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  /**
   * Initialize tokens from environment or OAuth flow
   */
  public initialize(refreshToken?: string, realmId?: string): void {
    // Try to load from storage first
    if (this.tokens) {
      console.log('Using tokens from persistent storage');
      return;
    }

    // If no stored tokens, use environment variables
    const envRefreshToken = refreshToken || process.env.QUICKBOOKS_REFRESH_TOKEN;
    const envRealmId = realmId || process.env.QUICKBOOKS_REALM_ID;

    if (envRefreshToken && envRealmId) {
      this.tokens = {
        refreshToken: envRefreshToken,
        realmId: envRealmId,
        lastUpdated: Date.now(),
      };
      this.saveTokens();
      console.log('✓ Initialized tokens from environment');
    } else {
      throw new Error(
        'No tokens available. Please authenticate first or provide QUICKBOOKS_REFRESH_TOKEN and QUICKBOOKS_REALM_ID'
      );
    }
  }

  /**
   * Update tokens after OAuth refresh
   */
  public updateTokens(data: {
    refreshToken?: string;
    accessToken?: string;
    realmId?: string;
    expiresIn?: number;
    refreshTokenExpiresIn?: number;
  }): void {
    if (!this.tokens) {
      this.tokens = {
        refreshToken: data.refreshToken || '',
        realmId: data.realmId || '',
      };
    }

    if (data.refreshToken) {
      this.tokens.refreshToken = data.refreshToken;
    }

    if (data.accessToken) {
      this.tokens.accessToken = data.accessToken;
      if (data.expiresIn) {
        // Access token typically expires in 1 hour (3600 seconds)
        this.tokens.accessTokenExpiresAt = Date.now() + data.expiresIn * 1000;
      }
    }

    if (data.realmId) {
      this.tokens.realmId = data.realmId;
    }

    if (data.refreshTokenExpiresIn) {
      // Refresh token expires in 100 days (8640000 seconds)
      this.tokens.refreshTokenExpiresAt = Date.now() + data.refreshTokenExpiresIn * 1000;
    }

    this.tokens.lastUpdated = Date.now();
    this.saveTokens();
    console.log('✓ Tokens updated and saved');
  }

  /**
   * Get the current refresh token
   */
  public getRefreshToken(): string {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available. Please authenticate first.');
    }
    return this.tokens.refreshToken;
  }

  /**
   * Get the realm ID (company ID)
   */
  public getRealmId(): string {
    if (!this.tokens?.realmId) {
      throw new Error('No realm ID available. Please authenticate first.');
    }
    return this.tokens.realmId;
  }

  /**
   * Get the access token (if available)
   */
  public getAccessToken(): string | undefined {
    return this.tokens?.accessToken;
  }

  /**
   * Check if access token is expired or about to expire
   */
  public isAccessTokenExpired(): boolean {
    if (!this.tokens?.accessTokenExpiresAt) {
      return true;
    }
    // Consider expired if less than 5 minutes remaining
    return Date.now() >= this.tokens.accessTokenExpiresAt - 5 * 60 * 1000;
  }

  /**
   * Check if refresh token is expired or about to expire
   */
  public isRefreshTokenExpiringSoon(): boolean {
    if (!this.tokens?.refreshTokenExpiresAt) {
      // If we don't know expiry, assume it might expire soon
      return false;
    }
    // Warn if less than 7 days remaining
    return Date.now() >= this.tokens.refreshTokenExpiresAt - 7 * 24 * 60 * 60 * 1000;
  }

  /**
   * Get token status information
   */
  public getTokenStatus(): {
    hasRefreshToken: boolean;
    hasAccessToken: boolean;
    accessTokenExpired: boolean;
    refreshTokenExpiringSoon: boolean;
    lastUpdated?: Date;
  } {
    return {
      hasRefreshToken: !!this.tokens?.refreshToken,
      hasAccessToken: !!this.tokens?.accessToken,
      accessTokenExpired: this.isAccessTokenExpired(),
      refreshTokenExpiringSoon: this.isRefreshTokenExpiringSoon(),
      lastUpdated: this.tokens?.lastUpdated ? new Date(this.tokens.lastUpdated) : undefined,
    };
  }

  /**
   * Clear all stored tokens (useful for testing or re-authentication)
   */
  public clearTokens(): void {
    this.tokens = null;
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
        console.log('✓ Cleared all stored tokens');
      }
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }
}

// Singleton instance
export const tokenManager = new TokenManager();
