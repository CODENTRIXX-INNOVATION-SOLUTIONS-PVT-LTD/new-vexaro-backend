'use strict';
const { z } = require('zod/v4');
const legacy = require('../../../dto/settings/settings.dto');
const { passwordSchema, objectIdSchema } = require('../common/base.schemas');
const changePasswordDto = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });
module.exports = { ...legacy, changePasswordDto, apiKeyIdParamsSchema: z.object({ id: objectIdSchema }) };
