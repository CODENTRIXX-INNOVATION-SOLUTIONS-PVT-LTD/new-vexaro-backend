'use strict';

const axios = require('axios');
const logger = require('../logger');

class VelocityWarehouseClient {
  constructor(baseClient) {
    this.baseClient = baseClient;
  }

  async createWarehouse(warehouse, merchantName = '') {
    try {
      const headers = await this.baseClient.getHeaders();
      const payload = {
        name: warehouse.name || merchantName || `Warehouse-${warehouse.warehouseId}`,
        phone_number: warehouse.phone || '',
        email: warehouse.email || 'warehouse@vexaro.in',
        contact_person: warehouse.contactPerson,
        gst_no: warehouse.gstNo || undefined,
        address_attributes: {
          street_address: warehouse.address,
          zip: warehouse.pincode,
          city: warehouse.city,
          state: warehouse.state,
          country: warehouse.country || 'India',
        },
      };

      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/warehouse`,
        payload,
        { headers },
      );

      if (response.data && response.data.status === 'SUCCESS') {
        const wid = response.data.payload.warehouse_id;
        logger.info('velocity_warehouse_created', { velocityWarehouseId: wid, warehouseName: warehouse.name });
        return wid;
      }
      throw new Error(response.data?.message || 'Velocity returned non-SUCCESS status');
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('velocity_warehouse_create_failed', { error: detail });
      throw Object.assign(new Error(`Velocity createWarehouse failed: ${detail}`), { statusCode: 502 });
    }
  }
}

module.exports = VelocityWarehouseClient;
