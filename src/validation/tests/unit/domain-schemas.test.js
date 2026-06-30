'use strict';

const auth = require('../../schemas/auth');
const shipments = require('../../schemas/shipments');
const finance = require('../../schemas/finance');
const users = require('../../schemas/users');
const reports = require('../../schemas/reports');
const { UserRole, ShipmentStatus } = require('../../../constants');

const destination = {
  name: 'Alice', phone: '9876543210', addressLine: '12 Example Street',
  city: 'Delhi', state: 'Delhi', pincode: '110001',
};

describe('domain schemas', () => {
  test('normalizes login email and enforces password policy on password changes', () => {
    expect(auth.loginSchema.parse({ email: ' USER@EXAMPLE.COM ', password: 'x' }).email).toBe('user@example.com');
    expect(auth.setPasswordSchema.safeParse({ token: 'x'.repeat(32), password: 'weak' }).success).toBe(false);
  });

  test('enforces shipment COD, weight and precision rules', () => {
    const valid = { destination, weight: 1, declaredValue: 500, isCOD: true, codAmount: 400.25 };
    expect(shipments.createShipmentSchema.safeParse(valid).success).toBe(true);
    expect(shipments.createShipmentSchema.safeParse({ ...valid, codAmount: 500.001 }).success).toBe(false);
    expect(shipments.createShipmentSchema.safeParse({ ...valid, codAmount: 600 }).success).toBe(false);
    expect(shipments.createShipmentSchema.safeParse({ ...valid, weight: 51 }).success).toBe(false);
  });

  test('encodes allowed shipment lifecycle transitions', () => {
    expect(shipments.isShipmentStatusTransitionAllowed(ShipmentStatus.ORDER_CREATED, ShipmentStatus.PICKED_UP)).toBe(true);
    expect(shipments.isShipmentStatusTransitionAllowed(ShipmentStatus.DELIVERED, ShipmentStatus.PICKED_UP)).toBe(false);
  });

  test('enforces financial precision and boundaries', () => {
    const userId = '507f1f77bcf86cd799439011';
    expect(finance.topupSchema.safeParse({ userId, amount: 10.25 }).success).toBe(true);
    expect(finance.topupSchema.safeParse({ userId, amount: 10.255 }).success).toBe(false);
  });

  test('enforces merchant warehouse hierarchy', () => {
    const base = { firstName: 'A', lastName: 'B', email: 'a@example.com', role: UserRole.MERCHANT };
    expect(users.inviteUserSchema.safeParse(base).success).toBe(false);
    expect(users.inviteUserSchema.safeParse({ ...base, role: UserRole.DISTRIBUTOR, warehouse: {
      address: 'Example address', pincode: '110001', city: 'Delhi', state: 'Delhi', contactPerson: 'A',
    } }).success).toBe(false);
  });

  test('validates report date ranges', () => {
    expect(reports.reportQueryDto.safeParse({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }).success).toBe(true);
    expect(reports.reportQueryDto.safeParse({ dateFrom: '2026-02-01', dateTo: '2026-01-01' }).success).toBe(false);
  });
});
