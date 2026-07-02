'use strict';

/**
 * Super Admin Report Module
 * Barrel export for the super-admin-report module
 */

const controller = require('./super-admin-report.controller');
const service = require('./super-admin-report.service');
const routes = require('./super-admin-report.routes');
const constants = require('./super-admin-report.constants');
const validation = require('./super-admin-report.validation');

module.exports = {
  controller,
  service,
  routes,
  constants,
  validation,
};
