'use strict';

const {
  REQUIRED_CSV_COLS,
  UPDATABLE_FIELDS,
} = require('../../../../src/modules/shipments/shared/shipment.constants');

describe('shipment.constants', () => {
  describe('REQUIRED_CSV_COLS', () => {
    test('contains all 13 expected column names', () => {
      const expectedColumns = [
        'origin_name',
        'origin_phone',
        'origin_address',
        'origin_city',
        'origin_state',
        'origin_pincode',
        'dest_name',
        'dest_phone',
        'dest_address',
        'dest_city',
        'dest_state',
        'dest_pincode',
        'weight',
      ];

      expect(REQUIRED_CSV_COLS).toHaveLength(13);
      expect(REQUIRED_CSV_COLS).toEqual(expectedColumns);
    });

    test('all elements are non-empty strings', () => {
      expect(REQUIRED_CSV_COLS.length).toBeGreaterThan(0);
      
      REQUIRED_CSV_COLS.forEach((col) => {
        expect(typeof col).toBe('string');
        expect(col.length).toBeGreaterThan(0);
      });
    });
  });

  describe('UPDATABLE_FIELDS', () => {
    test('contains weight, origin, and destination', () => {
      expect(UPDATABLE_FIELDS).toContain('weight');
      expect(UPDATABLE_FIELDS).toContain('origin');
      expect(UPDATABLE_FIELDS).toContain('destination');
    });

    test('does not contain _id or merchantId (immutable identity fields)', () => {
      expect(UPDATABLE_FIELDS).not.toContain('_id');
      expect(UPDATABLE_FIELDS).not.toContain('merchantId');
    });
  });
});
