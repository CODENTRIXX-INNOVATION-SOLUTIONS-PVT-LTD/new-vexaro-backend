'use strict';

const axios = require('axios');
const logger = require('../logger');

class VelocityRateClient {
  constructor(baseClient) {
    this.baseClient = baseClient;
  }

  async checkServiceability(fromPincode, toPincode, isCOD = false, isForward = true) {
    let response;
    try {
      const headers = await this.baseClient.getHeaders();
      const payload = {
        from:          fromPincode.toString(),
        to:            toPincode.toString(),
        payment_mode:  isCOD ? 'cod' : 'prepaid',
        shipment_type: isForward ? 'forward' : 'return',
      };
      response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/serviceability`,
        payload,
        { headers },
      );
    } catch (httpErr) {
      // If Velocity says the token is expired/invalid, bust the cache and retry once
      const status = httpErr.response?.status;
      const msg    = JSON.stringify(httpErr.response?.data || '');
      if (status === 401 || msg.includes('CREDENTIALS_EXPIRED') || msg.includes('UID not found')) {
        await this.baseClient.invalidateToken();
        try {
          const freshHeaders = await this.baseClient.getHeaders();
          const payload2 = {
            from:          fromPincode.toString(),
            to:            toPincode.toString(),
            payment_mode:  isCOD ? 'cod' : 'prepaid',
            shipment_type: isForward ? 'forward' : 'return',
          };
          response = await axios.post(
            `${this.baseClient.baseUrl}custom/api/v1/serviceability`,
            payload2,
            { headers: freshHeaders },
          );
        } catch (retryErr) {
          const detail = retryErr.response?.data ? JSON.stringify(retryErr.response.data) : retryErr.message;
          logger.error('velocity_serviceability_http_failed', { error: detail });
          throw Object.assign(new Error(`Velocity serviceability check failed: ${detail}`), { statusCode: 502 });
        }
      } else {
        if (httpErr.statusCode) throw httpErr;
        const detail = httpErr.response?.data ? JSON.stringify(httpErr.response.data) : httpErr.message;
        logger.error('velocity_serviceability_http_failed', { error: detail });
        throw Object.assign(new Error(`Velocity serviceability check failed: ${detail}`), { statusCode: 502 });
      }
    }

    if (response.data?.status === 'SUCCESS') {
      return {
        carriers: response.data.result?.serviceability_results || [],
        zone:     response.data.result?.zone || null,
      };
    }

    const msg = response.data?.message || 'Velocity serviceability returned non-SUCCESS status';
    logger.warn('velocity_serviceability_non_success', { body: response.data });
    throw Object.assign(new Error(`Velocity serviceability check failed: ${msg}`), { statusCode: 502 });
  }

  async getRates(params) {
    let response;
    const buildPayload = (p) => {
      const payload = {
        journey_type:        p.journeyType,
        origin_pincode:      p.originPincode.toString(),
        destination_pincode: p.destinationPincode.toString(),
        dead_weight:         p.deadWeight,
        length:              p.length,
        width:               p.width,
        height:              p.height,
      };
      if (p.journeyType === 'forward') {
        payload.payment_method = p.paymentMethod;
        if (p.paymentMethod === 'cod') payload.shipment_value = p.shipmentValue;
      }
      if (p.journeyType === 'return') {
        payload.qc_applicable = p.qcApplicable !== false;
      }
      return payload;
    };

    try {
      const headers = await this.baseClient.getHeaders();
      response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/rates`,
        buildPayload(params),
        { headers },
      );
    } catch (httpErr) {
      const status = httpErr.response?.status;
      const msg    = JSON.stringify(httpErr.response?.data || '');
      if (status === 401 || msg.includes('CREDENTIALS_EXPIRED') || msg.includes('UID not found')) {
        await this.baseClient.invalidateToken();
        try {
          const freshHeaders = await this.baseClient.getHeaders();
          response = await axios.post(
            `${this.baseClient.baseUrl}custom/api/v1/rates`,
            buildPayload(params),
            { headers: freshHeaders },
          );
        } catch (retryErr) {
          const detail = retryErr.response?.data ? JSON.stringify(retryErr.response.data) : retryErr.message;
          logger.error('velocity_rates_http_failed', { error: detail });
          throw Object.assign(new Error(`Velocity rates fetch failed: ${detail}`), { statusCode: 502 });
        }
      } else {
        if (httpErr.statusCode) throw httpErr;
        const detail = httpErr.response?.data ? JSON.stringify(httpErr.response.data) : httpErr.message;
        logger.error('velocity_rates_http_failed', { error: detail });
        throw Object.assign(new Error(`Velocity rates fetch failed: ${detail}`), { statusCode: 502 });
      }
    }

    if (response.data?.status === 'SUCCESS') {
      return response.data.result;
    }

    const msg = response.data?.message || 'Velocity rates API returned non-SUCCESS status';
    logger.warn('velocity_rates_non_success', { body: response.data });
    throw Object.assign(new Error(`Velocity rates fetch failed: ${msg}`), { statusCode: 502 });
  }

  async getSummaryReport(startDateTime, endDateTime, shipmentType) {
    let response;
    try {
      const headers = await this.baseClient.getHeaders();
      response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/reports`,
        {
          start_date_time: startDateTime,
          end_date_time:   endDateTime,
          shipment_type:   shipmentType,
        },
        { headers },
      );
    } catch (httpErr) {
      if (httpErr.statusCode) throw httpErr;
      const detail = httpErr.response?.data
        ? JSON.stringify(httpErr.response.data)
        : httpErr.message;
      logger.error('velocity_summary_report_http_failed', { error: detail });
      throw Object.assign(
        new Error(`Velocity summary report failed: ${detail}`),
        { statusCode: 502 },
      );
    }

    if (response.data?.status === 'SUCCESS') {
      return response.data.payload;
    }

    const msg = response.data?.message || 'Velocity reports API returned non-SUCCESS status';
    logger.warn('velocity_summary_report_non_success', { body: response.data });
    throw Object.assign(new Error(`Velocity summary report failed: ${msg}`), { statusCode: 502 });
  }
}

module.exports = VelocityRateClient;
