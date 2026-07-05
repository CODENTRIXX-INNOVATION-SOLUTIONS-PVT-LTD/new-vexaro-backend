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
      // Network / auth error — already tagged or wrap it
      if (httpErr.statusCode) throw httpErr;
      const detail = httpErr.response?.data
        ? JSON.stringify(httpErr.response.data)
        : httpErr.message;
      logger.error('velocity_serviceability_http_failed', { error: detail });
      throw Object.assign(
        new Error(`Velocity serviceability check failed: ${detail}`),
        { statusCode: 502 },
      );
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
    try {
      const headers = await this.baseClient.getHeaders();
      const payload = {
        journey_type:        params.journeyType,
        origin_pincode:      params.originPincode.toString(),
        destination_pincode: params.destinationPincode.toString(),
        dead_weight:         params.deadWeight,
        length:              params.length,
        width:               params.width,
        height:              params.height,
      };

      if (params.journeyType === 'forward') {
        payload.payment_method = params.paymentMethod;
        if (params.paymentMethod === 'cod') {
          payload.shipment_value = params.shipmentValue;
        }
      }

      if (params.journeyType === 'return') {
        payload.qc_applicable = params.qcApplicable !== false;
      }

      response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/rates`,
        payload,
        { headers },
      );
    } catch (httpErr) {
      if (httpErr.statusCode) throw httpErr;
      const detail = httpErr.response?.data
        ? JSON.stringify(httpErr.response.data)
        : httpErr.message;
      logger.error('velocity_rates_http_failed', { error: detail });
      throw Object.assign(
        new Error(`Velocity rates fetch failed: ${detail}`),
        { statusCode: 502 },
      );
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
