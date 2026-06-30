'use strict';

const { VOLUMETRIC_DIVISOR } = require('./pricing.constants');

/**
 * Calculates volumetric weight from dimensions.
 */
const calculateVolumetricWeight = (length, breadth, height) => {
  if (!length || !breadth || !height) return 0;
  return parseFloat(((length * breadth * height) / VOLUMETRIC_DIVISOR).toFixed(2));
};

/**
 * Calculates billing weight as max of declared and volumetric weight.
 */
const calculateBillingWeight = (declaredWeight, volumetricWeight) => {
  return Math.max(declaredWeight || 0, volumetricWeight || 0);
};

module.exports = {
  calculateVolumetricWeight,
  calculateBillingWeight,
};
