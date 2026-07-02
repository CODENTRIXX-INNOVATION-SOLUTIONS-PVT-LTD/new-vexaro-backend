'use strict';
const { z } = require('zod/v4');
const legacy = require('../../../dto/support/support.dto');
const { objectIdSchema } = require('../common/base.schemas');
module.exports = { ...legacy, supportIdParamsSchema: z.object({ id: objectIdSchema }) };
