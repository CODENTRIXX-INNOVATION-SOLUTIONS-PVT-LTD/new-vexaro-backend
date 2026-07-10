'use strict';

const { Router } = require('express');
const { z } = require('zod/v4');
const { validateRequest } = require('../../validation');
const { wrapController } = require('../../utils/errors');
const { success } = require('../../utils/response');
const { sendContactEmail } = require('../../utils/email');

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  subject: z.string().trim().max(180).optional().or(z.literal('')),
  message: z.string().trim().min(10).max(5000),
});

const router = Router();

router.post(
  '/',
  validateRequest({ body: contactSchema }),
  wrapController(async (req, res) => {
    await sendContactEmail(req.validated.body);
    success(res, 'Message sent successfully');
  }),
);

module.exports = router;
