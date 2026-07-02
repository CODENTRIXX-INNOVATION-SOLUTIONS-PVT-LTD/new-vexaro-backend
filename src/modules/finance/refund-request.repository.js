'use strict';

const { RefundRequest } = require('./refund-request.model');

/**
 * Create a new refund request record.
 */
const create = async (data, session = null) => {
  const [doc] = await RefundRequest.create([data], session ? { session } : {});
  return doc;
};

/**
 * Find a refund request by its MongoDB _id.
 * Excludes soft-deleted records.
 */
const findById = async (id, session = null) => {
  const q = RefundRequest.findOne({ _id: id, deletedAt: null });
  if (session) q.session(session);
  return q.lean();
};

/**
 * Find one PENDING request for a given shipmentId.
 * Used to enforce the "one pending request per shipment" rule.
 */
const findPendingByShipmentId = async (shipmentId, session = null) => {
  const q = RefundRequest.findOne({ shipmentId, status: 'PENDING', deletedAt: null });
  if (session) q.session(session);
  return q.lean();
};

/**
 * List refund requests with scoped filtering and pagination.
 *
 * @param {object} filter   - Mongoose query filter
 * @param {object} pagination - { page, limit }
 * @returns {{ items: object[], total: number }}
 */
const findAll = async (filter = {}, { page = 1, limit = 20 } = {}) => {
  const base = { ...filter, deletedAt: null };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    RefundRequest.find(base)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RefundRequest.countDocuments(base),
  ]);
  return { items, total };
};

/**
 * Update the status and review fields of a refund request inside a session.
 */
const updateStatus = async (id, updates, session = null) => {
  const opts = { new: true };
  if (session) opts.session = session;
  return RefundRequest.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: updates },
    opts,
  ).lean();
};

module.exports = {
  create,
  findById,
  findPendingByShipmentId,
  findAll,
  updateStatus,
};
