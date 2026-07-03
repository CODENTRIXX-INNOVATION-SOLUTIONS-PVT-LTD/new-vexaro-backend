const platformSettingsService = require('./platform-settings.service');
const { success } = require('../../utils/response');

const getPlatformSettings = async (req, res) => {
  const settings = await platformSettingsService.getPlatformSettingsService();
  success(res, 'Platform settings retrieved', settings);
};

const updatePlatformSettings = async (req, res) => {
  const dto = req.body;
  const settings = await platformSettingsService.updatePlatformSettingsService(dto);
  success(res, 'Platform settings updated successfully', settings);
};

module.exports = {
  getPlatformSettings,
  updatePlatformSettings,
};
