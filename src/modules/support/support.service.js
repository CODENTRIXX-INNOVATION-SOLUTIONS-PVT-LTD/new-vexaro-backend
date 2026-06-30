'use strict';

const supportRepository = require('./support.repository');
const { TicketStatus, UserRole } = require('../../constants');

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

const getTicketByIdService = async (id, caller) => {
  const ticket = await supportRepository.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  const isOwner = ticket.raisedBy._id.toString() === caller.userId;
  const isStaff = [UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR].includes(caller.role);
  if (!isOwner && !isStaff) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  return ticket;
};

const updateTicketService = async (id, dto) => {
  const ticket = await supportRepository.findByIdRaw(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

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
  if (!isOwner && !isStaff) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

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
