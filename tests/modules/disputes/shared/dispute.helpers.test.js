'use strict';

// ─── Mock shipmentRepository BEFORE importing the SUT ─────────────────────────
jest.mock('../../../../src/modules/shipments/shipment.repository');

const shipmentRepository = require('../../../../src/modules/shipments/shipment.repository');
const {
  buildFilter,
  buildWeightDisputeFilter,
} = require('../../../../src/modules/disputes/shared/dispute.helpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeCaller = (role, userId = 'user-001') => ({ role, userId });

/**
 * Build a fake shipment array with _id fields so that .map(s => s._id) works
 * when the SUT maps shipment results from shipmentRepository.findAll.
 */
const fakeShipments = (ids) => ids.map((_id) => ({ _id }));

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
// buildFilter
// =============================================================================
describe('buildFilter', () => {
  // ── R12.1 — MERCHANT caller ──────────────────────────────────────────────
  describe('MERCHANT caller', () => {
    it('sets filter.raisedBy = caller.userId', async () => {
      const caller = makeCaller('MERCHANT', 'merch-42');
      const filter = await buildFilter(caller, {});

      expect(filter.raisedBy).toBe('merch-42');
    });

    it('does NOT call shipmentRepository.findAll', async () => {
      await buildFilter(makeCaller('MERCHANT', 'merch-42'), {});

      expect(shipmentRepository.findAll).not.toHaveBeenCalled();
    });

    it('does NOT set shipmentId (no $in scope) unless query.shipmentId provided', async () => {
      const filter = await buildFilter(makeCaller('MERCHANT', 'merch-42'), {});

      expect(filter.shipmentId).toBeUndefined();
    });
  });

  // ── R12.2 — DISTRIBUTOR caller ───────────────────────────────────────────
  describe('DISTRIBUTOR caller', () => {
    it('calls shipmentRepository.findAll with distributorId scope', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['s1', 's2']));

      await buildFilter(makeCaller('DISTRIBUTOR', 'dist-99'), {});

      expect(shipmentRepository.findAll).toHaveBeenCalledWith(
        { distributorId: 'dist-99' },
        '_id',
      );
    });

    it('sets filter.shipmentId = { $in: [...ids] }', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['s1', 's2', 's3']));

      const filter = await buildFilter(makeCaller('DISTRIBUTOR', 'dist-99'), {});

      expect(filter.shipmentId).toEqual({ $in: ['s1', 's2', 's3'] });
    });

    it('sets filter.shipmentId.$in to empty array when no shipments found', async () => {
      shipmentRepository.findAll.mockResolvedValue([]);

      const filter = await buildFilter(makeCaller('DISTRIBUTOR', 'dist-99'), {});

      expect(filter.shipmentId).toEqual({ $in: [] });
    });

    it('does NOT set filter.raisedBy', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['s1']));

      const filter = await buildFilter(makeCaller('DISTRIBUTOR', 'dist-99'), {});

      expect(filter.raisedBy).toBeUndefined();
    });
  });

  // ── R12.3 — SUPER_ADMIN caller ───────────────────────────────────────────
  describe('SUPER_ADMIN caller', () => {
    it('does NOT set filter.raisedBy', async () => {
      const filter = await buildFilter(makeCaller('SUPER_ADMIN', 'sa-001'), {});

      expect(filter.raisedBy).toBeUndefined();
    });

    it('does NOT call shipmentRepository.findAll', async () => {
      await buildFilter(makeCaller('SUPER_ADMIN', 'sa-001'), {});

      expect(shipmentRepository.findAll).not.toHaveBeenCalled();
    });

    it('does NOT set filter.shipmentId (no scope filter)', async () => {
      const filter = await buildFilter(makeCaller('SUPER_ADMIN', 'sa-001'), {});

      expect(filter.shipmentId).toBeUndefined();
    });
  });

  // ── R12.4 — status query param ───────────────────────────────────────────
  describe('status query parameter', () => {
    it('includes filter.status when query.status is provided (MERCHANT)', async () => {
      const filter = await buildFilter(makeCaller('MERCHANT'), { status: 'OPEN' });

      expect(filter.status).toBe('OPEN');
    });

    it('includes filter.status when query.status is provided (SUPER_ADMIN)', async () => {
      const filter = await buildFilter(makeCaller('SUPER_ADMIN'), { status: 'RESOLVED' });

      expect(filter.status).toBe('RESOLVED');
    });

    it('includes filter.status when query.status is provided (DISTRIBUTOR)', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['s1']));

      const filter = await buildFilter(makeCaller('DISTRIBUTOR'), { status: 'IN_REVIEW' });

      expect(filter.status).toBe('IN_REVIEW');
    });

    it('does NOT set filter.status when query.status is absent', async () => {
      const filter = await buildFilter(makeCaller('MERCHANT'), {});

      expect(filter.status).toBeUndefined();
    });
  });

  // ── category query param ─────────────────────────────────────────────────
  describe('category query parameter', () => {
    it('includes filter.category when query.category is provided', async () => {
      const filter = await buildFilter(makeCaller('MERCHANT'), { category: 'LOST' });

      expect(filter.category).toBe('LOST');
    });

    it('does NOT set filter.category when absent', async () => {
      const filter = await buildFilter(makeCaller('MERCHANT'), {});

      expect(filter.category).toBeUndefined();
    });
  });

  // ── shipmentId query param (overrides $in for DISTRIBUTOR) ───────────────
  describe('shipmentId query parameter', () => {
    it('sets filter.shipmentId to exact match when query.shipmentId is provided (MERCHANT)', async () => {
      const filter = await buildFilter(makeCaller('MERCHANT'), { shipmentId: 'ship-123' });

      expect(filter.shipmentId).toBe('ship-123');
    });

    it('sets filter.shipmentId to exact match when query.shipmentId is provided (SUPER_ADMIN)', async () => {
      const filter = await buildFilter(makeCaller('SUPER_ADMIN'), { shipmentId: 'ship-456' });

      expect(filter.shipmentId).toBe('ship-456');
    });

    it('overrides the $in scope with the exact shipmentId when DISTRIBUTOR provides query.shipmentId', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['s1', 's2']));

      const filter = await buildFilter(makeCaller('DISTRIBUTOR'), { shipmentId: 'ship-exact' });

      // query.shipmentId should overwrite the $in set by DISTRIBUTOR scope
      expect(filter.shipmentId).toBe('ship-exact');
    });

    it('does NOT set filter.shipmentId when absent (SUPER_ADMIN)', async () => {
      const filter = await buildFilter(makeCaller('SUPER_ADMIN'), {});

      expect(filter.shipmentId).toBeUndefined();
    });
  });
});

