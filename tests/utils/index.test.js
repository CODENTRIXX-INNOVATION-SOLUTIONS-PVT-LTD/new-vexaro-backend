'use strict';

// ─── Environment variables MUST be set before any imports that call env.js ───
process.env.JWT_SECRET = 'xK9#mP2qR7vL4nW1cJ6bT3hY8zA0dF5g';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.REDIS_ENABLED = 'false';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.PORT = '3000';
// Additional vars required by env.js validation
process.env.EMAIL_FROM = 'test@example.com';
process.env.VELOCITY_USERNAME = 'test-user';
process.env.VELOCITY_PASSWORD = 'test-pass';

// ─── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/utils/cache', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  TTL: {},
  KEYS: { userProfile: (id) => `vx:user:profile:${id}` },
}));

// ─── Module under test ────────────────────────────────────────────────────────
const {
  signJwt,
  verifyJwt,
  generateToken,
  hashToken,
  tokenExpiry,
  roleToDashboardPath,
} = require('../../src/utils/index');

const fc = require('fast-check');

// ─── signJwt / verifyJwt ──────────────────────────────────────────────────────
describe('signJwt + verifyJwt', () => {
  it('round-trip: decoded payload contains all original fields', () => {
    const payload = { userId: 'abc123', email: 'user@example.com', role: 'MERCHANT' };
    const token = signJwt(payload);
    const decoded = verifyJwt(token);

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('verifyJwt throws a JWT error when the token is tampered', () => {
    const token = signJwt({ userId: 'u1' });
    // Corrupt the signature portion
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(() => verifyJwt(tampered)).toThrow();
  });
});

// ─── generateToken ────────────────────────────────────────────────────────────
describe('generateToken', () => {
  it('returns a hex string of length 2*n for a given n', () => {
    const result = generateToken(16);
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[0-9a-f]+$/);
    expect(result).toHaveLength(32); // 16 bytes × 2 hex chars
  });

  it('returns a hex string of length 64 by default (32 bytes)', () => {
    const result = generateToken();
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[0-9a-f]+$/);
    expect(result).toHaveLength(64);
  });

  it('returns a hex string of length 2*n for n=1', () => {
    expect(generateToken(1)).toHaveLength(2);
  });
});

// ─── hashToken ────────────────────────────────────────────────────────────────
describe('hashToken', () => {
  it('is deterministic: same input always returns same hash', () => {
    const input = 'my-random-token-value';
    expect(hashToken(input)).toBe(hashToken(input));
  });

  it('produces a 64-character hex string (SHA-256 output)', () => {
    const result = hashToken('sometoken');
    expect(typeof result).toBe('string');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});

// ─── tokenExpiry ──────────────────────────────────────────────────────────────
describe('tokenExpiry', () => {
  it('returns a Date approximately 1 hour in the future (within ±10 seconds)', () => {
    const before = Date.now();
    const expiry = tokenExpiry(1);
    const after = Date.now();

    expect(expiry).toBeInstanceOf(Date);

    const expectedMs = 1 * 60 * 60 * 1000; // 1 hour in ms
    const tolerance = 10_000; // ±10 seconds

    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs - tolerance);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + expectedMs + tolerance);
  });

  it('returns a Date approximately 24 hours in the future (within ±10 seconds)', () => {
    const before = Date.now();
    const expiry = tokenExpiry(24);
    const after = Date.now();

    expect(expiry).toBeInstanceOf(Date);

    const expectedMs = 24 * 60 * 60 * 1000;
    const tolerance = 10_000;

    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs - tolerance);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + expectedMs + tolerance);
  });
});

// ─── roleToDashboardPath ──────────────────────────────────────────────────────
describe('roleToDashboardPath', () => {
  it('maps SUPER_ADMIN → /super-admin', () => {
    expect(roleToDashboardPath('SUPER_ADMIN')).toBe('/super-admin');
  });

  it('maps DISTRIBUTOR → /distributor', () => {
    expect(roleToDashboardPath('DISTRIBUTOR')).toBe('/distributor');
  });

  it('maps MERCHANT → /merchant', () => {
    expect(roleToDashboardPath('MERCHANT')).toBe('/merchant');
  });

  it('maps WAREHOUSE → /warehouse', () => {
    expect(roleToDashboardPath('WAREHOUSE')).toBe('/warehouse');
  });

  it('returns /login for an unknown role', () => {
    expect(roleToDashboardPath('UNKNOWN_ROLE')).toBe('/login');
  });

  it('returns /login for undefined role', () => {
    expect(roleToDashboardPath(undefined)).toBe('/login');
  });
});

// ─── Property-Based Tests ─────────────────────────────────────────────────────

/**
 * Validates: Requirements R4
 *
 * JWT round-trip property: for any { userId: string, email: string, role: string }
 * payload, sign then verify must contain all original fields.
 */
describe('PBT: JWT round-trip', () => {
  it('decoded payload always contains all original fields for any valid payload object', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          role: fc.constantFrom('SUPER_ADMIN', 'DISTRIBUTOR', 'MERCHANT', 'WAREHOUSE'),
        }),
        (payload) => {
          const token = signJwt(payload);
          const decoded = verifyJwt(token);
          return (
            decoded.userId === payload.userId &&
            decoded.email === payload.email &&
            decoded.role === payload.role
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Validates: Requirements R4
 *
 * hashToken determinism property: hashToken(x) === hashToken(x) for any non-empty ASCII string.
 */
describe('PBT: hashToken determinism', () => {
  it('always produces the same hash for the same input across any non-empty ASCII string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => /^[\x20-\x7E]+$/.test(s)),
        (input) => {
          return hashToken(input) === hashToken(input);
        }
      ),
      { numRuns: 100 }
    );
  });
});
