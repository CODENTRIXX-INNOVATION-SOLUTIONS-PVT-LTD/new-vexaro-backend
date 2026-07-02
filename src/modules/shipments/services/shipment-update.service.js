'use strict';

const { findShipmentWithAccess } = require('../shared/shipment.helpers');
const { ShipmentStatus } = require('../../../constants');
const { UPDATABLE_FIELDS } = require('../shared/shipment.constants');

const updateShipmentService = async (shipmentId, dto, caller) => {
  const shipment = await findShipmentWithAccess(shipmentId, caller);

  // Non-terminal check
  const terminalStatuses = [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED, ShipmentStatus.RTO];
  if (terminalStatuses.includes(shipment.status)) {
    throw Object.assign(new Error(`Cannot update a shipment with status ${shipment.status}.`), { statusCode: 400 });
  }

  // Core fields updates are only allowed if status is ORDER_CREATED
  if (shipment.status !== ShipmentStatus.ORDER_CREATED) {
    const coreFields = ['weight', 'length', 'breadth', 'height', 'isCOD', 'codAmount', 'serviceType'];
    for (const f of coreFields) {
      if (dto[f] !== undefined) {
        throw Object.assign(new Error(`Cannot update core shipment fields once status is ${shipment.status}.`), { statusCode: 400 });
      }
    }
  }

  for (const field of UPDATABLE_FIELDS) {
    if (dto[field] !== undefined) shipment[field] = dto[field];
  }

  await shipment.save();
  return shipment;
};

module.exports = {
  updateShipmentService,
};
