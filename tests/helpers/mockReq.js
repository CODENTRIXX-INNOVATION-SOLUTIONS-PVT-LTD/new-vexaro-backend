'use strict';

/**
 * Creates a reusable mock Express request object for testing.
 */
const mockReq = (overrides = {}) => ({
  headers: {},
  method: 'GET',
  path: '/api/test',
  ip: '127.0.0.1',
  user: null,
  body: {},
  requestId: null,
  query: {},
  params: {},
  ...overrides,
});

module.exports = { mockReq };
