const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { UserRole } = require('../../constants');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      default: '',
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: [true, 'Role is required'],
    },
    isActive: {
      type: Boolean,
      default: false,
    },

    mustChangeCredentials: {
      type: Boolean,
      default: false,
    },

    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    inviteTokenHash: {
      type: String,
      select: false,
    },
    inviteTokenExpiry: {
      type: Date,
      select: false,
    },
    resetTokenHash: {
      type: String,
      select: false,
    },
    resetTokenExpiry: {
      type: Date,
      select: false,
    },
    notificationPreferences: {
      SHIPMENT: { type: Boolean, default: true },
      PAYMENT:  { type: Boolean, default: true },
      DISPUTE:  { type: Boolean, default: true },
      SYSTEM:   { type: Boolean, default: true },
      INVITE:   { type: Boolean, default: true },
    },
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.inviteTokenHash;
        delete ret.inviteTokenExpiry;
        delete ret.resetTokenHash;
        delete ret.resetTokenExpiry;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ inviteTokenHash: 1 }, { sparse: true });
userSchema.index({ resetTokenHash: 1 }, { sparse: true });
userSchema.index({ invitedBy: 1 }, { sparse: true });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });
userSchema.index({ deletedAt: 1 });
userSchema.index({ role: 1, invitedBy: 1 });
userSchema.index({ createdAt: -1 });

userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    mustChangeCredentials: this.mustChangeCredentials,
    firstName: this.firstName,
    lastName: this.lastName,
    phone: this.phone,
    companyName: this.companyName,
    address: this.address,
    invitedBy: this.invitedBy,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

const User = mongoose.model('User', userSchema);

module.exports = { User };
