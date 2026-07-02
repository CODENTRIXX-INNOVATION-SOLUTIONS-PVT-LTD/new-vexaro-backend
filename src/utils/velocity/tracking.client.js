'use strict';

const axios = require('axios');

class VelocityTrackingClient {
  constructor(baseClient) {
    this.baseClient = baseClient;
  }

  async getTrackingDetails(awbs) {
    try {
      const headers = await this.baseClient.getHeaders();
      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/order-tracking`,
        { awbs },
        { headers },
      );
      return response.data?.result || {};
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error('[VelocityClient] getTrackingDetails failed:', detail);
      throw Object.assign(new Error(`Velocity tracking failed: ${detail}`), { statusCode: 502 });
    }
  }
}

module.exports = VelocityTrackingClient;
