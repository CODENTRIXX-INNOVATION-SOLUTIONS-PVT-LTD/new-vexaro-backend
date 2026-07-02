'use strict';

const axios = require('axios');

class VelocityRateClient {
  constructor(baseClient) {
    this.baseClient = baseClient;
  }

  async checkServiceability(fromPincode, toPincode, isCOD = false, isForward = true) {
    try {
      const headers = await this.baseClient.getHeaders();
      const payload = {
        from: fromPincode.toString(),
        to: toPincode.toString(),
        payment_mode: isCOD ? 'cod' : 'prepaid',
        shipment_type: isForward ? 'forward' : 'return',
      };

      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/serviceability`,
        payload,
        { headers },
      );

      if (response.data && response.data.status === 'SUCCESS') {
        return {
          carriers: response.data.result.serviceability_results || [],
          zone: response.data.result.zone || null,
        };
      }
      throw new Error(response.data?.message || 'Serviceability check returned non-SUCCESS status');
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error('[VelocityClient] checkServiceability failed:', detail);
      throw Object.assign(new Error(`Velocity serviceable check failed: ${detail}`), { statusCode: 502 });
    }
  }

  async getRates(params) {
    try {
      const headers = await this.baseClient.getHeaders();
      const payload = {
        journey_type: params.journeyType,
        origin_pincode: params.originPincode.toString(),
        destination_pincode: params.destinationPincode.toString(),
        dead_weight: params.deadWeight,
        length: params.length,
        width: params.width,
        height: params.height,
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

      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/rates`,
        payload,
        { headers },
      );

      if (response.data && response.data.status === 'SUCCESS') {
        return response.data.result;
      }
      throw new Error(response.data?.message || 'Velocity rates API returned non-SUCCESS status');
    } catch (err) {
      if (err.statusCode) throw err;
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error('[VelocityClient] getRates failed:', detail);
      throw Object.assign(new Error(`Velocity rates fetch failed: ${detail}`), { statusCode: 502 });
    }
  }

  async getSummaryReport(startDateTime, endDateTime, shipmentType) {
    try {
      const headers = await this.baseClient.getHeaders();
      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/reports`,
        {
          start_date_time: startDateTime,
          end_date_time: endDateTime,
          shipment_type: shipmentType,
        },
        { headers },
      );

      if (response.data && response.data.status === 'SUCCESS') {
        return response.data.payload;
      }
      throw new Error(response.data?.message || 'Velocity reports API returned non-SUCCESS status');
    } catch (err) {
      if (err.statusCode) throw err;
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error('[VelocityClient] getSummaryReport failed:', detail);
      throw Object.assign(new Error(`Velocity summary report failed: ${detail}`), { statusCode: 502 });
    }
  }
}

module.exports = VelocityRateClient;
