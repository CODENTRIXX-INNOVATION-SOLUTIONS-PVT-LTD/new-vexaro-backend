'use strict';

/**
 * Finds matching weight slab in rate card.
 */
const findMatchingSlab = (slabs, billingWeight) => {
  const sortedSlabs = [...slabs].sort((a, b) => a.upToKg - b.upToKg);
  return sortedSlabs.find(s => billingWeight <= s.upToKg) || sortedSlabs[sortedSlabs.length - 1];
};

module.exports = {
  findMatchingSlab,
};
