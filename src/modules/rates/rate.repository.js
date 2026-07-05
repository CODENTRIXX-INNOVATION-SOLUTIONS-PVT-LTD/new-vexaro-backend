'use strict';

const { RateCard }     = require('./rate-card.model');
const { MarginConfig } = require('./margin-config.model');

/**
 * Rate Repository
 * Pure data-access layer — no business logic, no try/catch.
 */

// ─── Rate Cards ───────────────────────────────────────────────────────────────

/** Find all active rate cards, sorted. */
const findAllActiveCards = () =>
  RateCard.find({ isActive: true }).sort({ serviceType: 1, name: 1 }).lean();

/** Find a rate card by its _id. */
const findCardById = (id) => RateCard.findById(id);

/** Find a rate card matching a filter (first match). */
const findOneCard = (filter) => RateCard.findOne(filter);

/** Create a new rate card. */
const createCard = (data) => RateCard.create(data);

/** Update a rate card by _id and return the updated document. */
const updateCardById = (id, update, options = {}) =>
  RateCard.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true, ...options });

// ─── Margin Configs ───────────────────────────────────────────────────────────

/** Find one margin config matching a filter. */
const findOneMargin = (filter) => MarginConfig.findOne(filter);

/**
 * Paginated list of margin configs with population.
 * Returns [margins[], total].
 */
const findMarginsPaginated = async (filter, { skip, limit, sort = { createdAt: -1 } } = {}) => {
  return Promise.all([
    MarginConfig.find(filter)
      .populate('rateCardId',    'name serviceType')
      .populate('distributorId', 'firstName lastName email companyName')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    MarginConfig.countDocuments(filter),
  ]);
};

/**
 * Upsert a margin config (finds by distributorId+rateCardId, or creates).
 */
const upsertMargin = (filter, update, options = {}) =>
  MarginConfig.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after', runValidators: true, ...options });

module.exports = {
  // Rate Card
  findAllActiveCards,
  findCardById,
  findOneCard,
  createCard,
  updateCardById,
  // Margin Config
  findOneMargin,
  findMarginsPaginated,
  upsertMargin,
};
