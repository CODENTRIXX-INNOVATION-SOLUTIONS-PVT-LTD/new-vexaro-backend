'use strict';

const { Router } = require('express');
const path = require('path');
const fs = require('fs');

const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const { UserRole } = require('../../constants');
const { wrapController } = require('../../utils/errors');
const supportController = require('./support.controller');
const { validateRequest } = require('../../validation');
const schemas = require('../../validation/schemas/support');
const { createUploadValidator } = require('../../validation/middleware/upload.middleware');

// ── Multer: disk storage for support ticket attachments ───────────────────────
const uploadDir = path.join(process.cwd(), 'uploads', 'support');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const secureUpload = createUploadValidator({ destination: uploadDir, required: true });

const wrap = wrapController;

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();
router.use(authMiddleware);

// GET /api/support
router.get('/', validateRequest({ query: schemas.listTicketsQueryDto }), wrap(supportController.getTickets));

// POST /api/support/upload — upload file attachment
router.post('/upload', ...secureUpload, wrap(supportController.uploadAttachment));

// POST /api/support — create ticket with auto workload workload assignment
router.post('/', validateRequest({ body: schemas.createTicketDto }), wrap(supportController.createTicket));

// GET /api/support/:id
router.get('/:id', validateRequest({ params: schemas.supportIdParamsSchema }), wrap(supportController.getTicketById));

// PATCH /api/support/:id  — SA/Distributor: update status/assign
router.patch('/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR), validateRequest({ params: schemas.supportIdParamsSchema, body: schemas.updateTicketDto }), wrap(supportController.updateTicket));

// POST /api/support/:id/reply  — anyone can add a reply to their ticket (auto-claim assignment)
router.post('/:id/reply', validateRequest({ params: schemas.supportIdParamsSchema, body: schemas.addReplyDto }), wrap(supportController.addReply));

// DELETE /api/support/:id — SA: permanently delete ticket
router.delete('/:id', requireRole(UserRole.SUPER_ADMIN), validateRequest({ params: schemas.supportIdParamsSchema }), wrap(supportController.deleteTicket));

module.exports = router;
