"use strict";

const { velocityClient } = require("../../../utils/velocity");
const { remember, TTL, KEYS } = require("../../../utils/cache");
const { UserRole, ShipmentStatus } = require("../../../constants");
const { Shipment } = require("../shipment.model");

const toIdString = (value) => {
  if (!value) return "";
  if (value._id) return value._id.toString();
  return value.toString();
};

const findShipmentByVelocityRef = async (awb) => {
  const ref = String(awb || "").trim();

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
    throw Object.assign(new Error("Shipment not found"), { statusCode: 404 });
  }

  if (
    caller.role === UserRole.MERCHANT &&
    toIdString(shipment.merchantId) !== caller.userId.toString()
  ) {
    throw Object.assign(
      new Error("Merchants can only manage their own shipments."),
      { statusCode: 403 },
    );
  }

  if (
    caller.role === UserRole.DISTRIBUTOR &&
    toIdString(shipment.distributorId) !== caller.userId.toString()
  ) {
    throw Object.assign(
      new Error("Distributors can only manage shipments assigned to them."),
      { statusCode: 403 },
    );
  }
};

const checkServiceabilityService = async (dto) => {
  const cacheKey = KEYS.serviceability(
    dto.fromPincode,
    dto.toPincode,
    dto.isCOD,
    dto.isForward,
  );

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
  const { RateCard } = require("../../rates/rate-card.model");
  const { MarginConfig } = require("../../rates/margin-config.model");
  const { calculateShippingCost } = require("../../pricing/pricing.service");
  const userRepository = require("../../users/user.repository");

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

  if (caller) {
    let distributorId = null;
    let merchantId = null;

    if (caller.role === "MERCHANT") {
      merchantId = caller.userId;

      const merchant = await userRepository.findOne({
        _id: merchantId,
        deletedAt: null,
      });

      if (merchant && merchant.invitedBy) {
        distributorId = merchant.invitedBy.toString();
      }
    } else if (caller.role === "DISTRIBUTOR") {
      distributorId = caller.userId;
    }

    const rateCard = await RateCard.findOne({
      serviceType: dto.serviceType || "STANDARD",
      isActive: true,
    });

    let marginConfig = null;

    if (distributorId && rateCard) {
      marginConfig = await MarginConfig.findOne({
        distributorId,
        rateCardId: rateCard._id,
        isActive: true,
      });
    }

    // if (rateCard && result.carriers && result.carriers.length > 0) {
    //   const isCOD = dto.paymentMethod === "cod";
    //   const codAmount = dto.shipmentValue || 0;

    //   result.carriers = result.carriers.map((carrier) => {
    //     const charges = carrier.charges || {};

    //     const carrierCost = Number(
    //       charges.total_forward_charges ??
    //         charges.total_return_charges ??
    //         carrier.total_amount ??
    //         carrier.rate ??
    //         carrier.total ??
    //         0,
    //     );

    //     const pricing = calculateShippingCost({
    //       rateCard,
    //       marginConfig,
    //       distributorId,
    //       declaredWeight: dto.deadWeight ?? dto.deadWeightGrams,
    //       length: dto.length,
    //       breadth: dto.width,
    //       height: dto.height,
    //       isCOD,
    //       codAmount,
    //     });

    //     return {
    //       ...carrier,
    //       merchantCost: pricing.merchantCost,
    //       distributorCost: pricing.distributorCost,
    //       carrierCost: pricing.carrierCost,
    //       vexaroProfit: pricing.vexaroProfit,
    //       distributorProfit: pricing.distributorProfit,
    //     };
    //   });
    // }
    // Apply pricing to each carrier rate.
    // Velocity may return either `serviceable_couriers` or `carriers`.
    const rawCarriers = result.serviceable_couriers || result.carriers || [];

    if (rawCarriers.length > 0) {
      const enrichedCarriers = rawCarriers.map((carrier) => {
        // Use the actual carrier rates from Velocity API response
        const carrierTotal = Number(
          carrier.charges?.total_forward_charges ??
          carrier.charges?.total_return_charges ??
          carrier.total_amount ??
          carrier.rate ??
          carrier.total ??
          0
        );

        let merchantCost = carrierTotal;
        let distributorCost = carrierTotal;
        let carrierCost = carrierTotal;
        let vexaroProfit = 0;
        let distributorProfit = 0;

        // Only apply margin if we have a rate card and margin config
        if (rateCard && marginConfig && distributorId) {
          const saMarkup = rateCard.superAdminMarkupPercent ?? 25;
          distributorCost = parseFloat((carrierCost * (1 + saMarkup / 100)).toFixed(2));
          
          const distributorMargin = parseFloat((distributorCost * (marginConfig.marginPercent || 0) / 100).toFixed(2));
          merchantCost = parseFloat((distributorCost + distributorMargin + (marginConfig.flatMargin || 0)).toFixed(2));
          
          vexaroProfit = parseFloat((distributorCost - carrierCost).toFixed(2));
          distributorProfit = parseFloat((merchantCost - distributorCost).toFixed(2));
        } else if (rateCard && distributorId) {
          // Apply super admin markup only
          const saMarkup = rateCard.superAdminMarkupPercent ?? 25;
          distributorCost = parseFloat((carrierCost * (1 + saMarkup / 100)).toFixed(2));
          merchantCost = distributorCost;
          vexaroProfit = parseFloat((distributorCost - carrierCost).toFixed(2));
        }

        return {
          ...carrier,
          merchantCost,
          distributorCost,
          carrierCost,
          vexaroProfit,
          distributorProfit,
        };
      });

      // Support both response formats.
      result.carriers = enrichedCarriers;
      result.serviceable_couriers = enrichedCarriers;
    }
  }

  return result;
};

