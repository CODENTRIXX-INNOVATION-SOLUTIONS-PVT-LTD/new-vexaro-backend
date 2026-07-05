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
    this.username = config.username || env.VELOCITY_USERNAME;
    this.password = config.password || env.VELOCITY_PASSWORD;
    this.cachedToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Returns a valid Velocity auth token.
   * L1: in-memory singleton (fastest — avoids Redis round-trip on every request).
   * L2: Redis (survives process restarts, shared across worker processes).
   * L3: Live Velocity auth-token API call.
   *
   * Token is refreshed 5 minutes before it expires to avoid a window where
   * requests fail while the token is technically still valid but about to expire.
   */
  async getAuthToken() {
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

    // L3 — Live fetch from Velocity
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
   * IMPORTANT: Velocity expects the raw token string as the Authorization value,
   * NOT "Bearer <token>". Sending "Bearer ..." will result in 401.
   */
  async getHeaders() {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      Authorization: token,   // raw token — NOT "Bearer token"
    };
  }
}

module.exports = VelocityBaseClient;
