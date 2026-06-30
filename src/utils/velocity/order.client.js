'use strict';

const axios = require('axios');
const logger = require('../logger');

class VelocityOrderClient {
  constructor(baseClient) {
    this.baseClient = baseClient;
  }

  async createForwardOrder(shipment, merchant, warehouse, carrierId = '') {
    try {
      const headers = await this.baseClient.getHeaders();

      const nameParts = shipment.destination.name.split(' ');
      const firstName = nameParts[0] || shipment.destination.name;
      const lastName = nameParts.slice(1).join(' ') || '';

      const orderDate = new Date(shipment.createdAt)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ');

      const velocityWHId = warehouse.velocityWarehouseId;
      if (!velocityWHId) {
        throw Object.assign(
          new Error(`Warehouse "${warehouse.warehouseId}" has not been synced to Velocity. Call POST /api/users/:id/sync-warehouse first.`),
          { statusCode: 422 },
        );
      }

      const payload = {
        order_id: shipment.merchantOrderRef || shipment.awb,
        order_date: orderDate,
        carrier_id: carrierId || undefined,

        billing_customer_name: firstName,
        billing_last_name: lastName,
        billing_address: shipment.destination.addressLine,
        billing_city: shipment.destination.city,
        billing_pincode: shipment.destination.pincode,
        billing_state: shipment.destination.state,
        billing_country: shipment.destination.country || 'India',
        billing_phone: shipment.destination.phone,
        billing_email: merchant.email,

        shipping_is_billing: true,
        print_label: true,

        order_items: [{
          name: shipment.notes || 'Courier Parcel',
          sku: shipment.merchantOrderRef || `VX-${shipment.awb}`,
          units: 1,
          selling_price: shipment.declaredValue || 1,
          discount: 0,
          tax: 0,
        }],

        payment_method: shipment.isCOD ? 'COD' : 'PREPAID',
        sub_total: shipment.declaredValue || 0,
        cod_collectible: shipment.isCOD ? (shipment.codAmount || 0) : 0,

        length: shipment.length || 10,
        breadth: shipment.breadth || 10,
        height: shipment.height || 10,
        weight: shipment.weight || 0.5,

        pickup_location: velocityWHId,
        warehouse_id: velocityWHId,

        vendor_details: {
          email: merchant.email,
          phone: warehouse.phone || merchant.phone || '9999999999',
          name: merchant.companyName || `${merchant.firstName} ${merchant.lastName}`,
          address: warehouse.address,
          city: warehouse.city,
          state: warehouse.state,
          country: warehouse.country || 'India',
          pin_code: warehouse.pincode,
          pickup_location: velocityWHId,
        },
      };

      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/forward-order-orchestration`,
        payload,
        { headers },
      );

      if (response.data && response.data.status === 1) {
        const p = response.data.payload;
        logger.info('velocity_forward_order_booked', {
          awb:            p.awb_code,
          velocityOrderId: p.order_id,
          carrierName:    p.courier_name,
          merchantOrderRef: shipment.merchantOrderRef || null,
        });
        return {
          awb: p.awb_code,
          shipmentId: p.shipment_id,
          velocityOrderId: p.order_id,
          carrierName: p.courier_name,
          carrierId: p.courier_company_id,
          labelUrl: p.label_url || null,
          charges: p.charges || null,
        };
      }
      throw new Error(response.data?.message || `Velocity returned status ${response.data?.status}`);
    } catch (err) {
      if (err.statusCode) throw err;
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('velocity_forward_order_failed', { error: detail });
      throw Object.assign(new Error(`Velocity order booking failed: ${detail}`), { statusCode: 502 });
    }
  }

  async createReverseOrder(dto, velocityWarehouseId, carrierId = '') {
    try {
      const headers = await this.baseClient.getHeaders();

      if (!velocityWarehouseId) {
        throw Object.assign(
          new Error('Destination warehouse has not been synced to Velocity. Call POST /api/users/:id/sync-warehouse first.'),
          { statusCode: 422 },
        );
      }

      const orderDate = new Date()
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ');

      const payload = {
        order_id: dto.orderId,
        order_date: dto.orderDate || orderDate,
        carrier_id: carrierId || undefined,

        pickup_customer_name: dto.pickupFirstName,
        pickup_last_name: dto.pickupLastName || '',
        company_name: dto.companyName || '',
        pickup_address: dto.pickupAddress,
        pickup_address_2: dto.pickupAddress2 || '',
        pickup_city: dto.pickupCity,
        pickup_state: dto.pickupState,
        pickup_country: dto.pickupCountry || 'India',
        pickup_pincode: dto.pickupPincode,
        pickup_email: dto.pickupEmail || '',
        pickup_phone: dto.pickupPhone,
        pickup_isd_code: dto.pickupIsdCode || '91',

        shipping_customer_name: dto.shippingFirstName,
        shipping_last_name: dto.shippingLastName || '',
        shipping_address: dto.shippingAddress,
        shipping_address_2: dto.shippingAddress2 || '',
        shipping_city: dto.shippingCity,
        shipping_state: dto.shippingState,
        shipping_country: dto.shippingCountry || 'India',
        shipping_pincode: dto.shippingPincode,
        shipping_email: dto.shippingEmail || '',
        shipping_phone: dto.shippingPhone,
        shipping_isd_code: dto.shippingIsdCode || '91',

        warehouse_id: velocityWarehouseId,

        order_items: dto.orderItems,
        payment_method: 'PREPAID',
        total_discount: dto.totalDiscount || 0,
        sub_total: dto.subTotal,

        length: dto.length,
        breadth: dto.breadth,
        height: dto.height,
        weight: dto.weight,
        request_pickup: dto.requestPickup !== false,
      };

      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/reverse-order-orchestration`,
        payload,
        { headers },
      );

      if (response.data && response.data.status === 1) {
        const p = response.data.payload;
        logger.info('velocity_reverse_order_booked', {
          awb:            p.awb_code,
          velocityOrderId: p.order_id,
          carrierName:    p.courier_name,
        });
        return {
          awb: p.awb_code,
          shipmentId: p.shipment_id,
          velocityOrderId: p.order_id,
          carrierName: p.courier_name,
          carrierId: p.courier_company_id,
          charges: p.charges || null,
        };
      }
      throw new Error(response.data?.message || `Velocity returned status ${response.data?.status}`);
    } catch (err) {
      if (err.statusCode) throw err;
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('velocity_reverse_order_failed', { error: detail });
      throw Object.assign(new Error(`Velocity reverse order booking failed: ${detail}`), { statusCode: 502 });
    }
  }

  async cancelOrders(awbs) {
    try {
      const headers = await this.baseClient.getHeaders();
      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/cancel-order`,
        { awbs },
        { headers },
      );
      logger.info('velocity_cancel_requested', { awbs, message: response.data?.message });
      return response.data?.message || 'Cancellation request submitted';
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('velocity_cancel_failed', { awbs, error: detail });
      throw Object.assign(new Error(`Velocity cancel failed: ${detail}`), { statusCode: 502 });
    }
  }
}

module.exports = VelocityOrderClient;
