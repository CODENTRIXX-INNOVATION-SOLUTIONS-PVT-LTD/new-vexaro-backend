const { PlatformSettings } = require('./platform-settings.model');
const { success } = require('../../utils/response');

const getPlatformSettingsService = async () => {
  const settings = await PlatformSettings.getSettings();
  return {
    companyName: settings.companyName,
    logo: settings.logo,
    gstNumber: settings.gstNumber,
    address: settings.address,
    supportEmail: settings.supportEmail,
  };
};

const updatePlatformSettingsService = async (updateData) => {
  const settings = await PlatformSettings.getSettings();
  
  if (updateData.companyName !== undefined) settings.companyName = updateData.companyName;
  if (updateData.logo !== undefined) settings.logo = updateData.logo;
  if (updateData.gstNumber !== undefined) settings.gstNumber = updateData.gstNumber;
  if (updateData.address !== undefined) settings.address = updateData.address;
  if (updateData.supportEmail !== undefined) settings.supportEmail = updateData.supportEmail.toLowerCase();
  
  await settings.save();
  
  return {
    companyName: settings.companyName,
    logo: settings.logo,
    gstNumber: settings.gstNumber,
    address: settings.address,
    supportEmail: settings.supportEmail,
  };
};

module.exports = {
  getPlatformSettingsService,
  updatePlatformSettingsService,
};
