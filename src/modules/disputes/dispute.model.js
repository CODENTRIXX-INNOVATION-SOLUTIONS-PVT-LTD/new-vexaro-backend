const mongoose = require('mongoose');
const { DisputeStatus, DisputeCategory } = require('../../constants');

const commentSchema = new mongoose.Schema(
  { author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, text: { type: String, required: true, trim: true } },
  { timestamps: true },
);

const disputeSchema = new mongoose.Schema(
  {
    shipmentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
    raisedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    category:    { type: String, enum: Object.values(DisputeCategory), required: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status:      { type: String, enum: Object.values(DisputeStatus), default: DisputeStatus.OPEN, index: true },
    resolution:  { type: String, default: null, trim: true },
    resolvedAt:  { type: Date, default: null },
    resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    comments:    { type: [commentSchema], default: [] },
    attachments: [{ url: String, name: String }],
  },
  { timestamps: true },
);

disputeSchema.index({ raisedBy: 1, status: 1 });
disputeSchema.index({ shipmentId: 1 });

const Dispute = mongoose.model('Dispute', disputeSchema);
module.exports = { Dispute, DisputeStatus, DisputeCategory };
