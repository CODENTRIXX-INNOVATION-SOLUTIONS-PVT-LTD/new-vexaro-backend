'use strict';
const { z } = require('zod/v4');
const legacy = require('../../../dto/rates/rate.dto');
const { objectIdSchema } = require('../common/base.schemas');
module.exports = { ...legacy, rateIdParamsSchema: z.object({ id: objectIdSchema }) };
