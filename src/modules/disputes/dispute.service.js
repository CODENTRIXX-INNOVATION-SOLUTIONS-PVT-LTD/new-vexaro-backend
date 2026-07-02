'use strict';

const {
  listDisputesService,
  createDisputeService,
  getDisputeService,
} = require('./services/shipment-dispute.service');

const {
  raiseWeightDisputeService,
  listWeightDisputesService,
  submitDisputeProofService,
  addCommentService,
} = require('./services/weight-dispute.service');

const {
  updateDisputeService,
  resolveWeightDisputeService,
} = require('./services/dispute-resolution.service');

module.exports = {
  listDisputesService,
  createDisputeService,
  getDisputeService,
  updateDisputeService,
  raiseWeightDisputeService,
  listWeightDisputesService,
  resolveWeightDisputeService,
  submitDisputeProofService,
  addCommentService,
};
