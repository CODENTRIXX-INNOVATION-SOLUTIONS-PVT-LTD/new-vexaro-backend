'use strict';

const axios = require('axios');
const logger = require('../logger');

class VelocityTrackingClient {
  constructor(baseClient) {
    this.baseClient = baseClient;
  }

  /**
   * Fetch tracking details for one or more carrier AWBs.
   * @param {string[]} awbs  Array of carrier AWB codes
   * @returns {Object}  Map of { [awb]: trackingData }
   */
  async getTrackingDetails(awbs) {
    if (!awbs || awbs.length === 0) return {};

    let response;
    try {
      const headers = await this.baseClient.getHeaders();
      response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/order-tracking`,
        { awbs },
        { headers },
      );
    } catch (httpErr) {
      if (httpErr.statusCode) throw httpErr;
      const detail = httpErr.response?.data
        ? JSON.stringify(httpErr.response.data)
        : httpErr.message;
      logger.error('velocity_tracking_http_failed', { awbs, error: detail });
      throw Object.assign(
        new Error(`Velocity tracking failed: ${detail}`),
        { statusCode: 502 },
      );
    }

    // Normalise: always return a plain object, never null/undefined.
    if (response.data?.status === 'SUCCESS' || response.data?.result) {
      return response.data.result || {};
    }

    // Non-success is a soft failure for tracking — log a warning and return empty
    // rather than throwing so the shipment detail page still loads without tracking data.
    logger.warn('velocity_tracking_non_success', {
      awbs,
      status:  response.data?.status,
      message: response.data?.message,
    });
    return {};
  }
}

module.exports = VelocityTrackingClient;
