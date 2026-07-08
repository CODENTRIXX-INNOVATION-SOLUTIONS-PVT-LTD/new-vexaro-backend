'use strict';

const {
  REQUIRED_CSV_COLS,
  UPDATABLE_FIELDS,
} = require('../../../../src/modules/shipments/shared/shipment.constants');

describe('shipment.constants', () => {
  describe('REQUIRED_CSV_COLS', () => {
    test('contains all 24 expected column names', () => {
      const expectedColumns = [
        'origin_name', 'origin_phone', 'origin_address', 'origin_city', 'origin_state', 'origin_pincode',
        'dest_name',   'dest_phone',   'dest_address',   'dest_city',   'dest_state',   'dest_pincode',
        'weight', 'length', 'breadth', 'height',
        'product_name', 'sku', 'selling_price', 'discount', 'tax',
        'declared_value', 'payment_method', 'cod_amount',
      ];

      expect(REQUIRED_CSV_COLS).toHaveLength(24);
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
