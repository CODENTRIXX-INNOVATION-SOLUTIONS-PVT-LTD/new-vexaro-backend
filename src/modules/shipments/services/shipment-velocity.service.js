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

const getVelocityRatesService = async (dto, caller) => {
  const { RateCard } = require('../../rates/rate-card.model');
  const { MarginConfig } = require('../../rates/margin-config.model');
  const { calculateShippingCost } = require('../../pricing/pricing.service');
  const userRepository = require('../../users/user.repository');

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

  // Apply margin calculations if caller is provided
  if (caller) {
    let distributorId = null;
    let merchantId = null;

    if (caller.role === 'MERCHANT') {
      merchantId = caller.userId;
      const merchant = await userRepository.findOne({ _id: merchantId, deletedAt: null });
      if (merchant && merchant.invitedBy) {
        distributorId = merchant.invitedBy.toString();
      }
    } else if (caller.role === 'DISTRIBUTOR') {
      distributorId = caller.userId;
    }

    // Get rate card and margin config
    const rateCard = await RateCard.findOne({ serviceType: dto.serviceType || 'STANDARD', isActive: true });
    let marginConfig = null;
    
    if (distributorId && rateCard) {
      marginConfig = await MarginConfig.findOne({ distributorId, rateCardId: rateCard._id, isActive: true });
    }

    // Apply pricing to each carrier rate
    if (rateCard && result.carriers && result.carriers.length > 0) {
      const isCOD = dto.paymentMethod === 'cod';
      const codAmount = dto.shipmentValue || 0;

      result.carriers = result.carriers.map(carrier => {
        const charges = carrier.charges || {};
        const carrierCost = Number(
          charges.total_forward_charges
          ?? charges.total_return_charges
          ?? carrier.total_amount
          ?? carrier.rate
          ?? carrier.total
          ?? 0
        );

        // Calculate pricing with margins
        const pricing = calculateShippingCost({
          rateCard,
          marginConfig,
          distributorId,
          declaredWeight: dto.deadWeight ?? dto.deadWeightGrams,
          length: dto.length,
          breadth: dto.width,
          height: dto.height,
          isCOD,
          codAmount,
        });

        // Return carrier with merchant cost instead of raw carrier cost
        return {
          ...carrier,
          merchantCost: pricing.merchantCost,
          distributorCost: pricing.distributorCost,
          carrierCost: pricing.carrierCost,
          vexaroProfit: pricing.vexaroProfit,
          distributorProfit: pricing.distributorProfit,
        };
      });
    }
  }

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
