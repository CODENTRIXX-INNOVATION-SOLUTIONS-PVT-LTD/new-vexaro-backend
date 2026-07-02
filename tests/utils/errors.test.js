'use strict';

const { z } = require('zod/v4');
const {
  formatZodError,
  createAppError,
  wrapController,
  asyncHandler,
  withErrorHandling,
} = require('../../src/utils/errors');

// ---------------------------------------------------------------------------
// formatZodError
// ---------------------------------------------------------------------------
describe('formatZodError', () => {
  it('returns a comma-separated string of issue messages for a real ZodError', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    let zodError;
    try {
      schema.parse({ name: 42, age: 'not-a-number' });
    } catch (err) {
      zodError = err;
    }

    expect(zodError).toBeDefined();
    const result = formatZodError(zodError);
    // Should contain messages from both failing fields joined by ', '
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Both issues should be represented
    const parts = result.split(', ');
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it('returns the error.message for a non-Zod error', () => {
    const err = new Error('something went wrong');
    const result = formatZodError(err);
    expect(result).toBe('something went wrong');
  });
});

// ---------------------------------------------------------------------------
// createAppError
// ---------------------------------------------------------------------------
describe('createAppError', () => {
  it('returns an instance of Error', () => {
    const err = createAppError('test error', 400);
    expect(err).toBeInstanceOf(Error);
  });

  it('has the correct message property', () => {
    const err = createAppError('not found', 404);
    expect(err.message).toBe('not found');
  });

  it('has the correct statusCode property', () => {
    const err = createAppError('forbidden', 403);
    expect(err.statusCode).toBe(403);
  });

  it('defaults statusCode to 500 when not provided', () => {
    const err = createAppError('internal error');
    expect(err.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// wrapController / asyncHandler / withErrorHandling
// ---------------------------------------------------------------------------
describe('wrapController', () => {
  const mockReq = {};
  const mockRes = {};

  it('calls the handler and does NOT call next with an error when the async fn resolves', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const next = jest.fn();

    const wrapped = wrapController(handler);
    await wrapped(mockReq, mockRes, next);

    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, next);
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it('calls next with the thrown error when the async fn throws', async () => {
    const thrownError = new Error('boom');
    const handler = jest.fn().mockRejectedValue(thrownError);
    const next = jest.fn();

    const wrapped = wrapController(handler);
    await wrapped(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(thrownError);
  });
});

describe('asyncHandler', () => {
  it('is the same function reference as wrapController', () => {
    expect(asyncHandler).toBe(wrapController);
  });
});

describe('withErrorHandling', () => {
  it('is the same function reference as wrapController', () => {
    expect(withErrorHandling).toBe(wrapController);
  });
});
