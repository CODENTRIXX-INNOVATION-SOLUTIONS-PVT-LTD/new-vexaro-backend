'use strict';

/**
 * Creates a reusable mock Express response object for testing.
 * Supports method chaining (status().json()) pattern.
 */
const mockRes = (overrides = {}) => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.on = jest.fn();
  res.statusCode = 200;
  res.req = { requestId: 'test-req-id' };
  Object.assign(res, overrides);
  return res;
};

module.exports = { mockRes };
