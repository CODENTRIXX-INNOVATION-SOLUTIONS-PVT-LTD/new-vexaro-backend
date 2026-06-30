/**
 * tests/unit/helpers/mongoose.js
 *
 * In-memory MongoDB helper for unit tests.
 * Uses jest mocks — no real MongoDB connection needed.
 *
 * Strategy: We mock mongoose at the module level so no real DB is ever hit.
 * Each test receives fresh mock objects it can configure per-scenario.
 */

'use strict';

/**
 * Build a minimal mock Mongoose document that behaves like a real one.
 * Supports .save(), .session(), and arbitrary field assignment.
 */
const makeMockDoc = (fields = {}) => {
  const doc = {
    ...fields,
    save: jest.fn().mockResolvedValue(undefined),
  };
  return doc;
};

/**
 * Build a mock Mongoose model with findOne, findById, create, etc.
 */
const makeMockModel = (defaultDoc = null) => {
  const model = {
    findOne: jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue(defaultDoc),
    }),
    findById: jest.fn().mockResolvedValue(defaultDoc),
    findByIdAndUpdate: jest.fn().mockResolvedValue(defaultDoc),
    create: jest.fn().mockImplementation(async (docs) => {
      if (Array.isArray(docs)) return docs.map(d => makeMockDoc(d));
      return makeMockDoc(docs);
    }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue([]),
  };
  return model;
};

module.exports = { makeMockDoc, makeMockModel };
