'use strict';

const refundRequestService = require('../services/refund-request.service');
const refundRequestRepository = require('../refund-request.repository');
const { RefundRequestStatus } = require('../refund-request.model');
const refundService = require('../services/refund.service');
const financeRepository = require('../finance.repository');
const userRepository = require('../../users/user.repository');
const { UserRole } = require('../../../constants');
const mongoose = require('mongoose');

// Mock dependencies
jest.mock('../refund-request.repository');
jest.mock('../services/refund.service');
jest.mock('../finance.repository');
jest.mock('../../users/user.repository');
jest.mock('../../../utils/transaction', () => ({
  runInTransaction: jest.fn((cb) => cb('mock-session')),
}));
jest.mock('../../audit/audit.service', () => ({
  logAuditEvent: jest.fn(),
}));
jest.mock('../../notifications/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../utils/email', () => ({
  sendRefundRequestSubmittedEmail: jest.fn().mockResolvedValue({}),
  sendRefundRequestDecisionEmail: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('RefundRequest Service', () => {
  const merchantId = '507f1f77bcf86cd799439011';
  const distributorId = '507f1f77bcf86cd799439012';
  const superAdminId = '507f1f77bcf86cd799439013';
  const shipmentId = '507f1f77bcf86cd799439014';
  const refundRequestId = '507f1f77bcf86cd799439015';

  const mockMerchant = {
    _id: merchantId,
    email: 'merchant@example.com',
    role: UserRole.MERCHANT,
    invitedBy: distributorId,
  };

  const mockDistributor = {
    _id: distributorId,
    email: 'dist@example.com',
    role: UserRole.DISTRIBUTOR,
  };

  const mockSuperAdmin = {
    _id: superAdminId,
    email: 'sa@example.com',
    role: UserRole.SUPER_ADMIN,
  };

  const mockShipment = {
    _id: shipmentId,
    awb: 'AWB-123456',
    merchantId,
    distributorId,
    status: 'ORDER_CREATED',
  };

  const mockRefundRequest = {
    _id: refundRequestId,
    merchantId,
    distributorId,
    shipmentId,
    awb: 'AWB-123456',
    amount: 150.50,
    reason: 'Incorrect weight charged',
    status: RefundRequestStatus.PENDING,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Register mock Shipment model dynamically
    if (!mongoose.models.Shipment) {
      mongoose.model('Shipment', new mongoose.Schema({
        awb: String,
        merchantId: mongoose.Schema.Types.ObjectId,
        distributorId: mongoose.Schema.Types.ObjectId,
        status: String,
        deletedAt: Date,
      }));
    }
  });

  describe('submitRefundRequestService', () => {
    test('should submit refund request successfully', async () => {
      // Mock Shipment findOne
      const mockShipmentFindOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockShipment),
      });
      mongoose.model('Shipment').findOne = mockShipmentFindOne;

      userRepository.findOne.mockResolvedValue(mockMerchant);
      refundRequestRepository.findPendingByShipmentId.mockResolvedValue(null);
      refundRequestRepository.create.mockResolvedValue(mockRefundRequest);

      const result = await refundRequestService.submitRefundRequestService(
        { shipmentId, amount: 150.50, reason: 'Incorrect weight charged' },
        { userId: merchantId, role: UserRole.MERCHANT }
      );

      expect(result).toEqual(mockRefundRequest);
      expect(refundRequestRepository.create).toHaveBeenCalledWith({
        merchantId,
        distributorId,
        shipmentId,
        awb: 'AWB-123456',
        amount: 150.50,
        reason: 'Incorrect weight charged',
        status: RefundRequestStatus.PENDING,
      });
    });

    test('should throw 403 if caller is not a merchant', async () => {
      await expect(
        refundRequestService.submitRefundRequestService(
          { shipmentId, amount: 150.50, reason: 'Incorrect weight charged' },
          { userId: distributorId, role: UserRole.DISTRIBUTOR }
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('should throw 404 if shipment not found or does not belong to merchant', async () => {
      const mockShipmentFindOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      mongoose.model('Shipment').findOne = mockShipmentFindOne;

      await expect(
        refundRequestService.submitRefundRequestService(
          { shipmentId, amount: 150.50, reason: 'Incorrect weight charged' },
          { userId: merchantId, role: UserRole.MERCHANT }
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('should throw 422 if shipment is already DELIVERED', async () => {
      const mockShipmentFindOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...mockShipment, status: 'DELIVERED' }),
      });
      mongoose.model('Shipment').findOne = mockShipmentFindOne;

      await expect(
        refundRequestService.submitRefundRequestService(
          { shipmentId, amount: 150.50, reason: 'Incorrect weight charged' },
          { userId: merchantId, role: UserRole.MERCHANT }
        )
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    test('should throw 409 if a pending refund request already exists', async () => {
      const mockShipmentFindOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockShipment),
      });
      mongoose.model('Shipment').findOne = mockShipmentFindOne;

      refundRequestRepository.findPendingByShipmentId.mockResolvedValue(mockRefundRequest);

      await expect(
        refundRequestService.submitRefundRequestService(
          { shipmentId, amount: 150.50, reason: 'Incorrect weight charged' },
          { userId: merchantId, role: UserRole.MERCHANT }
        )
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('listRefundRequestsService', () => {
    test('should list all requests for super admin', async () => {
      refundRequestRepository.findAll.mockResolvedValue({ items: [mockRefundRequest], total: 1 });

      const result = await refundRequestService.listRefundRequestsService(
        { status: 'PENDING' },
        { userId: superAdminId, role: UserRole.SUPER_ADMIN }
      );

      expect(result.items).toEqual([mockRefundRequest]);
      expect(refundRequestRepository.findAll).toHaveBeenCalledWith(
        { status: 'PENDING', deletedAt: null },
        { page: 1, limit: 20 }
      );
    });

    test('should scope listing to own merchantId for merchant caller', async () => {
      refundRequestRepository.findAll.mockResolvedValue({ items: [mockRefundRequest], total: 1 });

      await refundRequestService.listRefundRequestsService(
        {},
        { userId: merchantId, role: UserRole.MERCHANT }
      );

      expect(refundRequestRepository.findAll).toHaveBeenCalledWith(
        { merchantId, deletedAt: null },
        { page: 1, limit: 20 }
      );
    });

    test('should scope listing to distributorId for distributor caller', async () => {
      refundRequestRepository.findAll.mockResolvedValue({ items: [mockRefundRequest], total: 1 });

      await refundRequestService.listRefundRequestsService(
        {},
        { userId: distributorId, role: UserRole.DISTRIBUTOR }
      );

      expect(refundRequestRepository.findAll).toHaveBeenCalledWith(
        { distributorId, deletedAt: null },
        { page: 1, limit: 20 }
      );
    });
  });

  describe('processRefundRequestService', () => {
    test('should approve refund request and credit merchant wallet in transaction', async () => {
      refundRequestRepository.findById.mockResolvedValue(mockRefundRequest);
      financeRepository.findWalletByUserId.mockResolvedValue({ _id: 'mock-wallet' });
      refundService.processRefund.mockResolvedValue({ transaction: { _id: 'mock-tx' } });
      refundRequestRepository.updateStatus.mockResolvedValue({
        ...mockRefundRequest,
        status: RefundRequestStatus.APPROVED,
      });

      const result = await refundRequestService.processRefundRequestService(
        refundRequestId,
        { status: 'APPROVED', reviewNote: 'Approved request' },
        { userId: superAdminId, role: UserRole.SUPER_ADMIN }
      );

      expect(result.status).toEqual(RefundRequestStatus.APPROVED);
      expect(refundService.processRefund).toHaveBeenCalledWith('mock-session', {
        userId: merchantId,
        amount: mockRefundRequest.amount,
        type: 'REFUND_REQUEST',
        reference: `REFUND-REQ-${refundRequestId}`,
        shipmentId,
        note: `Refund approved for AWB AWB-123456: Approved request`,
        performedBy: superAdminId,
      });
      expect(refundRequestRepository.updateStatus).toHaveBeenCalledWith(
        refundRequestId,
        expect.objectContaining({
          status: RefundRequestStatus.APPROVED,
          reviewedBy: superAdminId,
          transactionId: 'mock-tx',
        }),
        'mock-session'
      );
    });

    test('should reject refund request and update status without money transfer', async () => {
      refundRequestRepository.findById.mockResolvedValue(mockRefundRequest);
      refundRequestRepository.updateStatus.mockResolvedValue({
        ...mockRefundRequest,
        status: RefundRequestStatus.REJECTED,
      });

      const result = await refundRequestService.processRefundRequestService(
        refundRequestId,
        { status: 'REJECTED', reviewNote: 'No proof of billing weight mismatch' },
        { userId: superAdminId, role: UserRole.SUPER_ADMIN }
      );

      expect(result.status).toEqual(RefundRequestStatus.REJECTED);
      expect(refundService.processRefund).not.toHaveBeenCalled();
      expect(refundRequestRepository.updateStatus).toHaveBeenCalledWith(
        refundRequestId,
        expect.objectContaining({
          status: RefundRequestStatus.REJECTED,
          reviewedBy: superAdminId,
          reviewNote: 'No proof of billing weight mismatch',
        })
      );
    });

    test('should throw 422 if reviewNote is missing on rejection', async () => {
      await expect(
        refundRequestService.processRefundRequestService(
          refundRequestId,
          { status: 'REJECTED', reviewNote: '' },
          { userId: superAdminId, role: UserRole.SUPER_ADMIN }
        )
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    test('should throw 409 if request is already processed', async () => {
      refundRequestRepository.findById.mockResolvedValue({
        ...mockRefundRequest,
        status: RefundRequestStatus.APPROVED,
      });

      await expect(
        refundRequestService.processRefundRequestService(
          refundRequestId,
          { status: 'APPROVED' },
          { userId: superAdminId, role: UserRole.SUPER_ADMIN }
        )
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});
