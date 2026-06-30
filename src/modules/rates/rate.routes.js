'use strict';

const { Router } = require('express');
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const { UserRole } = require('../../constants');
const { wrapController } = require('../../utils/errors');
const rateController = require('./rate.controller');
const { validateRequest } = require('../../validation');
const schemas = require('../../validation/schemas/rates');
const { emptyObjectSchema } = require('../../validation/schemas/common/base.schemas');
const { paginationSchema } = require('../../validation/schemas/common/query.schemas');

const router = Router();
router.use(authMiddleware);

const wrap = wrapController;

// ── Rate Cards (SA only to create/edit; everyone can read) ────────────────────
// GET /api/rates/cards
router.get('/cards', validateRequest({ query: emptyObjectSchema }), wrap(rateController.getRateCards));

// POST /api/rates/cards  (SA only)
router.post('/cards', requireRole(UserRole.SUPER_ADMIN), validateRequest({ body: schemas.createRateCardDto }), wrap(rateController.createRateCard));

// GET /api/rates/cards/:id
router.get('/cards/:id', validateRequest({ params: schemas.rateIdParamsSchema }), wrap(rateController.getRateCardById));

// PATCH /api/rates/cards/:id (SA only)
router.patch('/cards/:id', requireRole(UserRole.SUPER_ADMIN), validateRequest({ params: schemas.rateIdParamsSchema, body: schemas.updateRateCardDto }), wrap(rateController.updateRateCard));

// DELETE /api/rates/cards/:id (SA: soft delete)
router.delete('/cards/:id', requireRole(UserRole.SUPER_ADMIN), validateRequest({ params: schemas.rateIdParamsSchema }), wrap(rateController.deactivateRateCard));

// ── Margin Config (Distributor sets their own margin on a rate card) ──────────
// GET /api/rates/margins  — Distributor sees own margins; SA sees all, paginated
router.get('/margins', requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR), validateRequest({ query: paginationSchema }), wrap(rateController.getMargins));

// POST /api/rates/margins  (Distributor only)
router.post('/margins', requireRole(UserRole.DISTRIBUTOR), validateRequest({ body: schemas.createMarginConfigDto }), wrap(rateController.saveMarginConfig));

// GET /api/rates/calculate — calculate shipping cost for a given weight/service
router.post('/calculate', validateRequest({ body: schemas.calculateRateDto }), wrap(rateController.calculateRate));

module.exports = router;
