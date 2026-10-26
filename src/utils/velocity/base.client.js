'use strict';

const axios = require('axios');
const { env } = require('../../config/env');
const logger = require('../logger');

// Buffer of 5 minutes — refresh the token before it actually expires
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_LIFETIME_MS = 23 * 60 * 60 * 1000; // 23 hours

class VelocityBaseClient {
  constructor(config = {}) {
    let url = config.baseUrl || env.VELOCITY_BASE_URL;
    if (url && !url.endsWith('/')) {
      url += '/';
    }
    this.baseUrl = url;
    this.apiKey = config.apiKey || env.VELOCITY_API_KEY;
    this.username = config.username || env.VELOCITY_USERNAME;
    this.password = config.password || env.VELOCITY_PASSWORD;
    this.cachedToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Returns a valid Velocity auth token.
   * Priority:
   * 1. Direct Dashboard API Key (VELOCITY_API_KEY)
   * 2. L1: in-memory singleton
   * 3. L2: Redis
   * 4. L3: Legacy auth-token endpoint (fallback)
   */
  async getAuthToken() {
    if (this.apiKey) {
      return this.apiKey;
    }

    const { get, set, KEYS, TTL } = require('../cache');

    // L1 — in-process memory cache
    if (this.cachedToken && this.tokenExpiry && new Date() < new Date(this.tokenExpiry.getTime() - TOKEN_EXPIRY_BUFFER_MS)) {
      return this.cachedToken;
    }

    // L2 — Redis (works when Redis is available; gracefully skipped when it's not)
    try {
      const redisToken = await get(KEYS.velocityToken());
      if (redisToken) {
        this.cachedToken = redisToken;
        this.tokenExpiry = new Date(Date.now() + TOKEN_LIFETIME_MS);
        logger.debug('velocity_token_from_redis');
        return redisToken;
      }
    } catch (redisErr) {
      // Redis unavailable — fall through to live fetch
      logger.warn('velocity_token_redis_unavailable', { error: redisErr.message });
    }

    // L3 — Live fetch from Velocity (Legacy endpoint)
    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}custom/api/v1/auth-token`,
        { username: this.username, password: this.password },
        { headers: { 'Content-Type': 'application/json' } },
      );
    } catch (httpErr) {
      const detail = httpErr.response?.data
        ? JSON.stringify(httpErr.response.data)
        : httpErr.message;
      logger.error('velocity_auth_http_failed', { error: detail });
      throw Object.assign(
        new Error(`Velocity authentication failed: ${detail}`),
        { statusCode: 503 },
      );
    }

    const token = response.data?.token;
    if (!token) {
      logger.error('velocity_auth_no_token', { body: JSON.stringify(response.data) });
      throw Object.assign(
        new Error('Velocity authentication failed: token not present in response'),
        { statusCode: 503 },
      );
    }

    this.cachedToken = token;
    this.tokenExpiry = new Date(Date.now() + TOKEN_LIFETIME_MS);

    // Store in Redis (fire-and-forget — a Redis failure here must not abort the request)
    set(KEYS.velocityToken(), token, TTL.VELOCITY_TOKEN).catch((err) => {
      logger.warn('velocity_token_redis_store_failed', { error: err.message });
    });

    logger.info('velocity_auth_token_refreshed', { expiresAt: this.tokenExpiry });
    return token;
  }

  /**
   * Returns HTTP headers for all Velocity API calls.
   * Velocity expects "Authorization: Bearer <your-token>"
   */
  async getHeaders() {
    const token = await this.getAuthToken();
    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    };
  }

  /**
   * Call this when any Velocity API returns 401/CREDENTIALS_EXPIRED.
   * Clears the in-memory and Redis token so the next getAuthToken() call
   * performs a live re-authentication instead of replaying the dead token.
   */
  async invalidateToken() {
    if (this.apiKey) {
      logger.warn('velocity_api_key_unauthorized', {
        message: 'Velocity API returned 401 with configured API key. Please verify key validity on the Velocity dashboard.',
      });
      return;
    }

    this.cachedToken = null;
    this.tokenExpiry = null;
    try {
      const { del, KEYS } = require('../cache');
      await del(KEYS.velocityToken());
    } catch (_) {
      // Redis unavailable — in-memory bust above is enough
    }
    logger.info('velocity_token_invalidated');
  }
}

module.exports = VelocityBaseClient;
