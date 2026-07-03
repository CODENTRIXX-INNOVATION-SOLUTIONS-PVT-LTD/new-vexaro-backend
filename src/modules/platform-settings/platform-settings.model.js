const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      default: 'Vexaro',
      trim: true,
    },
    logo: {
      type: String,
      default: '',
      trim: true,
    },
    gstNumber: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    supportEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one platform settings document exists
platformSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

module.exports = { PlatformSettings };
