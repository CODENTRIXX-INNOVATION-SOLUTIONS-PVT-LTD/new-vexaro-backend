'use strict';

const { Shipment } = require('./shipment.model');

/**
 * Shipment Repository
 * Pure data-access layer — no business logic, no try/catch, no service calls.
 */

/** Find one shipment matching a filter with standard population. */
const findOne = (filter) =>
  Shipment.findOne(filter)
    .populate('merchantId',    'firstName lastName email companyName')
    .populate('distributorId', 'firstName lastName email companyName')
    .populate('warehouseId',   'firstName lastName email companyName');

/** Find a shipment by _id and deletedAt: null. */
const findById = (id) =>
  Shipment.findOne({ _id: id, deletedAt: null })
    .populate('merchantId',    'firstName lastName email companyName')
    .populate('distributorId', 'firstName lastName email companyName')
    .populate('warehouseId',   'firstName lastName email companyName');

/** Find a shipment by its AWB, with full population. */
const findByAwb = (awb) =>
  Shipment.findOne({ awb: awb.trim().toUpperCase(), deletedAt: null })
    .populate('merchantId',    'firstName lastName email companyName')
    .populate('distributorId', 'firstName lastName email companyName')
    .populate('warehouseId',   'firstName lastName email companyName');

/** Find a raw (unpopulated) shipment by its AWB — used for existence checks. */
const findByAwbLean = (awb) =>
  Shipment.findOne({ awb }, '_id').lean();

/**
 * Paginated list of shipments.
 * Returns [shipments[], total].
 */
const findPaginated = async (filter, { skip, limit, sort = { createdAt: -1 } } = {}) => {
  return Promise.all([
    Shipment.find(filter)
      .populate('merchantId',    'firstName lastName email companyName')
      .populate('distributorId', 'firstName lastName email companyName')
      .populate('warehouseId',   'firstName lastName email companyName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Shipment.countDocuments(filter),
  ]);
};

/** Create one or more shipments inside a Mongoose session. */
const createInSession = (data, session) =>
  Shipment.create([data], { session });

/** Update a shipment by _id, optionally within a session. */
const findByIdAndUpdate = (id, update, options = {}) => {
  const { session, ...rest } = options;
  const opts = { returnDocument: 'after', ...rest };
  if (session) opts.session = session;
  return Shipment.findByIdAndUpdate(id, update, opts);
};

/** Update multiple shipments matching a filter. */
const updateMany = (filter, update) =>
  Shipment.updateMany(filter, update);

/** Save a shipment document (triggers pre-save hooks). Accepts session option. */
const save = (shipment, options = {}) => shipment.save(options);

/** Count shipments matching a filter. */
const count = (filter) => Shipment.countDocuments(filter);

/** Run a MongoDB aggregation pipeline on Shipments. */
const aggregate = (pipeline) => Shipment.aggregate(pipeline);

/** Find all shipments matching a filter, selecting only specified fields. */
const findAll = (filter, projection) => Shipment.find(filter, projection);

/** Get a streaming cursor for large result sets (e.g. CSV export). */
const cursor = (filter, sort = { createdAt: -1 }) =>
  Shipment.find(filter).sort(sort).cursor();

/** Generate a unique AWB via the model static. */
const generateAWB = () => Shipment.generateAWB();

module.exports = {
  findOne,
  findById,
  findByAwb,
  findByAwbLean,
  findPaginated,
  createInSession,
  findByIdAndUpdate,
  updateMany,
  save,
  count,
  aggregate,
  findAll,
  cursor,
  generateAWB,
};
