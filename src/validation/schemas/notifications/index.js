'use strict';
const { z } = require('zod/v4');
const legacy = require('../../../dto/notifications/notification.dto');
const { objectIdSchema } = require('../common/base.schemas');
module.exports = { ...legacy, notificationIdParamsSchema: z.object({ id: objectIdSchema }) };
