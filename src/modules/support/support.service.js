'use strict';

const supportRepository = require('./support.repository');
const { TicketStatus, UserRole } = require('../../constants');
const { User } = require('../users/user.model');

/**
 * Support Service
 * Handles business logic for support tickets, replies, and automatic workload assignment.
 */

const getTicketsService = async (filter, skip, limit) => {
  return supportRepository.findPaginated(filter, { skip, limit });
};

const createTicketService = async (dto, raisedBy) => {
  // Round-robin / workload-based ticket assignment
  const staffList = await supportRepository.findAdminAgents();
  let assignedTo = null;

  if (staffList.length > 0) {
    const counts = await supportRepository.countOpenTicketsPerAgent();
    const countMap = counts.reduce((a, c) => { a[c._id.toString()] = c.count; return a; }, {});
    let bestStaff = staffList[0]._id;
    let minCount = countMap[bestStaff.toString()] || 0;

    for (const s of staffList) {
      const c = countMap[s._id.toString()] || 0;
      if (c < minCount) {
        bestStaff = s._id;
        minCount = c;
      }
    }
    assignedTo = bestStaff;
  }

  const ticket = await supportRepository.create({
    ...dto,
    raisedBy,
    assignedTo,
  });

  return ticket;
};

const assertTicketAccess = async (ticket, caller, { staffOnly = false } = {}) => {
  const isOwner = ticket.raisedBy?._id
    ? ticket.raisedBy._id.toString() === caller.userId
    : ticket.raisedBy?.toString() === caller.userId;

  if (caller.role === UserRole.SUPER_ADMIN) return;

  if (caller.role === UserRole.DISTRIBUTOR) {
    if (staffOnly) return;
    if (isOwner) return;

    const raisedById = ticket.raisedBy?._id || ticket.raisedBy;
    const merchant = await User.findOne({
      _id: raisedById,
      role: UserRole.MERCHANT,
      invitedBy: caller.userId,
      deletedAt: null,
    }, '_id').lean();

    if (merchant) return;
  }

  if (!staffOnly && isOwner) return;

  throw Object.assign(new Error('Access denied'), { statusCode: 403 });
};

const getTicketByIdService = async (id, caller) => {
  const ticket = await supportRepository.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  await assertTicketAccess(ticket, caller);

  return ticket;
};

const updateTicketService = async (id, dto, caller) => {
  const ticket = await supportRepository.findByIdRaw(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  await assertTicketAccess(ticket, caller);

  Object.assign(ticket, dto);
  if (dto.status === TicketStatus.RESOLVED) ticket.resolvedAt = new Date();
  await supportRepository.save(ticket);
  return ticket;
};

const addReplyService = async (id, dto, caller) => {
  const ticket = await supportRepository.findByIdRaw(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  if ([TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status)) {
    throw Object.assign(new Error('Cannot reply to a closed ticket'), { statusCode: 400 });
  }

  const isOwner = ticket.raisedBy.toString() === caller.userId;
  const isStaff = [UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR].includes(caller.role);
  await assertTicketAccess(ticket, caller);

  // Claim-on-reply: Auto-assign ticket to the responding staff member
  if (!ticket.assignedTo && isStaff) {
    ticket.assignedTo = caller.userId;
  }

  ticket.replies.push({
    author:      caller.userId,
    message:     dto.message,
    isStaff,
    attachments: dto.attachments || [],
  });

  if (ticket.status === TicketStatus.OPEN && isStaff) {
    ticket.status = TicketStatus.IN_PROGRESS;
  }

  await supportRepository.save(ticket);
  return ticket;
};

const deleteTicketService = async (id) => {
  const ticket = await supportRepository.deleteById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  return { message: 'Ticket deleted successfully' };
};

module.exports = {
  getTicketsService,
  createTicketService,
  getTicketByIdService,
  updateTicketService,
  addReplyService,
  deleteTicketService,
};
