'use strict';

const { Shipment }   = require('../shipments/shipment.model');
const { Wallet, Transaction, COD } = require('../finance/finance.model');
const { Payment }    = require('../finance/payment.model');
const { User }       = require('../users/user.model');

/**
 * Report Repository
 * Pure data-access layer for report aggregations and CSV export cursors.
 * No business logic, no try/catch.
 */

// ─── Shipment aggregations ────────────────────────────────────────────────────

/** Run a MongoDB aggregation pipeline on Shipments. */
const aggregateShipments = (pipeline) => Shipment.aggregate(pipeline);

/** Get a streaming cursor for Shipment export. */
const shipmentCursor = (filter, sort = { createdAt: -1 }) =>
  Shipment.find(filter).sort(sort).cursor();

// ─── Transaction aggregations ─────────────────────────────────────────────────

/** Run a MongoDB aggregation pipeline on Transactions. */
const aggregateTransactions = (pipeline) => Transaction.aggregate(pipeline);

/** Get a streaming cursor for Transaction export. */
const transactionCursor = (filter, sort = { createdAt: -1 }) =>
  Transaction.find(filter).sort(sort).cursor();

// ─── COD aggregations ─────────────────────────────────────────────────────────

/** Run a MongoDB aggregation pipeline on COD records. */
const aggregateCod = (pipeline) => COD.aggregate(pipeline);

// ─── Wallet aggregations ──────────────────────────────────────────────────────

/** Find one wallet by userId. */
const findWalletByUserId = (userId) => Wallet.findOne({ userId });

/** Run a MongoDB aggregation pipeline on Wallets. */
const aggregateWallets = (pipeline) => Wallet.aggregate(pipeline);

// ─── Payment aggregations ─────────────────────────────────────────────────────

/** Run a MongoDB aggregation pipeline on Payments. */
const aggregatePayments = (pipeline) => Payment.aggregate(pipeline);

// ─── User queries (for merchant-revenue report) ───────────────────────────────

/** Find users matching a filter with selected projection. */
const findUsers = (filter, projection) =>
  User.find(filter, projection);

module.exports = {
  aggregateShipments,
  shipmentCursor,
  aggregateTransactions,
  transactionCursor,
  aggregateCod,
  findWalletByUserId,
  aggregateWallets,
  aggregatePayments,
  findUsers,
};
