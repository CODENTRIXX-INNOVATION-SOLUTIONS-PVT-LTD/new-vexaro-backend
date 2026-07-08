'use strict';

const { UserRole, DisputeStatus } = require('../../../constants');
const { getPaginationParams } = require('../../../utils/pagination');
const disputeRepository = require('../dispute.repository');
const shipmentRepository = require('../../shipments/shipment.repository');
const { buildFilter } = require('../shared/dispute.helpers');

const toIdString = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const listDisputesService = async (query, caller) => {
  const filter = await buildFilter(caller, query);
  const { limit, skip } = getPaginationParams(query, 20);

  const [disputes, total] = await disputeRepository.findPaginated(filter, { skip, limit });
  return { items: disputes, total };
};

const createDisputeService = async (dto, caller) => {
  const shipmentRef = dto.shipmentAwb?.trim();
  const shipmentFilter = dto.shipmentId
    ? { _id: dto.shipmentId, deletedAt: null }
    : {
        deletedAt: null,
        $or: [
          { awb: shipmentRef.toUpperCase() },
          { carrierAWB: shipmentRef },
          { merchantOrderRef: shipmentRef },
          { velocityShipmentId: shipmentRef },
          { velocityOrderId: shipmentRef },
        ],
      };
  const shipment = await shipmentRepository.findOne(shipmentFilter);
  if (!shipment) throw Object.assign(new Error('Shipment not found'), { statusCode: 404 });

  if (caller.role === UserRole.MERCHANT && toIdString(shipment.merchantId) !== caller.userId.toString()) {
    throw Object.assign(new Error('You can only raise disputes for your own shipments'), { statusCode: 403 });
  }

  const existing = await disputeRepository.findOne({
    shipmentId: shipment._id,
    status: { $in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] }
  });
  if (existing) throw Object.assign(new Error('An active dispute already exists for this shipment'), { statusCode: 409 });

  return disputeRepository.create({
    shipmentId: shipment._id,
    category: dto.category,
    description: dto.description,
    attachments: dto.attachments || [],
    raisedBy: caller.userId,
  });
};

const getDisputeService = async (id, caller) => {
  const dispute = await disputeRepository.findById(id);
  if (!dispute) throw Object.assign(new Error('Dispute not found'), { statusCode: 404 });

  if (caller.role === UserRole.MERCHANT && toIdString(dispute.raisedBy) !== caller.userId.toString()) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  return dispute;
};

module.exports = {
  listDisputesService,
  createDisputeService,
  getDisputeService,
};
