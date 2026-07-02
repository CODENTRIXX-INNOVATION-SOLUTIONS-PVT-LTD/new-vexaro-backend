const mongoose = require('mongoose');
const { TicketStatus, TicketPriority, TicketCategory } = require('../../constants');

const replySchema = new mongoose.Schema(
  {
    author:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message:     { type: String, required: true, trim: true },
    isStaff:     { type: Boolean, default: false },
    attachments: [{ type: String }],
  },
  { timestamps: true },
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true },
    raisedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    subject:     { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    category:    { type: String, enum: Object.values(TicketCategory), required: true },
    priority:    { type: String, enum: Object.values(TicketPriority), default: TicketPriority.MEDIUM },
    status:      { type: String, enum: Object.values(TicketStatus),   default: TicketStatus.OPEN, index: true },
    shipmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },
    attachments: [{ type: String }],
    replies:     { type: [replySchema], default: [] },
    resolvedAt:  { type: Date, default: null },
  },
  { timestamps: true },
);

// Auto-generate ticket number: TKT-YYYYMMDD-XXXX
ticketSchema.pre('save', function () {
  if (!this.isNew) return;
  const crypto = require('crypto');
  const date  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  this.ticketNumber = `TKT-${date}-${random}`;
});

ticketSchema.index({ raisedBy: 1, status: 1 });
ticketSchema.index({ assignedTo: 1 });
ticketSchema.index({ category: 1 });

const SupportTicket = mongoose.model('SupportTicket', ticketSchema);
module.exports = { SupportTicket, TicketStatus, TicketPriority, TicketCategory };
