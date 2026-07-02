'use strict';

const { z } = require('zod/v4');
const { sanitizeString, sanitizeFilename, sanitizeObject } = require('../../sanitizers/string.sanitizer');
const { validateRequest } = require('../../middleware/validation.middleware');
const { validateMagicBytes, validateCsv, detectMalware } = require('../../middleware/upload.middleware');

function execute(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error)));
}

describe('sanitization and validation middleware', () => {
  test('normalizes Unicode and removes controls, bidi overrides and HTML', () => {
    expect(sanitizeString('  Ｖexaro\u0000<script>x</script>\u202E  ')).toBe('Vexarox');
    expect(sanitizeFilename('../../evil<script>.pdf')).toBe('._._evil.pdf');
  });

  test.each([
    { $where: 'sleep(1)' },
    { 'profile.role': 'SUPER_ADMIN' },
    { nested: { $gt: '' } },
  ])('rejects NoSQL operator keys', (payload) => {
    expect(() => sanitizeObject(payload)).toThrow('Validation failed');
  });

  test('validates and attaches sanitized multi-target data', async () => {
    const middleware = validateRequest({
      params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/) }),
      body: z.object({ name: z.string().min(2) }),
    });
    const req = { params: { id: '507f1f77bcf86cd799439011' }, body: { name: '  Alice  ' } };
    expect(await execute(middleware, req)).toBeUndefined();
    expect(req.validated).toEqual({ params: req.params, body: { name: 'Alice' } });
  });

  test('aggregates field-level errors without sensitive values', async () => {
    const middleware = validateRequest({ body: z.object({ password: z.string().min(12), age: z.number().int() }) });
    const error = await execute(middleware, { body: { password: 'secret', age: 1.5 } });
    expect(error.statusCode).toBe(400);
    expect(error.errors).toHaveLength(2);
    expect(JSON.stringify(error)).not.toContain('secret');
  });

  test('checks magic bytes and CSV headers', () => {
    const png = { mimetype: 'image/png', originalname: 'ok.png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') };
    expect(() => validateMagicBytes(png, ['image/png'])).not.toThrow();
    expect(() => validateMagicBytes({ ...png, buffer: Buffer.from('not png') }, ['image/png'])).toThrow();
    const csv = { buffer: Buffer.from('name,email\nAlice,a@example.com'), mimetype: 'text/csv', originalname: 'a.csv' };
    expect(() => validateCsv(csv, { requiredHeaders: ['name', 'email'] })).not.toThrow();
    expect(() => validateCsv(csv, { requiredHeaders: ['phone'] })).toThrow();
  });

  test('detects the standard antivirus test signature', () => {
    const file = { buffer: Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE') };
    expect(() => detectMalware(file)).toThrow();
  });
});
