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
  UserRole,
  ShipmentStatus,
  ShipmentServiceType,
  ShipmentCODStatus,
  ShipmentPayoutStatus,
  CODStatus,
  TransactionType,
  PaymentStatus,
  DisputeStatus,
  DisputeCategory,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  NotificationType,
  SystemConfig,
} = require('../../src/constants/index');

const { roleToDashboardPath } = require('../../src/utils/index');
const fc = require('fast-check');

// ─── All exports are present ──────────────────────────────────────────────────
describe('constants/index exports', () => {
  it('exports UserRole', () => {
    expect(UserRole).toBeDefined();
    expect(typeof UserRole).toBe('object');
  });

  it('exports ShipmentStatus', () => {
    expect(ShipmentStatus).toBeDefined();
    expect(typeof ShipmentStatus).toBe('object');
  });

  it('exports ShipmentServiceType', () => {
    expect(ShipmentServiceType).toBeDefined();
    expect(typeof ShipmentServiceType).toBe('object');
  });

  it('exports ShipmentCODStatus', () => {
    expect(ShipmentCODStatus).toBeDefined();
    expect(typeof ShipmentCODStatus).toBe('object');
  });

  it('exports ShipmentPayoutStatus', () => {
    expect(ShipmentPayoutStatus).toBeDefined();
    expect(typeof ShipmentPayoutStatus).toBe('object');
  });

  it('exports CODStatus', () => {
    expect(CODStatus).toBeDefined();
    expect(typeof CODStatus).toBe('object');
  });

  it('exports TransactionType', () => {
    expect(TransactionType).toBeDefined();
    expect(typeof TransactionType).toBe('object');
  });

  it('exports PaymentStatus', () => {
    expect(PaymentStatus).toBeDefined();
    expect(typeof PaymentStatus).toBe('object');
  });

  it('exports DisputeStatus', () => {
    expect(DisputeStatus).toBeDefined();
    expect(typeof DisputeStatus).toBe('object');
  });

  it('exports DisputeCategory', () => {
    expect(DisputeCategory).toBeDefined();
    expect(typeof DisputeCategory).toBe('object');
  });

  it('exports TicketStatus', () => {
    expect(TicketStatus).toBeDefined();
    expect(typeof TicketStatus).toBe('object');
  });

  it('exports TicketPriority', () => {
    expect(TicketPriority).toBeDefined();
    expect(typeof TicketPriority).toBe('object');
  });

  it('exports TicketCategory', () => {
    expect(TicketCategory).toBeDefined();
    expect(typeof TicketCategory).toBe('object');
  });

  it('exports NotificationType', () => {
    expect(NotificationType).toBeDefined();
    expect(typeof NotificationType).toBe('object');
  });

  it('exports SystemConfig', () => {
    expect(SystemConfig).toBeDefined();
    expect(typeof SystemConfig).toBe('object');
  });
});

// ─── Object.freeze validation ─────────────────────────────────────────────────
describe('frozen enumerations', () => {
  it('UserRole is frozen', () => {
    expect(Object.isFrozen(UserRole)).toBe(true);
  });

  it('ShipmentStatus is frozen', () => {
    expect(Object.isFrozen(ShipmentStatus)).toBe(true);
  });

  it('TransactionType is frozen', () => {
    expect(Object.isFrozen(TransactionType)).toBe(true);
  });

  it('DisputeStatus is frozen', () => {
    expect(Object.isFrozen(DisputeStatus)).toBe(true);
  });

  it('DisputeCategory is frozen', () => {
    expect(Object.isFrozen(DisputeCategory)).toBe(true);
  });
});

// ─── UserRole specific tests ──────────────────────────────────────────────────
describe('UserRole enumeration', () => {
  it('contains exactly 4 roles', () => {
    const keys = Object.keys(UserRole);
    expect(keys).toHaveLength(4);
  });

  it('contains SUPER_ADMIN', () => {
    expect(UserRole.SUPER_ADMIN).toBe('SUPER_ADMIN');
  });

  it('contains DISTRIBUTOR', () => {
    expect(UserRole.DISTRIBUTOR).toBe('DISTRIBUTOR');
  });

  it('contains MERCHANT', () => {
    expect(UserRole.MERCHANT).toBe('MERCHANT');
  });

  it('contains WAREHOUSE', () => {
    expect(UserRole.WAREHOUSE).toBe('WAREHOUSE');
  });
});

// ─── SystemConfig specific tests ──────────────────────────────────────────────
describe('SystemConfig', () => {
  it('VOLUMETRIC_DIVISOR equals 5000', () => {
    expect(SystemConfig.VOLUMETRIC_DIVISOR).toBe(5000);
  });

  it('RTO_CHARGE_DEFAULT is a positive number', () => {
    expect(typeof SystemConfig.RTO_CHARGE_DEFAULT).toBe('number');
    expect(SystemConfig.RTO_CHARGE_DEFAULT).toBeGreaterThan(0);
  });
});

// ─── All enum values are strings ──────────────────────────────────────────────
describe('enum values are strings', () => {
  it('UserRole values are all strings', () => {
    const values = Object.values(UserRole);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('ShipmentStatus values are all strings', () => {
    const values = Object.values(ShipmentStatus);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('ShipmentServiceType values are all strings', () => {
    const values = Object.values(ShipmentServiceType);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('CODStatus values are all strings', () => {
    const values = Object.values(CODStatus);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('TransactionType values are all strings', () => {
    const values = Object.values(TransactionType);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('PaymentStatus values are all strings', () => {
    const values = Object.values(PaymentStatus);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('DisputeStatus values are all strings', () => {
    const values = Object.values(DisputeStatus);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('DisputeCategory values are all strings', () => {
    const values = Object.values(DisputeCategory);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('TicketStatus values are all strings', () => {
    const values = Object.values(TicketStatus);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('TicketPriority values are all strings', () => {
    const values = Object.values(TicketPriority);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('TicketCategory values are all strings', () => {
    const values = Object.values(TicketCategory);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });

  it('NotificationType values are all strings', () => {
    const values = Object.values(NotificationType);
    values.forEach((val) => {
      expect(typeof val).toBe('string');
    });
  });
});

// ─── PBT: roleToDashboardPath ─────────────────────────────────────────────────
describe('PBT: roleToDashboardPath for UserRole values', () => {
  it('returns non-empty strings starting with / for all UserRole keys', () => {
    /**
     * **Validates: Requirements 18.7**
     * 
     * Property: For each role key in UserRole, roleToDashboardPath(role) returns
     * a non-empty string starting with '/'.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(UserRole)),
        (role) => {
          const path = roleToDashboardPath(role);
          expect(typeof path).toBe('string');
          expect(path.length).toBeGreaterThan(0);
          expect(path.startsWith('/')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
