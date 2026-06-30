'use strict';

// ─── Mock shipment.model BEFORE importing the SUT ─────────────────────────────
jest.mock('../../../../src/modules/shipments/shipment.model');

const { Shipment } = require('../../../../src/modules/shipments/shipment.model');
const {
  buildShipmentFilter,
  findShipmentWithAccess,
} = require('../../../../src/modules/shipments/shared/shipment.helpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeCaller = (role, userId = 'user-001') => ({ role, userId });

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
// buildShipmentFilter
// =============================================================================
describe('buildShipmentFilter', () => {
  // ── R11.9 — deletedAt: null always present ───────────────────────────────
  describe('deletedAt: null is always set', () => {
    const roles = ['DISTRIBUTOR', 'MERCHANT', 'WAREHOUSE', 'SUPER_ADMIN'];

    roles.forEach((role) => {
      it(`sets deletedAt: null for role=${role}`, () => {
        const filter = buildShipmentFilter(makeCaller(role));
        expect(filter.deletedAt).toBeNull();
      });
    });

    it('sets deletedAt: null even when query params are provided', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), {
        merchantId: 'merchant-1',
        search: 'hello',
      });
      expect(filter.deletedAt).toBeNull();
    });
  });

  // ── R11.1 — DISTRIBUTOR role ─────────────────────────────────────────────
  describe('DISTRIBUTOR caller', () => {
    it('sets filter.distributorId = caller.userId', () => {
      const caller = makeCaller('DISTRIBUTOR', 'dist-999');
      const filter = buildShipmentFilter(caller);
      expect(filter.distributorId).toBe('dist-999');
    });

    it('does NOT set merchantId or warehouseId', () => {
      const filter = buildShipmentFilter(makeCaller('DISTRIBUTOR', 'dist-001'));
      expect(filter.merchantId).toBeUndefined();
      expect(filter.warehouseId).toBeUndefined();
    });
  });

  // ── R11.2 — MERCHANT role ────────────────────────────────────────────────
  describe('MERCHANT caller', () => {
    it('sets filter.merchantId = caller.userId', () => {
      const caller = makeCaller('MERCHANT', 'merch-42');
      const filter = buildShipmentFilter(caller);
      expect(filter.merchantId).toBe('merch-42');
    });

    it('does NOT set distributorId or warehouseId', () => {
      const filter = buildShipmentFilter(makeCaller('MERCHANT', 'merch-42'));
      expect(filter.distributorId).toBeUndefined();
      expect(filter.warehouseId).toBeUndefined();
    });
  });

  // ── R11.3 — WAREHOUSE role ───────────────────────────────────────────────
  describe('WAREHOUSE caller', () => {
    it('sets filter.warehouseId = caller.userId', () => {
      const caller = makeCaller('WAREHOUSE', 'wh-77');
      const filter = buildShipmentFilter(caller);
      expect(filter.warehouseId).toBe('wh-77');
    });

    it('does NOT set merchantId or distributorId', () => {
      const filter = buildShipmentFilter(makeCaller('WAREHOUSE', 'wh-77'));
      expect(filter.merchantId).toBeUndefined();
      expect(filter.distributorId).toBeUndefined();
    });
  });

  // ── R11.4 — SUPER_ADMIN role ─────────────────────────────────────────────
  describe('SUPER_ADMIN caller (no role-based filter forced)', () => {
    it('does not set merchantId, distributorId, or warehouseId by default', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'));
      expect(filter.merchantId).toBeUndefined();
      expect(filter.distributorId).toBeUndefined();
      expect(filter.warehouseId).toBeUndefined();
    });
  });

  // ── R11.5 — SUPER_ADMIN optional query filters ───────────────────────────
  describe('SUPER_ADMIN optional query filters', () => {
    it('includes filter.merchantId when query.merchantId is provided', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), { merchantId: 'merch-abc' });
      expect(filter.merchantId).toBe('merch-abc');
    });

    it('includes filter.distributorId when query.distributorId is provided', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), { distributorId: 'dist-abc' });
      expect(filter.distributorId).toBe('dist-abc');
    });

    it('includes filter.warehouseId when query.warehouseId is provided', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), { warehouseId: 'wh-abc' });
      expect(filter.warehouseId).toBe('wh-abc');
    });

    it('can include all three optional filters simultaneously', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), {
        merchantId: 'm1',
        distributorId: 'd1',
        warehouseId: 'w1',
      });
      expect(filter.merchantId).toBe('m1');
      expect(filter.distributorId).toBe('d1');
      expect(filter.warehouseId).toBe('w1');
    });

    it('non-SA roles do NOT pick up optional query.merchantId', () => {
      // MERCHANT has its own userId baked in; query.merchantId must not override
      const caller = makeCaller('MERCHANT', 'merch-own');
      const filter = buildShipmentFilter(caller, { merchantId: 'other-merchant' });
      // The filter.merchantId must be the caller's userId, not the query param
      expect(filter.merchantId).toBe('merch-own');
    });
  });

  // ── R11.6 / R11.7 — search and ReDoS escape ─────────────────────────────
  describe('search query', () => {
    it('builds a $or array covering awb, merchantOrderRef, invoiceNumber', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), { search: 'hello' });
      expect(filter.$or).toHaveLength(3);
      const fields = filter.$or.map((clause) => Object.keys(clause)[0]);
      expect(fields).toContain('awb');
      expect(fields).toContain('merchantOrderRef');
      expect(fields).toContain('invoiceNumber');
    });

    it('uses case-insensitive regex for each field', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), { search: 'abc' });
      filter.$or.forEach((clause) => {
        const val = Object.values(clause)[0];
        expect(val.$options).toBe('i');
      });
    });

    it('escapes regex-special characters to prevent ReDoS', () => {
      const dangerous = '.*+?^${}()|[\\]';
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), { search: dangerous });
      const awbRegex = filter.$or[0].awb.$regex;
      // None of the unescaped special chars should remain literally
      // After escaping, all special chars should be preceded by a backslash
      expect(awbRegex).not.toMatch(/(?<!\\)\.\*/); // .* unescaped
      // The escaped string should differ from the raw input
      expect(awbRegex).not.toBe(dangerous);
      // Each special char must be backslash-escaped
      const specialChars = ['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']'];
      specialChars.forEach((ch) => {
        // Every occurrence of a special char in the result must be preceded by \\
        const idx = awbRegex.indexOf(ch);
        if (idx !== -1) {
          expect(awbRegex[idx - 1]).toBe('\\');
        }
      });
    });

    it('does not add $or when search is absent', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), {});
      expect(filter.$or).toBeUndefined();
    });
  });

  // ── R11.8 — dateFrom / dateTo ────────────────────────────────────────────
  describe('dateFrom / dateTo filters', () => {
    it('sets createdAt.$gte when dateFrom is provided', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), { dateFrom: '2024-01-01' });
      expect(filter.createdAt).toBeDefined();
      expect(filter.createdAt.$gte).toEqual(new Date('2024-01-01'));
    });

    it('sets createdAt.$lte when dateTo is provided', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), { dateTo: '2024-12-31' });
      expect(filter.createdAt).toBeDefined();
      expect(filter.createdAt.$lte).toEqual(new Date('2024-12-31'));
    });

    it('sets both $gte and $lte when both dateFrom and dateTo are provided', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      });
      expect(filter.createdAt.$gte).toEqual(new Date('2024-01-01'));
      expect(filter.createdAt.$lte).toEqual(new Date('2024-12-31'));
    });

    it('does not add createdAt when neither dateFrom nor dateTo is provided', () => {
      const filter = buildShipmentFilter(makeCaller('SUPER_ADMIN'), {});
      expect(filter.createdAt).toBeUndefined();
    });
  });
});

