'use strict';

/**
 * Shipment Create Service — Address Book Integration Tests
 *
 * Tests the address book resolution path in createShipmentService:
 * - Address book IDs are resolved before the transaction
 * - Fail-fast 400 errors when address book IDs are invalid/not found
 * - Backward compatibility: plain origin/destination still work
 * - markAddressUsedService is called asynchronously after booking
 */

// ─── Heavy mocks — prevent real DB/network calls ──────────────────────────────
jest.mock('../../../src/modules/users/address-book.repository');
jest.mock('../../../src/modules/users/address-book.service', () => ({
  markAddressUsedService: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/modules/users/user.repository');
jest.mock('../../../src/modules/users/warehouse.model', () => ({
  Warehouse: { findById: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../../../src/modules/users/user.model', () => ({
  User: { findOne: jest.fn() },
}));
jest.mock('../../../src/modules/rates/rate-card.model', () => ({
  RateCard: { findOne: jest.fn() },
}));
jest.mock('../../../src/modules/rates/margin-config.model', () => ({
  MarginConfig: { findOne: jest.fn() },
}));
jest.mock('../../../src/modules/shipments/shipment.model', () => ({
  Shipment: {
    generateAWB: jest.fn().mockReturnValue('VX-TEST-001'),
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }), // AWB is unique
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));
jest.mock('../../../src/utils/transaction', () => ({
  runInTransaction: jest.fn().mockImplementation(async (fn) => fn({})),
}));
jest.mock('../../../src/modules/finance/finance.service', () => ({
  applyTransaction: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../src/modules/notifications/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../src/modules/pricing/pricing.service', () => ({
  calculateShippingCost: jest.fn().mockReturnValue({
    merchantCost: 100, distributorCost: 80, carrierCost: 60,
    volumetricWeight: 1, billingWeight: 1, vexaroProfit: 20, distributorProfit: 20,
  }),
}));
jest.mock('../../../src/utils/velocity', () => ({
  velocityClient: {
    createForwardOrder: jest.fn().mockResolvedValue({
      awb: 'VX-CARRIER-001', carrierName: 'Delhivery',
      labelUrl: 'http://label.url', shipmentId: 'ship123',
      velocityOrderId: 'vo123',
    }),
    createWarehouse: jest.fn().mockResolvedValue('vel-wh-123'),
  },
}));
jest.mock('../../../src/utils/cache', () => ({
  del: jest.fn(),
  KEYS: { shipmentStats: jest.fn().mockReturnValue('key') },
}));
jest.mock('../../../src/modules/audit/audit.service', () => ({
  logAuditEvent: jest.fn(),
}));

const addressBookRepository = require('../../../src/modules/users/address-book.repository');
const { markAddressUsedService } = require('../../../src/modules/users/address-book.service');
const userRepository = require('../../../src/modules/users/user.repository');
const { User } = require('../../../src/modules/users/user.model');
const { Warehouse } = require('../../../src/modules/users/warehouse.model');
const { RateCard } = require('../../../src/modules/rates/rate-card.model');
const { Shipment } = require('../../../src/modules/shipments/shipment.model');
const { applyTransaction } = require('../../../src/modules/finance/finance.service');
const { TransactionType } = require('../../../src/constants');

const { createShipmentService } = require('../../../src/modules/shipments/services/shipment-create.service');

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const MERCHANT_ID  = '507f1f77bcf86cd799439011';
const DISTRIBUTOR_ID = '507f1f77bcf86cd799439012';
const SUPER_ADMIN_ID = '507f1f77bcf86cd799439013';
const ADDRESS_ID_O = '507f1f77bcf86cd799439020';
const ADDRESS_ID_D = '507f1f77bcf86cd799439021';
const SHIPMENT_ID  = '507f1f77bcf86cd799439030';

const mockMerchant = {
  _id: MERCHANT_ID, role: 'MERCHANT', isActive: true,
  deletedAt: null, phone: '9876543210', invitedBy: null,
};

const mockWarehouse = {
  _id: '507f1f77bcf86cd799439040', contactPerson: 'WH Manager',
  address: 'WH Street', city: 'Delhi', state: 'Delhi', pincode: '110001',
  save: jest.fn().mockResolvedValue({}),
};

const mockRateCard = { _id: 'rc1', serviceType: 'STANDARD', isActive: true };

const addressBookEntry = {
  name: 'AB Name', phone: '9000000001', addressLine: 'AB Street',
  city: 'Bengaluru', state: 'Karnataka', pincode: '560001', country: 'India',
};

const mockShipment = {
  _id: SHIPMENT_ID, awb: 'VX-TEST-001',
  toObject: () => ({ _id: SHIPMENT_ID, awb: 'VX-TEST-001' }),
};

const callerMerchant = { userId: MERCHANT_ID, role: 'MERCHANT' };

// ─── Shared setup ──────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();

  userRepository.findOne.mockResolvedValue(mockMerchant);
  User.findOne.mockResolvedValue({
    _id: { toString: () => SUPER_ADMIN_ID },
    role: 'SUPER_ADMIN',
    isActive: true,
    deletedAt: null,
  });
  Warehouse.findOne.mockResolvedValue(mockWarehouse);
  Warehouse.findById.mockResolvedValue(mockWarehouse);
  RateCard.findOne.mockResolvedValue(mockRateCard);
  Shipment.create.mockResolvedValue([mockShipment]);
  Shipment.findByIdAndUpdate.mockResolvedValue(mockShipment);
});

afterEach(async () => {
  await new Promise((resolve) => setImmediate(resolve));
});

// ─── Backward compatibility: plain destination still works ─────────────────────

describe('backward compatibility (no address book IDs)', () => {
  test('creates shipment with explicit destination when no address book IDs provided', async () => {
    const dto = {
      destination: { name: 'Customer', phone: '9111111111', addressLine: '1 Customer Ln', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
      weight: 2,
    };

    const result = await createShipmentService(dto, callerMerchant);

    expect(result).toBeDefined();
    expect(addressBookRepository.findById).not.toHaveBeenCalled();
    expect(markAddressUsedService).not.toHaveBeenCalled();
  });

  test('credits super admin share and distributor margin instead of debiting distributor cost', async () => {
    userRepository.findOne.mockResolvedValueOnce({
      ...mockMerchant,
      invitedBy: { toString: () => DISTRIBUTOR_ID },
    });

    const dto = {
      destination: { name: 'Customer', phone: '9111111111', addressLine: '1 Customer Ln', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
      weight: 2,
    };

    await createShipmentService(dto, callerMerchant);

    expect(applyTransaction).toHaveBeenCalledWith(
      {},
      MERCHANT_ID,
      TransactionType.CHARGE,
      100,
      expect.objectContaining({
        reference: 'CHARGE-VX-TEST-001-MERCH',
      }),
    );
    expect(applyTransaction).toHaveBeenCalledWith(
      {},
      SUPER_ADMIN_ID,
      TransactionType.CREDIT,
      80,
      expect.objectContaining({
        reference: 'CREDIT-VX-TEST-001-SUPER-ADMIN',
        note: expect.stringContaining('Platform shipment amount'),
      }),
    );
    expect(applyTransaction).toHaveBeenCalledWith(
      {},
      DISTRIBUTOR_ID,
      TransactionType.CREDIT,
      20,
      expect.objectContaining({
        reference: 'CREDIT-VX-TEST-001-DIST-MARGIN',
        note: expect.stringContaining('Distributor margin'),
      }),
    );
    expect(applyTransaction).not.toHaveBeenCalledWith(
      {},
      DISTRIBUTOR_ID,
      TransactionType.CHARGE,
      80,
      expect.any(Object),
    );
  });
});

// ─── originAddressBookId resolution ───────────────────────────────────────────

describe('originAddressBookId resolution', () => {
  test('resolves origin from address book and uses it in shipment creation', async () => {
    addressBookRepository.findById
      .mockResolvedValueOnce(addressBookEntry);  // origin lookup

    const dto = {
      originAddressBookId: ADDRESS_ID_O,
      destination: { name: 'Dest', phone: '9000000002', addressLine: '2 Dest Rd', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
      weight: 1.5,
    };

    const result = await createShipmentService(dto, callerMerchant);

    expect(addressBookRepository.findById).toHaveBeenCalledWith(ADDRESS_ID_O, MERCHANT_ID);
    expect(result).toBeDefined();
  });

  test('throws 400 when originAddressBookId not found or wrong merchant', async () => {
    addressBookRepository.findById.mockResolvedValue(null); // not found

    const dto = {
      originAddressBookId: ADDRESS_ID_O,
      destination: { name: 'D', phone: '9000000002', addressLine: '2 Rd', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
      weight: 1,
    };

    await expect(createShipmentService(dto, callerMerchant))
      .rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('originAddressBookId'),
      });
  });
});

// ─── destinationAddressBookId resolution ──────────────────────────────────────

describe('destinationAddressBookId resolution', () => {
  test('resolves destination from address book', async () => {
    addressBookRepository.findById
      .mockResolvedValueOnce(addressBookEntry);  // destination lookup

    const dto = {
      destinationAddressBookId: ADDRESS_ID_D,
      weight: 2,
    };

    const result = await createShipmentService(dto, callerMerchant);

    expect(addressBookRepository.findById).toHaveBeenCalledWith(ADDRESS_ID_D, MERCHANT_ID);
    expect(result).toBeDefined();
  });

  test('throws 400 when destinationAddressBookId not found', async () => {
    addressBookRepository.findById.mockResolvedValue(null);

    const dto = { destinationAddressBookId: ADDRESS_ID_D, weight: 1 };

    await expect(createShipmentService(dto, callerMerchant))
      .rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('destinationAddressBookId'),
      });
  });

  test('throws 400 when neither destination nor destinationAddressBookId provided', async () => {
    const dto = { weight: 1 }; // no destination info

    await expect(createShipmentService(dto, callerMerchant))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─── Both address book IDs provided ───────────────────────────────────────────

describe('both originAddressBookId and destinationAddressBookId provided', () => {
  test('resolves both addresses and calls markAddressUsedService for each', async () => {
    // First call = origin, second call = destination
    addressBookRepository.findById
      .mockResolvedValueOnce({ ...addressBookEntry, city: 'Mumbai' })
      .mockResolvedValueOnce({ ...addressBookEntry, city: 'Delhi' });

    const dto = {
      originAddressBookId:      ADDRESS_ID_O,
      destinationAddressBookId: ADDRESS_ID_D,
      weight: 3,
    };

    await createShipmentService(dto, callerMerchant);

    // Allow setImmediate to execute
    await new Promise((resolve) => setImmediate(resolve));

    expect(markAddressUsedService).toHaveBeenCalledTimes(2);
    expect(markAddressUsedService).toHaveBeenCalledWith(ADDRESS_ID_O, MERCHANT_ID);
    expect(markAddressUsedService).toHaveBeenCalledWith(ADDRESS_ID_D, MERCHANT_ID);
  });
});

// ─── markAddressUsedService is fire-and-forget ─────────────────────────────────

describe('markAddressUsedService error handling', () => {
  test('does not propagate errors from markAddressUsedService (fire-and-forget)', async () => {
    markAddressUsedService.mockRejectedValue(new Error('Mark used failed'));
    addressBookRepository.findById.mockResolvedValueOnce(addressBookEntry);

    const dto = { destinationAddressBookId: ADDRESS_ID_D, weight: 1 };

    // Should resolve without throwing even if markAddressUsedService fails
    await expect(createShipmentService(dto, callerMerchant)).resolves.toBeDefined();
  });
});
