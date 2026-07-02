'use strict';

const rateService = require('./rate.service');
const { success, created, paginated } = require('../../utils/response');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const { UserRole } = require('../../constants');
const { remember, TTL, KEYS } = require('../../utils/cache');

/**
 * Rate Controller
 * Handles HTTP requests for rate cards and margins.
 */

const getRateCards = async (req, res) => {
  const cards = await remember(KEYS.rateCards(), TTL.RATE_CARDS, async () => {
    return rateService.getRateCardsService();
  });
  success(res, 'Rate cards retrieved', cards);
};

const createRateCard = async (req, res) => {
  const dto = req.validated.body;
  const card = await rateService.createRateCardService(dto);
  created(res, 'Rate card created', card);
};

const getRateCardById = async (req, res) => {
  const card = await remember(KEYS.rateCard(req.params.id), TTL.RATE_CARDS, async () => {
    return rateService.getRateCardByIdService(req.params.id);
  });
  success(res, 'Rate card retrieved', card);
};

const updateRateCard = async (req, res) => {
  const dto = req.validated.body;
  const card = await rateService.updateRateCardService(req.params.id, dto);
  success(res, 'Rate card updated', card);
};

const deactivateRateCard = async (req, res) => {
  await rateService.deactivateRateCardService(req.params.id);
  success(res, 'Rate card deactivated');
};

const getMargins = async (req, res) => {
  const filter = req.user.role === UserRole.DISTRIBUTOR ? { distributorId: req.user.userId } : {};
  const { page, limit, skip } = getPaginationParams(req.validated.query, 20);

  const [margins, total] = await rateService.getMarginsService(filter, skip, limit);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Margin configs retrieved', { margins }, meta);
};

const saveMarginConfig = async (req, res) => {
  const dto = req.validated.body;
  const margin = await rateService.saveMarginConfigService(req.user.userId, dto);
  created(res, 'Margin config saved', margin);
};

const calculateRate = async (req, res) => {
  const dto = req.validated.body;
  const result = await rateService.calculateRateService(dto, req.user);
  success(res, 'Rate calculated', result);
};

module.exports = {
  getRateCards,
  createRateCard,
  getRateCardById,
  updateRateCard,
  deactivateRateCard,
  getMargins,
  saveMarginConfig,
  calculateRate,
};
