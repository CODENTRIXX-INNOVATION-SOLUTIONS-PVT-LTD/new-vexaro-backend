'use strict';

const axios = require('axios');
const logger = require('../logger');

class VelocityWarehouseClient {
  constructor(baseClient) {
    this.baseClient = baseClient;
  }

  /**
   * Normalise a phone number to a 10-digit string.
   * Strips all non-digits and removes leading country code (91 prefix).
   * Returns an empty string (not null) if phone is absent — keeps the
   * Velocity payload valid even when phone is not provided.
   */
  formatPhoneNumber(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 10) return digits;
    // Return whatever we have — Velocity will validate on their end
    return digits;
  }

  async createWarehouse(warehouse, merchantName = '') {
    let response;
    try {
      const headers = await this.baseClient.getHeaders();
      const payload = {
        name:           warehouse.name || merchantName || `Warehouse-${warehouse.warehouseId}`,
        phone_number:   this.formatPhoneNumber(warehouse.phone || ''),
        email:          warehouse.email || 'warehouse@vexaro.in',
        contact_person: warehouse.contactPerson || merchantName || 'Contact',
        address_attributes: {
          street_address: warehouse.address,
          zip:            warehouse.pincode,
          city:           warehouse.city,
          state:          warehouse.state,
          country:        warehouse.country || 'India',
        },
      };

      // Only include gst_no if it's actually set — Velocity rejects empty string
      if (warehouse.gstNo) payload.gst_no = warehouse.gstNo;

      response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/warehouse`,
        payload,
        { headers },
      );
    } catch (httpErr) {
      if (httpErr.statusCode) throw httpErr;
      const detail = httpErr.response?.data
        ? JSON.stringify(httpErr.response.data)
        : httpErr.message;
      logger.error('velocity_warehouse_create_http_failed', { error: detail });
      throw Object.assign(
        new Error(`Velocity createWarehouse failed: ${detail}`),
        { statusCode: 502 },
      );
    }

    if (response.data?.status === 'SUCCESS') {
      const wid = response.data.payload?.warehouse_id;
      logger.info('velocity_warehouse_created', {
        velocityWarehouseId: wid,
        warehouseName:       warehouse.name || merchantName,
      });
      return wid;
    }

    const msg = response.data?.message || 'Velocity returned non-SUCCESS on warehouse create';
    logger.warn('velocity_warehouse_create_non_success', { body: response.data });
    throw Object.assign(
      new Error(`Velocity createWarehouse failed: ${msg}`),
      { statusCode: 502 },
    );
  }
}

module.exports = VelocityWarehouseClient;
