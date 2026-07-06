'use strict';

const VelocityBaseClient = require('./velocity/base.client');
const VelocityWarehouseClient = require('./velocity/warehouse.client');
const VelocityOrderClient = require('./velocity/order.client');
const VelocityTrackingClient = require('./velocity/tracking.client');
const VelocityRateClient = require('./velocity/rate.client');

class VelocityClient {
  constructor(config = {}) {
    this.baseClient = new VelocityBaseClient(config);
    this.warehouseClient = new VelocityWarehouseClient(this.baseClient);
    this.orderClient = new VelocityOrderClient(this.baseClient);
    this.trackingClient = new VelocityTrackingClient(this.baseClient);
    this.rateClient = new VelocityRateClient(this.baseClient);
  }

  get baseUrl() { return this.baseClient.baseUrl; }
  get username() { return this.baseClient.username; }
  get password() { return this.baseClient.password; }
  get cachedToken() { return this.baseClient.cachedToken; }
  set cachedToken(val) { this.baseClient.cachedToken = val; }
  get tokenExpiry() { return this.baseClient.tokenExpiry; }
  set tokenExpiry(val) { this.baseClient.tokenExpiry = val; }

  async getAuthToken() { return this.baseClient.getAuthToken(); }
  async getHeaders() { return this.baseClient.getHeaders(); }

  async createWarehouse(warehouse, merchantName = '') {
    return this.warehouseClient.createWarehouse(warehouse, merchantName);
  }

  async checkServiceability(fromPincode, toPincode, isCOD = false, isForward = true) {
    return this.rateClient.checkServiceability(fromPincode, toPincode, isCOD, isForward);
  }

  async createForwardOrder(shipment, merchant, warehouse, carrierId = '') {
    return this.orderClient.createForwardOrder(shipment, merchant, warehouse, carrierId);
  }

  async createReverseOrder(dto, velocityWarehouseId, carrierId = '') {
    return this.orderClient.createReverseOrder(dto, velocityWarehouseId, carrierId);
  }

  async cancelOrders(awbs) {
    return this.orderClient.cancelOrders(awbs);
  }

  async reattemptDelivery(payload) {
    return this.orderClient.reattemptDelivery(payload);
  }

  async initiateRto(awb) {
    return this.orderClient.initiateRto(awb);
  }

  async listForwardShipments(filters = {}) {
    return this.orderClient.listForwardShipments(filters);
  }

  async listReturnShipments(filters = {}) {
    return this.orderClient.listReturnShipments(filters);
  }

  async getTrackingDetails(awbs) {
    return this.trackingClient.getTrackingDetails(awbs);
  }

  async getRates(params) {
    return this.rateClient.getRates(params);
  }

  async getSummaryReport(startDateTime, endDateTime, shipmentType) {
    return this.rateClient.getSummaryReport(startDateTime, endDateTime, shipmentType);
  }
}

const velocityClient = new VelocityClient();

module.exports = {
  VelocityClient,
  velocityClient,
};
