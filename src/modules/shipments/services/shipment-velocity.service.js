'use strict';

const { velocityClient } = require('../../../utils/velocity');
const { remember, TTL, KEYS } = require('../../../utils/cache');

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

const reattemptVelocityDeliveryService = async (dto) => {
  return velocityClient.reattemptDelivery(dto);
};

const initiateVelocityRtoService = async (dto) => {
  return velocityClient.initiateRto(dto.awb);
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
