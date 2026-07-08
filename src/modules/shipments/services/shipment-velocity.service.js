'use strict';

const { velocityClient } = require('../../../utils/velocity');
const { remember, TTL, KEYS } = require('../../../utils/cache');
const { UserRole, ShipmentStatus } = require('../../../constants');
const { Shipment } = require('../shipment.model');

const toIdString = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const findShipmentByVelocityRef = async (awb) => {
  const ref = String(awb || '').trim();
  return Shipment.findOne({
    deletedAt: null,
    $or: [
      { awb: ref.toUpperCase() },
      { carrierAWB: ref },
      { velocityShipmentId: ref },
      { velocityOrderId: ref },
      { merchantOrderRef: ref },
    ],
  });
};

const assertShipmentAccess = (shipment, caller) => {
  if (!shipment) {
    throw Object.assign(new Error('Shipment not found'), { statusCode: 404 });
  }
  if (caller.role === UserRole.MERCHANT && toIdString(shipment.merchantId) !== caller.userId.toString()) {
    throw Object.assign(new Error('Merchants can only manage their own shipments.'), { statusCode: 403 });
  }
  if (caller.role === UserRole.DISTRIBUTOR && toIdString(shipment.distributorId) !== caller.userId.toString()) {
    throw Object.assign(new Error('Distributors can only manage shipments assigned to them.'), { statusCode: 403 });
  }
};

const checkServiceabilityService = async (dto) => {
  const cacheKey = KEYS.serviceability(dto.fromPincode, dto.toPincode, dto.isCOD, dto.isForward);
  return remember(cacheKey, TTL.SERVICEABILITY, async () => {
    const result = await velocityClient.checkServiceability(
      dto.fromPincode,
      dto.toPincode,
      dto.isCOD !== false,
      dto.isForward !== false,
    );

    return {
      serviceable: result.carriers.length > 0,
      carriers: result.carriers,
      zone: result.zone,
      fromPincode: dto.fromPincode,
      toPincode: dto.toPincode,
    };
  });
};

const getVelocityRatesService = async (dto) => {
  const result = await velocityClient.getRates({
    journeyType: dto.journeyType,
    originPincode: dto.originPincode,
    destinationPincode: dto.destinationPincode,
    deadWeight: dto.deadWeight ?? dto.deadWeightGrams,
    length: dto.length,
    width: dto.width,
    height: dto.height,
    paymentMethod: dto.paymentMethod || undefined,
    shipmentValue: dto.shipmentValue || undefined,
    qcApplicable: dto.qcApplicable,
  });

  return result;
};

const reattemptVelocityDeliveryService = async (dto, caller) => {
  const shipment = await findShipmentByVelocityRef(dto.awb);
  assertShipmentAccess(shipment, caller);
  if (!shipment.carrierAWB) {
    throw Object.assign(new Error('Carrier AWB is required before requesting a Velocity reattempt.'), { statusCode: 400 });
  }

  const payload = {
    ...dto,
    awb: shipment.carrierAWB,
  };
  const velocityResult = await velocityClient.reattemptDelivery(payload);

  if (payload.updated_address?.address_line) {
    shipment.destination.addressLine = payload.updated_address.address_line;
  }
  if (payload.updated_phone_number) {
    shipment.destination.phone = payload.updated_phone_number;
  }

  if (shipment.status === ShipmentStatus.DELIVERY_FAILED) {
    shipment.status = ShipmentStatus.OUT_FOR_DELIVERY;
  }
  shipment.subStatus = 'reattempt_delivery';
  shipment.statusHistory.push({
    status: shipment.status,
    updatedBy: caller.userId,
    note: `Velocity NDR reattempt requested.${payload.comments ? ` Comments: ${payload.comments}` : ''}`,
  });
  await shipment.save();

  return { velocityResult, shipment };
};

const initiateVelocityRtoService = async (dto, caller) => {
  const shipment = await findShipmentByVelocityRef(dto.awb);
  assertShipmentAccess(shipment, caller);
  if (!shipment.carrierAWB) {
    throw Object.assign(new Error('Carrier AWB is required before initiating Velocity RTO.'), { statusCode: 400 });
  }

  const velocityResult = await velocityClient.initiateRto(shipment.carrierAWB);

  shipment.status = ShipmentStatus.RTO;
  shipment.subStatus = 'rto_initiated';
  shipment.shipmentType = 'rto';
  shipment.statusHistory.push({
    status: ShipmentStatus.RTO,
    updatedBy: caller.userId,
    note: 'Velocity RTO initiated by user.',
  });
  await shipment.save();

  return { velocityResult, shipment };
};

const listVelocityForwardShipmentsService = async (filters) => {
  return velocityClient.listForwardShipments(filters);
};

const listVelocityReturnShipmentsService = async (filters) => {
  return velocityClient.listReturnShipments(filters);
};

module.exports = {
  checkServiceabilityService,
  getVelocityRatesService,
  reattemptVelocityDeliveryService,
  initiateVelocityRtoService,
  listVelocityForwardShipmentsService,
  listVelocityReturnShipmentsService,
};
