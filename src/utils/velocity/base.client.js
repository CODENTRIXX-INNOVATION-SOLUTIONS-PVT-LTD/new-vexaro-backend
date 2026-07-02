'use strict';

const axios = require('axios');
const { env } = require('../../config/env');
const logger = require('../logger');

class VelocityBaseClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || env.VELOCITY_BASE_URL;
    this.username = config.username || env.VELOCITY_USERNAME;
    this.password = config.password || env.VELOCITY_PASSWORD;
    this.cachedToken = null;
    this.tokenExpiry = null;
  }

  async getAuthToken() {
    const { get, set, KEYS, TTL } = require('../cache');

    if (this.cachedToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.cachedToken;
    }

    const redisToken = await get(KEYS.velocityToken());
    if (redisToken) {
      this.cachedToken = redisToken;
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      return redisToken;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}custom/api/v1/auth-token`,
        { username: this.username, password: this.password },
        { headers: { 'Content-Type': 'application/json' } },
      );

      if (response.data && response.data.token) {
        const token = response.data.token;
        this.cachedToken = token;
        this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
        await set(KEYS.velocityToken(), token, TTL.VELOCITY_TOKEN);
        logger.debug('velocity_auth_token_refreshed', { expiresAt: this.tokenExpiry });
        return token;
      }
      throw new Error('Authentication failed: token not found in Velocity response');
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('velocity_auth_failed', { error: detail });
      throw Object.assign(new Error(`Velocity authentication failed: ${detail}`), { statusCode: 503 });
    }
  }

  async getHeaders() {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      Authorization: token,
    };
  }
}

module.exports = VelocityBaseClient;