// =============================================================================
// buildWeightDisputeFilter
// =============================================================================
describe('buildWeightDisputeFilter', () => {
  // ── R12.5 — MERCHANT caller ──────────────────────────────────────────────
  describe('MERCHANT caller', () => {
    it('calls shipmentRepository.findAll scoped to merchant shipments', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['ws1', 'ws2']));

      await buildWeightDisputeFilter(makeCaller('MERCHANT', 'merch-77'), {});

      expect(shipmentRepository.findAll).toHaveBeenCalledWith(
        { merchantId: 'merch-77' },
        '_id',
      );
    });

    it('sets filter.shipmentId = { $in: [...ids] } from merchant shipments', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['ws1', 'ws2']));

      const filter = await buildWeightDisputeFilter(makeCaller('MERCHANT', 'merch-77'), {});

      expect(filter.shipmentId).toEqual({ $in: ['ws1', 'ws2'] });
    });

    it('sets filter.shipmentId.$in to empty array when merchant has no shipments', async () => {
      shipmentRepository.findAll.mockResolvedValue([]);

      const filter = await buildWeightDisputeFilter(makeCaller('MERCHANT', 'merch-77'), {});

      expect(filter.shipmentId).toEqual({ $in: [] });
    });
  });

  // ── DISTRIBUTOR caller ───────────────────────────────────────────────────
  describe('DISTRIBUTOR caller', () => {
    it('calls shipmentRepository.findAll scoped to distributor shipments', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['ws3']));

      await buildWeightDisputeFilter(makeCaller('DISTRIBUTOR', 'dist-55'), {});

      expect(shipmentRepository.findAll).toHaveBeenCalledWith(
        { distributorId: 'dist-55' },
        '_id',
      );
    });

    it('sets filter.shipmentId = { $in: [...ids] } from distributor shipments', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['ws3', 'ws4']));

      const filter = await buildWeightDisputeFilter(makeCaller('DISTRIBUTOR', 'dist-55'), {});

      expect(filter.shipmentId).toEqual({ $in: ['ws3', 'ws4'] });
    });
  });

  // ── SUPER_ADMIN caller ───────────────────────────────────────────────────
  describe('SUPER_ADMIN caller', () => {
    it('does NOT call shipmentRepository.findAll', async () => {
      const filter = await buildWeightDisputeFilter(makeCaller('SUPER_ADMIN'), {});

      expect(shipmentRepository.findAll).not.toHaveBeenCalled();
    });

    it('does NOT set filter.shipmentId by default', async () => {
      const filter = await buildWeightDisputeFilter(makeCaller('SUPER_ADMIN'), {});

      expect(filter.shipmentId).toBeUndefined();
    });
  });

  // ── R12.6 — shipmentId query param ───────────────────────────────────────
  describe('shipmentId query parameter (exact match)', () => {
    it('sets filter.shipmentId as exact match when query.shipmentId is provided (SUPER_ADMIN)', async () => {
      const filter = await buildWeightDisputeFilter(
        makeCaller('SUPER_ADMIN'),
        { shipmentId: 'ship-exact-789' },
      );

      expect(filter.shipmentId).toBe('ship-exact-789');
    });

    it('overrides $in with the exact shipmentId when MERCHANT provides query.shipmentId', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['ws1', 'ws2']));

      const filter = await buildWeightDisputeFilter(
        makeCaller('MERCHANT', 'merch-77'),
        { shipmentId: 'ship-exact-100' },
      );

      expect(filter.shipmentId).toBe('ship-exact-100');
    });

    it('overrides $in with the exact shipmentId when DISTRIBUTOR provides query.shipmentId', async () => {
      shipmentRepository.findAll.mockResolvedValue(fakeShipments(['ws3', 'ws4']));

      const filter = await buildWeightDisputeFilter(
        makeCaller('DISTRIBUTOR', 'dist-55'),
        { shipmentId: 'ship-exact-200' },
      );

      expect(filter.shipmentId).toBe('ship-exact-200');
    });

    it('does NOT set filter.shipmentId when absent and caller is SUPER_ADMIN', async () => {
      const filter = await buildWeightDisputeFilter(makeCaller('SUPER_ADMIN'), {});

      expect(filter.shipmentId).toBeUndefined();
    });
  });

  // ── status query param ───────────────────────────────────────────────────
  describe('status query parameter', () => {
    it('includes filter.status when query.status is provided', async () => {
      const filter = await buildWeightDisputeFilter(makeCaller('SUPER_ADMIN'), { status: 'OPEN' });

      expect(filter.status).toBe('OPEN');
    });

    it('does NOT set filter.status when absent', async () => {
      const filter = await buildWeightDisputeFilter(makeCaller('SUPER_ADMIN'), {});

      expect(filter.status).toBeUndefined();
    });
  });
});
