'use strict';

const axios = require('axios');
const logger = require('../logger');

function formatPhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const buildForwardOrderItems = (shipment) => {
  const items = Array.isArray(shipment.orderItems) ? shipment.orderItems : [];
  return items.map((item) => {
    const units = Number(item.quantity || 1);
    const sellingPrice = roundMoney(item.sellingPrice);
    const discount = roundMoney(item.discount);
    const taxAmount = roundMoney(item.tax);
    const taxableAmount = roundMoney((sellingPrice * units) - discount);

    // Vexaro stores tax as a currency amount, while Velocity expects this
    // field as a percentage. Convert only at the integration boundary so the
    // Velocity label total matches our stored order subtotal.
    const taxPercent = taxableAmount > 0
      ? Math.round(((taxAmount / taxableAmount) * 100) * 10000) / 10000
      : 0;

    return {
      name:          item.productName,
      sku:           item.sku,
      units,
      selling_price: sellingPrice,
      discount,
      tax:           taxPercent,
    };
  });
};

const sumItemField = (items, field) => {
  return roundMoney(items.reduce((sum, item) => sum + Number(item[field] || 0), 0));
};

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

      const orderItems = buildForwardOrderItems(shipment);
      if (!orderItems.length) {
        throw Object.assign(
          new Error(`Shipment "${shipment.awb}" has no order items. Add productName, sku, quantity, and sellingPrice before booking.`),
          { statusCode: 422 },
        );
      }

      const paymentMethod = shipment.paymentMethod || (shipment.isCOD ? 'COD' : 'PREPAID');
      const subTotal = roundMoney(shipment.subTotal || shipment.declaredValue);

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
        billing_phone: formatPhoneNumber(shipment.destination.phone),
        billing_email: shipment.destination.email || merchant.email,

        shipping_is_billing: true,
        print_label: true,

        order_items: orderItems,

        payment_method: paymentMethod,
        total_discount: roundMoney(shipment.totalDiscount || sumItemField(orderItems, 'discount')),
        sub_total: subTotal,
        cod_collectible: paymentMethod === 'COD' ? roundMoney(shipment.codAmount) : 0,

        length: shipment.length || 10,
        breadth: shipment.breadth || 10,
        height: shipment.height || 10,
        weight: shipment.weight || 0.5,

        pickup_location: warehouse.name || warehouse.warehouseId,
        warehouse_id: velocityWHId,

        vendor_details: {
          email: merchant.email,
          phone: formatPhoneNumber(warehouse.phone || merchant.phone || '9999999999'),
          name: merchant.companyName || `${merchant.firstName} ${merchant.lastName}`,
          address: warehouse.address,
          city: warehouse.city,
          state: warehouse.state,
          country: warehouse.country || 'India',
          pin_code: warehouse.pincode,
          pickup_location: warehouse.name || warehouse.warehouseId,
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
          manifestUrl: p.manifest_url || p.manifestUrl || null,
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
        payment_method: String(dto.paymentMethod || 'PREPAID').toUpperCase(),
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
          returnId: p.return_id || p.returnId || null,
          labelUrl: p.label_url || null,
          manifestUrl: p.manifest_url || p.manifestUrl || null,
          trackingUrl: p.tracking_url || (p.awb_code ? `https://www.velocityshipping.in/track/${p.awb_code}` : null),
          estimatedDelivery: p.estimated_delivery_date || p.edd || null,
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

  async reattemptDelivery(payload) {
    try {
      const headers = await this.baseClient.getHeaders();
      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/reattempt`,
        payload,
        { headers },
      );
      logger.info('velocity_reattempt_requested', { awb: payload.awb });
      return response.data;
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('velocity_reattempt_failed', { awb: payload.awb, error: detail });
      throw Object.assign(new Error(`Velocity reattempt failed: ${detail}`), { statusCode: 502 });
    }
  }

  async initiateRto(awb) {
    try {
      const headers = await this.baseClient.getHeaders();
      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/initiate-rto`,
        { awb },
        { headers },
      );
      logger.info('velocity_rto_requested', { awb });
      return response.data;
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('velocity_rto_failed', { awb, error: detail });
      throw Object.assign(new Error(`Velocity initiate RTO failed: ${detail}`), { statusCode: 502 });
    }
  }

  async listForwardShipments(filters = {}) {
    try {
      const headers = await this.baseClient.getHeaders();
      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/shipments`,
        filters,
        { headers },
      );
      return response.data;
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('velocity_forward_shipments_failed', { error: detail });
      throw Object.assign(new Error(`Velocity forward shipment details failed: ${detail}`), { statusCode: 502 });
    }
  }

  async listReturnShipments(filters = {}) {
    try {
      const headers = await this.baseClient.getHeaders();
      const response = await axios.post(
        `${this.baseClient.baseUrl}custom/api/v1/returns`,
        filters,
        { headers },
      );
      return response.data;
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('velocity_return_shipments_failed', { error: detail });
      throw Object.assign(new Error(`Velocity return shipment details failed: ${detail}`), { statusCode: 502 });
    }
  }
}

module.exports = VelocityOrderClient;
