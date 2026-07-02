'use strict';

/**
 * Send a standardized 200 OK success response.
 *
 * Success payload structure:
 * {
 *   success: true,
 *   message: string,
 *   data: any,
 *   meta: any,
 *   requestId: string,
 *   timestamp: string
 * }
 */
const success = (res, message, data = null) => {
  const req = res.req;
  return res.status(200).json({
    success: true,
    message,
    data,
    requestId: req?.requestId || null,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send a standardized 201 Created success response.
 */
const created = (res, message, data = null) => {
  const req = res.req;
  return res.status(201).json({
    success: true,
    message,
    data,
    requestId: req?.requestId || null,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send a standardized paginated 200 OK success response.
 */
const paginated = (res, message, results, meta) => {
  const req = res.req;
  return res.status(200).json({
    success: true,
    message,
    data: results,
    meta,
    requestId: req?.requestId || null,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  success,
  created,
  paginated,
};
