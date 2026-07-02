'use strict';

const warehouseChangeRequestRepository = require('./warehouse-change-request.repository');
const warehouseRepository = require('./warehouse.repository');
const userRepository = require('./user.repository');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const { createNotification } = require('../notifications/notification.service');
const { logAuditEvent } = require('../audit/audit.service');
const { UserRole } = require('../../constants');
// Email functions will be lazy-required or imported from email utils
const emailUtils = require('../../utils/email');

/**
 * Submit an address change request for a warehouse.
 * Requires distributor approval. Enforces one PENDING request per warehouse at a time.
 */
const createAddressChangeRequestService = async (warehouseId, dto, merchantId) => {
  const warehouse = await warehouseRepository.findById(warehouseId);
  if (!warehouse) {
    throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });
  }

  if (warehouse.merchantId.toString() !== merchantId.toString()) {
    throw Object.assign(new Error('Access denied. Warehouse does not belong to you.'), { statusCode: 403 });
  }

  const existingPending = await warehouseChangeRequestRepository.findByWarehouse(warehouseId, 'PENDING');
  if (existingPending && existingPending.length > 0) {
    throw Object.assign(
      new Error('There is already a pending address change request for this warehouse.'),
      { statusCode: 409 },
    );
  }

  const merchant = await userRepository.findById(merchantId, true);
  if (!merchant) {
    throw Object.assign(new Error('Merchant account not found'), { statusCode: 404 });
  }

  let distributorId = null;
  if (merchant.invitedBy) {
    distributorId = merchant.invitedBy._id ? merchant.invitedBy._id.toString() : merchant.invitedBy.toString();
  }

  if (!distributorId) {
    const distributor = await userRepository.findOne({ role: UserRole.DISTRIBUTOR, isActive: true, deletedAt: null });
    if (distributor) {
      distributorId = distributor._id.toString();
    } else {
      const superAdmin = await userRepository.findOne({ role: UserRole.SUPER_ADMIN, isActive: true, deletedAt: null });
      distributorId = superAdmin ? superAdmin._id.toString() : merchantId;
    }
  }

  const currentAddress = {
    addressLine: warehouse.address,
    city:        warehouse.city,
    state:       warehouse.state,
    pincode:     warehouse.pincode,
    country:     warehouse.country || 'India',
  };

  const requestedAddress = {
    addressLine: dto.addressLine,
    city:        dto.city,
    state:       dto.state,
    pincode:     dto.pincode,
    country:     dto.country || 'India',
  };

  const request = await warehouseChangeRequestRepository.create({
    warehouseId,
    merchantId,
    distributorId,
    currentAddress,
    requestedAddress,
    status: 'PENDING',
  });

  logAuditEvent(
    merchantId,
    'WAREHOUSE_ADDRESS_CHANGE_REQUESTED',
    { requestId: request._id, warehouseId, requestedAddress },
    warehouse._id,
  );

  try {
    await createNotification(distributorId, {
      title:   'New Warehouse Address Change Request',
      message: `Merchant ${merchant.firstName} ${merchant.lastName} requested address change for warehouse ${warehouse.warehouseId}.`,
      type:    'SYSTEM',
    });
  } catch (notifErr) {
    console.error('Failed to send in-app notification to distributor:', notifErr.message);
  }

  setImmediate(async () => {
    try {
      const distributorUser = await userRepository.findById(distributorId);
      if (distributorUser && distributorUser.email && emailUtils.sendWarehouseChangeRequestEmail) {
        await emailUtils.sendWarehouseChangeRequestEmail({
          to:               distributorUser.email,
          merchantName:     `${merchant.firstName} ${merchant.lastName}`,
          warehouseId:      warehouse.warehouseId,
          currentAddress,
          requestedAddress,
        });
      }
    } catch (emailErr) {
      console.error('Failed to send address change email to distributor:', emailErr.message);
    }
  });

  return request;
};

/**
 * List address change requests with role-based filtering and pagination.
 */
const listChangeRequestsService = async (query, userId, role) => {
  const { page, limit, skip } = getPaginationParams(query, 20);
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  let requests, total;
  if (role === UserRole.DISTRIBUTOR) {
    [requests, total] = await warehouseChangeRequestRepository.findByDistributor(userId, filter, { skip, limit });
  } else {
    [requests, total] = await warehouseChangeRequestRepository.findByMerchant(userId, filter, { skip, limit });
  }

  const meta = buildPaginationMeta(total, page, limit);

  return {
    requests,
    pagination: meta,
  };
};

/**
 * Approve an address change request (Distributor only).
 * Updates primary warehouse address and request status to APPROVED.
 */
