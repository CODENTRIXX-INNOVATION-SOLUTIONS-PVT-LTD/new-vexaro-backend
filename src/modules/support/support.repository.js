'use strict';

const { SupportTicket } = require('./support.model');
const { User } = require('../users/user.model');
const { TicketStatus } = require('../../constants');

/**
 * Support Repository
 * Pure data-access layer — no business logic, no try/catch.
 */

/** Find a ticket by _id with full population. */
const findById = (id) =>
  SupportTicket.findById(id)
    .populate('raisedBy',   'firstName lastName email role')
    .populate('assignedTo', 'firstName lastName email')
    .populate('replies.author', 'firstName lastName role');

/** Find a ticket by _id without population (for mutation operations). */
const findByIdRaw = (id) => SupportTicket.findById(id);

/**
 * Paginated list of tickets with population.
 * Returns [tickets[], total].
 */
const findPaginated = async (filter, { skip, limit, sort = { createdAt: -1 } } = {}) => {
  return Promise.all([
    SupportTicket.find(filter)
      .populate('raisedBy',   'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    SupportTicket.countDocuments(filter),
  ]);
};

/** Create a new support ticket. */
const create = (data) => SupportTicket.create(data);

/** Save a ticket document (triggers pre-save hooks). */
const save = (ticket, options = {}) => ticket.save(options);

/** Delete a ticket permanently by _id. */
const deleteById = (id) => SupportTicket.findByIdAndDelete(id);

/**
 * Find all SUPER_ADMIN users who are active — used for workload-based assignment.
 */
const findAdminAgents = () =>
  User.find({ role: 'SUPER_ADMIN', isActive: true, deletedAt: null }, '_id');

/**
 * Aggregate open ticket counts per assignedTo agent.
 * Returns [{_id: agentId, count: N}].
 */
const countOpenTicketsPerAgent = () =>
  SupportTicket.aggregate([
    { $match: { status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] }, assignedTo: { $ne: null } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);

module.exports = {
  findById,
  findByIdRaw,
  findPaginated,
  create,
  save,
  deleteById,
  findAdminAgents,
  countOpenTicketsPerAgent,
};
