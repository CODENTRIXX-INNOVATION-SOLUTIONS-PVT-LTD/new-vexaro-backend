'use strict';

/**
 * Tests for src/utils/pagination.js
 *
 * Covers:
 *  - getPaginationParams: skip calculation, limit clamping, page/limit defaults
 *  - buildPaginationMeta: pages calculation, hasNextPage, hasPrevPage
 *
 * Property-based tests:
 *  - Property 1: skip = (page-1)*limit for any page ∈ [1,1000], limit ∈ [1,100]
 *  - Property 2: hasPrevPage iff page > 1
 *
 * Validates: Requirements 2.1
 */

const fc = require('fast-check');
const { getPaginationParams, buildPaginationMeta } = require('../../src/utils/pagination');

// ─── getPaginationParams ───────────────────────────────────────────────────────

describe('getPaginationParams', () => {

  describe('skip calculation', () => {
    test('page=1 limit=10 => skip=0', () => {
      const { skip } = getPaginationParams({ page: '1', limit: '10' });
      expect(skip).toBe(0);
    });

    test('page=3 limit=10 => skip=20', () => {
      const { skip } = getPaginationParams({ page: '3', limit: '10' });
      expect(skip).toBe(20);
    });

    test('page=5 limit=20 => skip=80', () => {
      const { skip } = getPaginationParams({ page: '5', limit: '20' });
      expect(skip).toBe(80);
    });

    test('returns correct page and limit in result', () => {
      const result = getPaginationParams({ page: '2', limit: '15' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(15);
      expect(result.skip).toBe(15);
    });
  });

  describe('limit clamping', () => {
    test('limit=100 is kept as-is (boundary)', () => {
      const { limit } = getPaginationParams({ page: '1', limit: '100' });
      expect(limit).toBe(100);
    });

    test('limit=101 is clamped to 100', () => {
      const { limit } = getPaginationParams({ page: '1', limit: '101' });
      expect(limit).toBe(100);
    });

    test('limit=500 is clamped to 100', () => {
      const { limit } = getPaginationParams({ page: '1', limit: '500' });
      expect(limit).toBe(100);
    });

    test('limit=0 is raised to 1', () => {
      const { limit } = getPaginationParams({ page: '1', limit: '0' });
      expect(limit).toBeGreaterThanOrEqual(1);
    });

    test('limit=non-numeric falls back to defaultLimit', () => {
      const { limit } = getPaginationParams({ page: '1', limit: 'abc' }, 25);
      expect(limit).toBe(25);
    });
  });

  describe('page clamping', () => {
    test('page=0 is raised to 1', () => {
      const { page } = getPaginationParams({ page: '0', limit: '10' });
      expect(page).toBe(1);
    });

    test('negative page is raised to 1', () => {
      const { page } = getPaginationParams({ page: '-5', limit: '10' });
      expect(page).toBe(1);
    });

    test('page=non-numeric defaults to 1', () => {
      const { page } = getPaginationParams({ page: 'foo', limit: '10' });
      expect(page).toBe(1);
    });
  });

  describe('defaultLimit', () => {
    test('uses defaultLimit=20 when no limit in query', () => {
      const { limit } = getPaginationParams({});
      expect(limit).toBe(20);
    });

    test('uses custom defaultLimit when no limit in query', () => {
      const { limit } = getPaginationParams({}, 50);
      expect(limit).toBe(50);
    });

    test('custom defaultLimit > 100 is still clamped to 100', () => {
      const { limit } = getPaginationParams({}, 200);
      expect(limit).toBe(100);
    });
  });
});

// ─── buildPaginationMeta ───────────────────────────────────────────────────────

describe('buildPaginationMeta', () => {

  describe('pages calculation', () => {
    test('total=100 limit=10 => pages=10', () => {
      const { pages } = buildPaginationMeta(100, 1, 10);
      expect(pages).toBe(10);
    });

    test('total=101 limit=10 => pages=11 (ceiling)', () => {
      const { pages } = buildPaginationMeta(101, 1, 10);
      expect(pages).toBe(11);
    });

    test('total=0 => pages=1 (floor to 1)', () => {
      const { pages } = buildPaginationMeta(0, 1, 10);
      expect(pages).toBe(1);
    });

    test('total=1 limit=10 => pages=1', () => {
      const { pages } = buildPaginationMeta(1, 1, 10);
      expect(pages).toBe(1);
    });
  });

  describe('hasNextPage', () => {
    test('page=1 pages=3 => hasNextPage=true', () => {
      const { hasNextPage } = buildPaginationMeta(30, 1, 10);
      expect(hasNextPage).toBe(true);
    });

    test('page=3 pages=3 => hasNextPage=false (last page)', () => {
      const { hasNextPage } = buildPaginationMeta(30, 3, 10);
      expect(hasNextPage).toBe(false);
    });

    test('total=0 page=1 => hasNextPage=false', () => {
      const { hasNextPage } = buildPaginationMeta(0, 1, 10);
      expect(hasNextPage).toBe(false);
    });
  });

  describe('hasPrevPage', () => {
    test('page=1 => hasPrevPage=false', () => {
      const { hasPrevPage } = buildPaginationMeta(50, 1, 10);
      expect(hasPrevPage).toBe(false);
    });

    test('page=2 => hasPrevPage=true', () => {
      const { hasPrevPage } = buildPaginationMeta(50, 2, 10);
      expect(hasPrevPage).toBe(true);
    });

    test('page=5 => hasPrevPage=true', () => {
      const { hasPrevPage } = buildPaginationMeta(100, 5, 10);
      expect(hasPrevPage).toBe(true);
    });
  });

  describe('meta shape', () => {
    test('returns all expected keys', () => {
      const meta = buildPaginationMeta(50, 2, 10);
      expect(meta).toHaveProperty('total', 50);
      expect(meta).toHaveProperty('page', 2);
      expect(meta).toHaveProperty('limit', 10);
      expect(meta).toHaveProperty('pages');
      expect(meta).toHaveProperty('hasNextPage');
      expect(meta).toHaveProperty('hasPrevPage');
    });
  });
});

// ─── Property-based tests ──────────────────────────────────────────────────────

describe('Property-based tests', () => {

  /**
   * Property 1: For any page ∈ [1,1000] and limit ∈ [1,100],
   * getPaginationParams returns skip = (page-1) * limit exactly.
   *
   * Validates: Requirements 2.1
   */
  test('Property 1: skip = (page-1)*limit for valid page and limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        (page, limit) => {
          const result = getPaginationParams(
            { page: String(page), limit: String(limit) }
          );
          return result.skip === (page - 1) * limit;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2: hasPrevPage iff page > 1.
   * Holds for any total ≥ 0, page ∈ [1,1000], limit ∈ [1,100].
   *
   * Validates: Requirements 2.1
   */
  test('Property 2: hasPrevPage iff page > 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        (total, page, limit) => {
          const { hasPrevPage } = buildPaginationMeta(total, page, limit);
          return hasPrevPage === (page > 1);
        }
      ),
      { numRuns: 200 }
    );
  });
});
