'use strict';
const { z } = require('zod/v4');
const legacy = require('../../../dto/disputes/dispute.dto');
const { objectIdSchema } = require('../common/base.schemas');
module.exports = { ...legacy, disputeIdParamsSchema: z.object({ id: objectIdSchema }) };
