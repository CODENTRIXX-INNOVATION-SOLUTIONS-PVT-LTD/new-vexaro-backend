'use strict';

const { findShipmentWithAccess } = require('./shared/shipment.helpers');
const { listShipmentsService } = require('./services/shipment-list.service');
const { createShipmentService } = require('./services/shipment-create.service');
const { updateShipmentService } = require('./services/shipment-update.service');
const { deleteShipmentService } = require('./services/shipment-delete.service');
const { updateStatusService } = require('./services/shipment-status.service');
const { bulkUploadService, processBulkUploadAsync } = require('./services/shipment-bulk.service');
const { awbSearchService } = require('./services/shipment-tracking.service');
const { shipmentStatsService } = require('./services/shipment-stats.service');
const {
  checkServiceabilityService,
  getVelocityRatesService,
  reattemptVelocityDeliveryService,
  initiateVelocityRtoService,
  listVelocityForwardShipmentsService,
  listVelocityReturnShipmentsService,
} = require('./services/shipment-velocity.service');
const { createReverseShipmentService } = require('./services/shipment-reverse.service');
const { updateShipmentStatusFromVelocityWebhook } = require('./services/shipment-webhook.service');

const getShipmentByIdService = async (shipmentId, caller) => {
  return findShipmentWithAccess(shipmentId, caller);
};

module.exports = {
  listShipmentsService,
  createShipmentService,
  getShipmentByIdService,
  updateShipmentService,
  deleteShipmentService,
  updateStatusService,
  bulkUploadService,
  processBulkUploadAsync,
  awbSearchService,
  shipmentStatsService,
  checkServiceabilityService,
  getVelocityRatesService,
  reattemptVelocityDeliveryService,
  initiateVelocityRtoService,
  listVelocityForwardShipmentsService,
  listVelocityReturnShipmentsService,
  createReverseShipmentService,
  updateShipmentStatusFromVelocityWebhook,
};