const approveAddressChangeRequestService = async (requestId, distributorId) => {
  const request = await warehouseChangeRequestRepository.findById(requestId);
  if (!request) {
    throw Object.assign(new Error('Address change request not found'), { statusCode: 404 });
  }

  if (request.distributorId.toString() !== distributorId.toString()) {
    throw Object.assign(new Error('Access denied. Request does not belong to your merchants.'), { statusCode: 403 });
  }

  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Address change request has already been processed or cancelled.'), { statusCode: 409 });
  }

  const updatedWarehouse = await warehouseRepository.updateAddress(request.warehouseId, {
    address: request.requestedAddress.addressLine,
    city:    request.requestedAddress.city,
    state:   request.requestedAddress.state,
    pincode: request.requestedAddress.pincode,
    country: request.requestedAddress.country,
  });

  request.status      = 'APPROVED';
  request.processedBy = distributorId;
  request.processedAt = new Date();
  await request.save();

  logAuditEvent(
    distributorId,
    'WAREHOUSE_ADDRESS_CHANGE_APPROVED',
    { requestId: request._id, warehouseId: request.warehouseId },
    request.warehouseId,
  );

  try {
    await createNotification(request.merchantId, {
      title:   'Warehouse Address Change Approved',
      message: `Your address change request for warehouse has been approved.`,
      type:    'SYSTEM',
    });
  } catch (notifErr) {
    console.error('Failed to send notification to merchant:', notifErr.message);
  }

  setImmediate(async () => {
    try {
      const merchantUser = await userRepository.findById(request.merchantId);
      const warehouseDoc = await warehouseRepository.findById(request.warehouseId);
      if (merchantUser && merchantUser.email && emailUtils.sendWarehouseChangeApprovedEmail) {
        await emailUtils.sendWarehouseChangeApprovedEmail({
          to:          merchantUser.email,
          warehouseId: warehouseDoc ? warehouseDoc.warehouseId : request.warehouseId.toString(),
          newAddress:  request.requestedAddress,
        });
      }
    } catch (emailErr) {
      console.error('Failed to send address change approval email to merchant:', emailErr.message);
    }
  });

  return request;
};

/**
 * Reject an address change request with a mandatory reason (Distributor only).
 */
const rejectAddressChangeRequestService = async (requestId, reason, distributorId) => {
  const request = await warehouseChangeRequestRepository.findById(requestId);
  if (!request) {
    throw Object.assign(new Error('Address change request not found'), { statusCode: 404 });
  }

  if (request.distributorId.toString() !== distributorId.toString()) {
    throw Object.assign(new Error('Access denied. Request does not belong to your merchants.'), { statusCode: 403 });
  }

  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Address change request has already been processed or cancelled.'), { statusCode: 409 });
  }

  request.status          = 'REJECTED';
  request.rejectionReason = reason;
  request.processedBy     = distributorId;
  request.processedAt     = new Date();
  await request.save();

  logAuditEvent(
    distributorId,
    'WAREHOUSE_ADDRESS_CHANGE_REJECTED',
    { requestId: request._id, warehouseId: request.warehouseId, reason },
    request.warehouseId,
  );

  try {
    await createNotification(request.merchantId, {
      title:   'Warehouse Address Change Rejected',
      message: `Your address change request was rejected. Reason: ${reason}`,
      type:    'SYSTEM',
    });
  } catch (notifErr) {
    console.error('Failed to send rejection notification to merchant:', notifErr.message);
  }

  setImmediate(async () => {
    try {
      const merchantUser = await userRepository.findById(request.merchantId);
      const warehouseDoc = await warehouseRepository.findById(request.warehouseId);
      if (merchantUser && merchantUser.email && emailUtils.sendWarehouseChangeRejectedEmail) {
        await emailUtils.sendWarehouseChangeRejectedEmail({
          to:              merchantUser.email,
          warehouseId:     warehouseDoc ? warehouseDoc.warehouseId : request.warehouseId.toString(),
          rejectionReason: reason,
        });
      }
    } catch (emailErr) {
      console.error('Failed to send address change rejection email to merchant:', emailErr.message);
    }
  });

  return request;
};

/**
 * Cancel a pending address change request (Merchant only).
 */
const cancelAddressChangeRequestService = async (requestId, merchantId) => {
  const request = await warehouseChangeRequestRepository.findById(requestId);
  if (!request) {
    throw Object.assign(new Error('Address change request not found'), { statusCode: 404 });
  }

  if (request.merchantId.toString() !== merchantId.toString()) {
    throw Object.assign(new Error('Access denied. Request does not belong to you.'), { statusCode: 403 });
  }

  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Address change request has already been processed or cancelled.'), { statusCode: 409 });
  }

  request.status = 'CANCELLED';
  await request.save();

  logAuditEvent(
    merchantId,
    'WAREHOUSE_ADDRESS_CHANGE_CANCELLED',
    { requestId: request._id, warehouseId: request.warehouseId },
    request.warehouseId,
  );

  return request;
};

module.exports = {
  createAddressChangeRequestService,
  listChangeRequestsService,
  approveAddressChangeRequestService,
  rejectAddressChangeRequestService,
  cancelAddressChangeRequestService,
};
