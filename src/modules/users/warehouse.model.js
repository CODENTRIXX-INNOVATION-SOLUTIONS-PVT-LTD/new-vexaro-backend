const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema(
  {
    warehouseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // ─── Additional fields used for Velocity API mapping ─────────────────────
    name: {
      type: String,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      default: null,
      lowercase: true,
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    gstNo: {
      type: String,
      trim: true,
      default: null,
    },

    // ─── Velocity Shipping sync fields ────────────────────────────────────────
    velocityWarehouseId: {
      type: String,
      default: null,
      index: true,
    },
    velocitySyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

warehouseSchema.index({ merchantId: 1, isActive: 1 });
warehouseSchema.index({ pincode: 1 });

/**
 * Generates a unique warehouse ID in the format: WH + 4 random digits + state code (2 chars)
 */
warehouseSchema.statics.generateWarehouseId = async function (state) {
  const stateCode = (state || 'XX').trim().toUpperCase().slice(0, 2);
  let id;
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 random digits
    id = `WH${randomNum}${stateCode}`;
    const existing = await this.findOne({ warehouseId: id });
    if (!existing) {
      return id;
    }
  }
  // Fallback if max attempts exceeded (append secure random hex)
  const crypto = require('crypto');
  const fallbackSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `WH-${stateCode}-${fallbackSuffix}`;
};

const Warehouse = mongoose.model('Warehouse', warehouseSchema);

module.exports = { Warehouse };
