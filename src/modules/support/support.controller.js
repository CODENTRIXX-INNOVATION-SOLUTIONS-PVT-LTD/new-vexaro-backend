'use strict';

const supportService = require('./support.service');
const { success, created, paginated } = require('../../utils/response');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const { UserRole } = require('../../constants');
const { User } = require('../users/user.model');

/**
 * Support Controller
 * Handles HTTP requests for support tickets and replies.
 */

const getTickets = async (req, res) => {
  const query = req.validated.query;
  
  // Build scoped filter
  const filter = {};
  if (req.user.role === UserRole.DISTRIBUTOR) {
    const merchants = await User.find({ role: UserRole.MERCHANT, invitedBy: req.user.userId, deletedAt: null }, '_id').lean();
    filter.raisedBy = { $in: [req.user.userId, ...merchants.map((merchant) => merchant._id)] };
  } else if (req.user.role !== UserRole.SUPER_ADMIN) {
    filter.raisedBy = req.user.userId;
  }
  if (query.status)   filter.status   = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = query.category;

  const { page, limit, skip } = getPaginationParams(query, 20);

  const [tickets, total] = await supportService.getTicketsService(filter, skip, limit);
  const meta = buildPaginationMeta(total, page, limit);

  paginated(res, 'Tickets retrieved', { tickets }, meta);
};

const createTicket = async (req, res) => {
  const dto = req.validated.body;
  const ticket = await supportService.createTicketService(dto, req.user.userId);
  created(res, 'Support ticket created', ticket);
};

const getTicketById = async (req, res) => {
  const ticket = await supportService.getTicketByIdService(req.params.id, req.user);
  success(res, 'Ticket retrieved', ticket);
};

const updateTicket = async (req, res) => {
  const dto = req.validated.body;
  const ticket = await supportService.updateTicketService(req.params.id, dto, req.user);
  success(res, 'Ticket updated', ticket);
};

const addReply = async (req, res) => {
  const dto = req.validated.body;
  const ticket = await supportService.addReplyService(req.params.id, dto, req.user);
  success(res, 'Reply added', ticket);
};

const uploadAttachment = async (req, res) => {
  if (!req.file) {
    throw Object.assign(new Error('No file uploaded'), { statusCode: 400 });
  }
  const relativePath = `/uploads/support/${req.file.filename}`;
  created(res, 'File uploaded successfully', { url: relativePath });
};

const deleteTicket = async (req, res) => {
  const result = await supportService.deleteTicketService(req.params.id);
  success(res, result.message);
};

module.exports = {
  getTickets,
  createTicket,
  getTicketById,
  updateTicket,
  addReply,
  uploadAttachment,
  deleteTicket,
};
