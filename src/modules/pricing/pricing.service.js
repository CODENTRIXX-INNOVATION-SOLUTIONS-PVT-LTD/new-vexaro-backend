'use strict';

const { DEFAULT_SUPER_ADMIN_MARKUP } = require('./pricing.constants');
const { calculateVolumetricWeight, calculateBillingWeight } = require('./pricing.helpers');
const { findMatchingSlab } = require('./pricing.rules');

/**
 * Calculates shipping charges for carriers, distributors, and merchants.
 *
 * @param {Object} params
 * @param {Object} params.rateCard
 * @param {Object} [params.marginConfig]
 * @param {string} [params.distributorId]
 * @param {number} params.declaredWeight
 * @param {number} [params.length]
 * @param {number} [params.breadth]
 * @param {number} [params.height]
 * @param {boolean} [params.isCOD]
 * @param {number} [params.codAmount]
 * @returns {Object} Cost breakdown: carrierCost, distributorCost, merchantCost, vexaroProfit, distributorProfit
 */
const calculateShippingCost = (params) => {
  const {
    rateCard,
    marginConfig,
    distributorId,
    declaredWeight,
    length,
    breadth,
    height,
    isCOD = false,
    codAmount = 0,
  } = params;

  const volumetricWeight = calculateVolumetricWeight(length, breadth, height);
  const billingWeight = calculateBillingWeight(declaredWeight, volumetricWeight);

  const slab = findMatchingSlab(rateCard.weightSlabs, billingWeight);
  if (!slab) {
    throw Object.assign(new Error('No matching weight slab found in rate card.'), { statusCode: 400 });
  }

  // Carrier Cost calculations
  const baseCharge = (slab.baseRate || 0) + (slab.ratePerKg * billingWeight);
  const fuelCharge = baseCharge * (rateCard.fuelSurcharge / 100);
  const codCharge = isCOD ? (rateCard.codCharge + (codAmount * rateCard.codPercent / 100)) : 0;
  const carrierCost = parseFloat((baseCharge + fuelCharge + codCharge).toFixed(2));

  let distributorCost = 0;
  let merchantCost = 0;

  const saMarkup = rateCard.superAdminMarkupPercent ?? DEFAULT_SUPER_ADMIN_MARKUP;

  if (distributorId) {
    // Distributor buys to merchant
    distributorCost = parseFloat((carrierCost * (1 + saMarkup / 100)).toFixed(2));
    if (marginConfig) {
      // Distributor markup: distributorCost + distributorMargin + flatMargin
      const distributorMargin = parseFloat((distributorCost * (marginConfig.marginPercent || 0) / 100).toFixed(2));
      merchantCost = parseFloat((distributorCost + distributorMargin + (marginConfig.flatMargin || 0)).toFixed(2));
    } else {
      merchantCost = distributorCost;
    }
  } else {
    // Direct merchant (Vexaro sells directly at marked-up rate)
    distributorCost = carrierCost;
    merchantCost = parseFloat((carrierCost * (1 + saMarkup / 100)).toFixed(2));
  }

  const vexaroProfit = parseFloat((distributorCost - carrierCost).toFixed(2));
  const distributorProfit = parseFloat((merchantCost - distributorCost).toFixed(2));

  return {
    volumetricWeight,
    billingWeight,
    baseCharge: parseFloat(baseCharge.toFixed(2)),
    fuelCharge: parseFloat(fuelCharge.toFixed(2)),
    codCharge: parseFloat(codCharge.toFixed(2)),
    carrierCost,
    distributorCost,
    merchantCost,
    vexaroProfit,
    distributorProfit,
  };
};

module.exports = {
  calculateShippingCost,
};