// =============================================================================
// findShipmentWithAccess
// =============================================================================
describe('findShipmentWithAccess', () => {
  // Helpers for fake populate chain
  const makePopulate = (result) => {
    const populateStub = jest.fn();
    // Supports chaining: .populate().populate().populate()
    populateStub.mockReturnValue({ populate: populateStub });
    // Last .populate() in chain returns the result (simulate three .populate() calls)
    let callCount = 0;
    populateStub.mockImplementation(() => {
      callCount += 1;
      if (callCount >= 3) {
        return Promise.resolve(result);
      }
      return { populate: populateStub };
    });
    return populateStub;
  };

  it('throws 404 when shipment is not found', async () => {
    // findOne returns a chain that resolves to null
    const populateFn = makePopulate(null);
    Shipment.findOne.mockReturnValue({ populate: populateFn });

    await expect(
      findShipmentWithAccess('ship-123', makeCaller('SUPER_ADMIN', 'sa-001')),
    ).rejects.toMatchObject({ statusCode: 404, message: expect.stringContaining('not found') });
  });

  it('throws 403 when caller does not own the shipment (MERCHANT, wrong owner)', async () => {
    const fakeShipment = {
      merchantId:    { _id: { toString: () => 'other-merch' } },
      distributorId: null,
      warehouseId:   null,
    };
    const populateFn = makePopulate(fakeShipment);
    Shipment.findOne.mockReturnValue({ populate: populateFn });

    const caller = makeCaller('MERCHANT', 'my-merch-id');
    await expect(
      findShipmentWithAccess('ship-abc', caller),
    ).rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('Access denied') });
  });

  it('throws 403 when DISTRIBUTOR caller does not own the shipment', async () => {
    const fakeShipment = {
      merchantId:    null,
      distributorId: { _id: { toString: () => 'other-dist' } },
      warehouseId:   null,
    };
    const populateFn = makePopulate(fakeShipment);
    Shipment.findOne.mockReturnValue({ populate: populateFn });

    const caller = makeCaller('DISTRIBUTOR', 'my-dist-id');
    await expect(
      findShipmentWithAccess('ship-abc', caller),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when WAREHOUSE caller does not own the shipment', async () => {
    const fakeShipment = {
      merchantId:    null,
      distributorId: null,
      warehouseId:   { _id: { toString: () => 'other-wh' } },
    };
    const populateFn = makePopulate(fakeShipment);
    Shipment.findOne.mockReturnValue({ populate: populateFn });

    const caller = makeCaller('WAREHOUSE', 'my-wh-id');
    await expect(
      findShipmentWithAccess('ship-abc', caller),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns the shipment when SUPER_ADMIN calls (no ownership check)', async () => {
    const fakeShipment = {
      merchantId:    { _id: { toString: () => 'some-merch' } },
      distributorId: null,
      warehouseId:   null,
    };
    const populateFn = makePopulate(fakeShipment);
    Shipment.findOne.mockReturnValue({ populate: populateFn });

    const result = await findShipmentWithAccess('ship-abc', makeCaller('SUPER_ADMIN', 'sa-001'));
    expect(result).toBe(fakeShipment);
  });

  it('returns the shipment when MERCHANT caller is the correct owner', async () => {
    const merchantObjId = 'merch-correct';
    const fakeShipment = {
      merchantId:    { _id: { toString: () => merchantObjId } },
      distributorId: null,
      warehouseId:   null,
    };
    const populateFn = makePopulate(fakeShipment);
    Shipment.findOne.mockReturnValue({ populate: populateFn });

    const caller = makeCaller('MERCHANT', merchantObjId);
    const result = await findShipmentWithAccess('ship-abc', caller);
    expect(result).toBe(fakeShipment);
  });

  it('calls Shipment.findOne with correct filter (shipmentId + deletedAt:null)', async () => {
    const fakeShipment = {
      merchantId:    { _id: { toString: () => 'merch-id' } },
      distributorId: null,
      warehouseId:   null,
    };
    const populateFn = makePopulate(fakeShipment);
    Shipment.findOne.mockReturnValue({ populate: populateFn });

    await findShipmentWithAccess('ship-xyz', makeCaller('SUPER_ADMIN'));
    expect(Shipment.findOne).toHaveBeenCalledWith({ _id: 'ship-xyz', deletedAt: null });
  });
});