const reattemptVelocityDeliveryService = async (dto, caller) => {
  const shipment = await findShipmentByVelocityRef(dto.awb);

  assertShipmentAccess(shipment, caller);

  if (!shipment.carrierAWB) {
    throw Object.assign(
      new Error(
        "Carrier AWB is required before requesting a Velocity reattempt.",
      ),
      { statusCode: 400 },
    );
  }

  if (shipment.status !== ShipmentStatus.DELIVERY_FAILED) {
    throw Object.assign(
      new Error("NDR reattempt is only allowed for delivery failed shipments."),
      { statusCode: 400 },
    );
  }

  const payload = {
    ...dto,
    awb: shipment.carrierAWB,
  };

  const velocityResult = await velocityClient.reattemptDelivery(payload);

  if (payload.updated_address?.address_line) {
    shipment.destination.addressLine = payload.updated_address.address_line;
  }

  if (payload.updated_address?.landmark) {
    shipment.destination.landmark = payload.updated_address.landmark;
  }

  if (payload.updated_phone_number) {
    shipment.destination.phone = payload.updated_phone_number;
  }

  if (shipment.status === ShipmentStatus.DELIVERY_FAILED) {
    shipment.status = ShipmentStatus.OUT_FOR_DELIVERY;
  }

  shipment.subStatus = "reattempt_delivery";

  shipment.statusHistory.push({
    status: shipment.status,
    updatedBy: caller.userId,
    note: `Velocity NDR reattempt requested.${
      payload.comments ? ` Comments: ${payload.comments}` : ""
    }`,
  });

  await shipment.save();

  return {
    velocityResult,
    shipment,
  };
};

const initiateVelocityRtoService = async (dto, caller) => {
  const shipment = await findShipmentByVelocityRef(dto.awb);

  assertShipmentAccess(shipment, caller);

  if (!shipment.carrierAWB) {
    throw Object.assign(
      new Error("Carrier AWB is required before initiating Velocity RTO."),
      { statusCode: 400 },
    );
  }

  if (shipment.status !== ShipmentStatus.DELIVERY_FAILED) {
    throw Object.assign(
      new Error(
        "RTO initiation is only allowed for delivery failed shipments.",
      ),
      { statusCode: 400 },
    );
  }

  const velocityResult = await velocityClient.initiateRto(shipment.carrierAWB);

  shipment.status = ShipmentStatus.RTO;
  shipment.subStatus = "rto_initiated";
  shipment.shipmentType = "rto";

  shipment.statusHistory.push({
    status: ShipmentStatus.RTO,
    updatedBy: caller.userId,
    note: "Velocity RTO initiated by user.",
  });

  await shipment.save();

  return {
    velocityResult,
    shipment,
  };
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
