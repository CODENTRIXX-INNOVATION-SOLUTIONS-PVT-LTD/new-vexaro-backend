const { success, created, paginated } = require('../../utils');
const { wrapController } = require('../../utils/errors');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const {
  listDisputesService, createDisputeService, getDisputeService, updateDisputeService,
  raiseWeightDisputeService, listWeightDisputesService, resolveWeightDisputeService, submitDisputeProofService
} = require('./dispute.service');

const wrap = wrapController;

exports.listDisputes  = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listDisputesService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Disputes retrieved', { disputes: items }, meta);
});

exports.createDispute = wrap(async (req, res) => created(res, 'Dispute raised', await createDisputeService(req.validated.body, req.user)));
exports.getDispute    = wrap(async (req, res) => success(res, 'Dispute retrieved', await getDisputeService(req.params.id, req.user)));
exports.updateDispute = wrap(async (req, res) => success(res, 'Dispute updated', await updateDisputeService(req.params.id, req.validated.body, req.user)));

// Weight Disputes
exports.raiseWeightDispute = wrap(async (req, res) => created(res, 'Weight dispute raised successfully', await raiseWeightDisputeService(req.validated.body, req.user)));

exports.listWeightDisputes   = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listWeightDisputesService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Weight disputes retrieved', { disputes: items }, meta);
});

exports.resolveWeightDispute = wrap(async (req, res) => success(res, 'Weight dispute resolved', await resolveWeightDisputeService(req.params.id, req.validated.body, req.user)));
exports.submitDisputeProof = wrap(async (req, res) => success(res, 'Dispute proof submitted', await submitDisputeProofService(req.params.id, req.validated.body, req.user)));
