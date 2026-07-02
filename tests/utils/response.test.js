'use strict';

const fc = require('fast-check');
const { success, created, paginated } = require('../../src/utils/response');

/**
 * Builds a fake Express res object.
 * If requestId is explicitly provided, it is set on res.req.
 * If requestId is undefined (called with no argument), res.req is set to {}
 * so that res.req.requestId is absent.
 */
const buildRes = (requestId) => {
  let captured;
  const res = {
    req: requestId !== undefined ? { requestId } : {},
    json: jest.fn(body => { captured = body; return res; }),
    status: jest.fn().mockReturnThis(),
  };
  return { res, getBody: () => captured };
};

// ---------------------------------------------------------------------------
// success()
// ---------------------------------------------------------------------------
describe('success()', () => {
  test('returns HTTP 200', () => {
    const { res } = buildRes('test-uuid-123');
    success(res, 'OK', { id: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('body has success:true', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    success(res, 'OK', { id: 1 });
    expect(getBody().success).toBe(true);
  });

  test('body contains the supplied message', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    success(res, 'Hello world', { id: 1 });
    expect(getBody().message).toBe('Hello world');
  });

  test('body contains the supplied data', () => {
    const data = { id: 42, name: 'Alice' };
    const { res, getBody } = buildRes('test-uuid-123');
    success(res, 'OK', data);
    expect(getBody().data).toEqual(data);
  });

  test('body contains a timestamp string', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    success(res, 'OK');
    expect(typeof getBody().timestamp).toBe('string');
    expect(getBody().timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('body.requestId equals res.req.requestId when present', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    success(res, 'OK');
    expect(getBody().requestId).toBe('test-uuid-123');
  });

  test('body.requestId is null when req.requestId is absent', () => {
    // buildRes called with no arg → res.req = {}
    const { res, getBody } = buildRes();
    success(res, 'OK');
    expect(getBody().requestId).toBeNull();
  });

  test('data defaults to null when not supplied', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    success(res, 'OK');
    expect(getBody().data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// created()
// ---------------------------------------------------------------------------
describe('created()', () => {
  test('returns HTTP 201', () => {
    const { res } = buildRes('test-uuid-123');
    created(res, 'Created', { id: 2 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('body has success:true', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    created(res, 'Created', { id: 2 });
    expect(getBody().success).toBe(true);
  });

  test('body contains the supplied message', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    created(res, 'Resource created');
    expect(getBody().message).toBe('Resource created');
  });

  test('body contains the supplied data', () => {
    const data = { id: 99 };
    const { res, getBody } = buildRes('test-uuid-123');
    created(res, 'Created', data);
    expect(getBody().data).toEqual(data);
  });

  test('body.requestId equals res.req.requestId when present', () => {
    const { res, getBody } = buildRes('req-abc');
    created(res, 'Created');
    expect(getBody().requestId).toBe('req-abc');
  });

  test('body.requestId is null when req.requestId is absent', () => {
    const { res, getBody } = buildRes();
    created(res, 'Created');
    expect(getBody().requestId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// paginated()
// ---------------------------------------------------------------------------
describe('paginated()', () => {
  const meta = { page: 1, limit: 10, total: 50, totalPages: 5 };
  const results = [{ id: 1 }, { id: 2 }];

  test('returns HTTP 200', () => {
    const { res } = buildRes('test-uuid-123');
    paginated(res, 'List', results, meta);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('body has success:true', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    paginated(res, 'List', results, meta);
    expect(getBody().success).toBe(true);
  });

  test('body.data equals the results array', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    paginated(res, 'List', results, meta);
    expect(getBody().data).toEqual(results);
  });

  test('body.meta equals the meta object', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    paginated(res, 'List', results, meta);
    expect(getBody().meta).toEqual(meta);
  });

  test('body contains the supplied message', () => {
    const { res, getBody } = buildRes('test-uuid-123');
    paginated(res, 'Items found', results, meta);
    expect(getBody().message).toBe('Items found');
  });

  test('body.requestId equals res.req.requestId when present', () => {
    const { res, getBody } = buildRes('page-req-id');
    paginated(res, 'List', results, meta);
    expect(getBody().requestId).toBe('page-req-id');
  });

  test('body.requestId is null when req.requestId is absent', () => {
    const { res, getBody } = buildRes();
    paginated(res, 'List', results, meta);
    expect(getBody().requestId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PBT: success() always returns success:true with the exact message
// Validates: Requirements 6 (PBT property)
// ---------------------------------------------------------------------------
describe('PBT: success() — success flag and message preservation', () => {
  test('for any non-empty message string, body.success===true and body.message===that string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (message) => {
          const { res, getBody } = buildRes('pbt-req-id');
          success(res, message);
          const body = getBody();
          return body.success === true && body.message === message;
        }
      ),
      { numRuns: 100 }
    );
  });
});
