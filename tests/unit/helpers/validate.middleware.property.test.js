'use strict';

const fc = require('fast-check');
const { z } = require('zod/v4');
const { validate } = require('../../../src/validation/middleware/validation.middleware');

describe('Property tests for validate.middleware.js', () => {
  // We can define simple test schemas and generators
  const schema = z.object({
    username: z.string().min(3),
    age: z.number().int().positive(),
  });

  const validDataArb = fc.record({
    username: fc.stringMatching(/^[a-zA-Z0-9]{3,20}$/),
    age: fc.integer({ min: 1, max: 120 }),
  });

  const invalidDataArb = fc.oneof(
    fc.record({
      username: fc.string({ maxLength: 2 }), // too short
      age: fc.integer({ min: 1, max: 120 }),
    }),
    fc.record({
      username: fc.string({ minLength: 3 }),
      age: fc.integer({ max: 0 }), // not positive
    }),
    fc.record({
      username: fc.string({ minLength: 3 }),
      age: fc.double({ min: 1, max: 120 }).filter(n => !Number.isInteger(n)), // not integer
    })
  );

  test('Property 1: Valid Input Pass-Through', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDataArb,
        async (validData) => {
          const handler = validate(schema, 'body');
          const req = { body: validData };
          const res = {};
          let nextCalled = false;
          let nextError = null;

          const next = (err) => {
            nextCalled = true;
            nextError = err;
          };

          await handler(req, res, next);

          // Expect next to be called with no arguments, and req.validated.body to match input
          return nextCalled && !nextError && req.validated?.body?.username === validData.username && req.validated?.body?.age === validData.age;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Invalid Input Error Forwarding', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidDataArb,
        async (invalidData) => {
          const handler = validate(schema, 'body');
          const req = { body: invalidData };
          const res = {};
          let nextCalled = false;
          let nextError = null;

          const next = (err) => {
            nextCalled = true;
            nextError = err;
          };

          await handler(req, res, next);

          // Expect next to be called with a 400 error containing errors array
          return nextCalled && nextError && nextError.statusCode === 400 && Array.isArray(nextError.errors) && nextError.errors.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3: Source Routing Correctness', async () => {
    const sources = ['body', 'query', 'params'];
    await fc.assert(
      fc.asyncProperty(
        validDataArb,
        fc.constantFrom(...sources),
        async (validData, source) => {
          const handler = validate(schema, source);
          const req = {
            body: {},
            query: {},
            params: {},
            [source]: validData,
          };
          const res = {};
          let nextCalled = false;
          let nextError = null;

          const next = (err) => {
            nextCalled = true;
            nextError = err;
          };

          await handler(req, res, next);

          if (!nextCalled || nextError) return false;

          // Expect req.validated[source] to contain data, but not other sources
          const sourcesToCheck = sources.filter(s => s !== source);
          const otherSourcesClean = sourcesToCheck.every(s => !req.validated[s]);

          return req.validated[source] !== undefined && otherSourcesClean;
        }
      ),
      { numRuns: 100 }
    );
  });
});
