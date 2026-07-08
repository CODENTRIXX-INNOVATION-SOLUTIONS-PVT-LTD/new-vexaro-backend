'use strict';

const { findShipmentWithAccess } = require('../shared/shipment.helpers');
const { ShipmentStatus, TransactionType } = require('../../../constants');
const { runInTransaction } = require('../../../utils/transaction');
const { velocityClient } = require('../../../utils/velocity');
const { applyTransaction } = require('../../finance/finance.service');
const { createNotification } = require('../../notifications/notification.service');
const { del, KEYS } = require('../../../utils/cache');

const { logAuditEvent } = require('../../audit/audit.service');

const toIdString = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const performCancellation = async (shipment, caller, session, velocityResult = null) => {
  if (shipment.status !== ShipmentStatus.ORDER_CREATED) {
    throw Object.assign(new Error('Cancellation is only allowed when status is ORDER_CREATED.'), { statusCode: 400 });
  }

  const ref = `REFUND-${shipment.awb}`;

  // Refund merchant
  if (shipment.merchantCost > 0) {
    const merchantIdStr = toIdString(shipment.merchantId);
    await applyTransaction(session, merchantIdStr, TransactionType.REFUND, shipment.merchantCost, {
      reference: `${ref}-MERCH`,
      shipmentId: shipment._id,
      performedBy: caller.userId,
      note: `Shipping refund for cancelled shipment ${shipment.awb}`,
    });
  }

  // Refund distributor
  if (shipment.distributorId && shipment.distributorCost > 0) {
    const distributorIdStr = toIdString(shipment.distributorId);
    await applyTransaction(session, distributorIdStr, TransactionType.REFUND, shipment.distributorCost, {
      reference: `${ref}-DIST`,
      shipmentId: shipment._id,
      performedBy: caller.userId,
      note: `Shipping refund for cancelled shipment ${shipment.awb}`,
    });
  }

  shipment.status = ShipmentStatus.CANCELLED;
  shipment.statusHistory.push({
    status: ShipmentStatus.CANCELLED,
    updatedBy: caller.userId,
    note: velocityResult
      ? `Shipment cancelled by user. Velocity response: ${typeof velocityResult === 'string' ? velocityResult : JSON.stringify(velocityResult)}`
      : 'Shipment cancelled by user',
  });
  await shipment.save({ session });
};

const deleteShipmentService = async (shipmentId, caller) => {
  const shipment = await findShipmentWithAccess(shipmentId, caller);

  if (shipment.status !== ShipmentStatus.ORDER_CREATED) {
    throw Object.assign(new Error('Cancellation is only allowed when status is ORDER_CREATED.'), { statusCode: 400 });
  }

  // 1. Velocity API call before local cancellation, so local state reflects a real carrier action.
  let velocityResult = null;
  if (shipment.velocityBooked && shipment.carrierAWB) {
    velocityResult = await velocityClient.cancelOrders([shipment.carrierAWB]);
  }

  // 2. Database mutations and refunds in a committed transaction
  const result = await runInTransaction(async (session) => {
    await performCancellation(shipment, caller, session, velocityResult);
    return {
      message: 'Shipment cancelled successfully.',
      velocityResult,
    };
  });

  // 3. Notifications & Audits
  try {
    await createNotification(toIdString(shipment.merchantId), {
      senderId: caller.userId,
      title: 'Shipment Cancelled',
      message: `Your shipment ${shipment.awb} has been cancelled and ₹${shipment.merchantCost.toFixed(2)} refunded.`,
      type: 'SHIPMENT',
    });
  } catch (err) {
    console.error('Failed to notify cancellation:', err);
  }

  logAuditEvent(caller.userId, 'SHIPMENT_CANCELLED', { awb: shipment.awb, refundAmount: shipment.merchantCost }, shipment._id);

  const toInvalidate = [toIdString(shipment.merchantId)].filter(Boolean);
  if (shipment.distributorId) toInvalidate.push(toIdString(shipment.distributorId));
  await Promise.all(toInvalidate.map(id => del(KEYS.shipmentStats(id))));

  return result;
};

module.exports = {
  performCancellation,
  deleteShipmentService,
};
