'use strict';

const { UserRole, CODStatus, TransactionType } = require('../../../constants');
const { getPaginationParams } = require('../../../utils/pagination');
const { runInTransaction } = require('../../../utils/transaction');
const financeRepository = require('../finance.repository');
const shipmentRepository = require('../../shipments/shipment.repository');
const { applyTransaction } = require('./payment.service');
const { createNotification } = require('../../notifications/notification.service');

const listCODService = async (query, caller) => {
  const filter = {};

  if (caller.role === UserRole.MERCHANT)         filter.merchantId    = caller.userId;
  else if (caller.role === UserRole.DISTRIBUTOR) filter.distributorId = caller.userId;

  if (query.status) filter.status = query.status;
  if (query.merchantId && caller.role === UserRole.SUPER_ADMIN) filter.merchantId = query.merchantId;

  const { limit, skip } = getPaginationParams(query, 20);

  const [cods, total] = await financeRepository.findCodsPaginated(filter, { skip, limit });
  return { items: cods, total };
};

const remitCODService = async (codId, dto, caller) => {
  if (![UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR].includes(caller.role)) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const cod = await financeRepository.findCodById(codId);
  if (!cod) throw Object.assign(new Error('COD record not found'), { statusCode: 404 });
  if (cod.status !== CODStatus.PENDING) {
    throw Object.assign(new Error(`COD is already ${cod.status}`), { statusCode: 400 });
  }
  if (caller.role === UserRole.DISTRIBUTOR && cod.distributorId?.toString() !== caller.userId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  // Fetch shipment to get shipping cost breakdown
  const shipment = await shipmentRepository.findById(cod.shipmentId);
  if (!shipment) throw Object.assign(new Error('Associated shipment not found'), { statusCode: 404 });

  // Calculate revenue distribution
  const shippingCost = shipment.merchantCost || 0;
  const vexaroMargin = shipment.vexaroProfit || 0;
  const distributorMargin = shipment.distributorProfit || 0;
  const netToMerchant = cod.codAmount - shippingCost;

  if (netToMerchant < 0) {
    throw Object.assign(new Error('COD amount is less than shipping cost'), { statusCode: 400 });
  }

  return runInTransaction(async (session) => {
    // Credit merchant with net amount (COD - shipping cost)
    await applyTransaction(session, cod.merchantId.toString(), TransactionType.COD_CREDIT, netToMerchant, {
      shipmentId:  cod.shipmentId,
      performedBy: caller.userId,
      reference:   `COD-${cod._id}`,
      note:        dto.note || `COD amount credited (₹${cod.codAmount.toFixed(2)} - ₹${shippingCost.toFixed(2)} shipping)`,
    });

    // Credit Vexaro margin (admin margin) to super-admin wallet
    if (vexaroMargin > 0) {
      const { User } = require('../../users/user.model');
      const superAdmin = await User.findOne({ role: 'SUPER_ADMIN', isActive: true, deletedAt: null });
      if (superAdmin) {
        await applyTransaction(session, superAdmin._id.toString(), TransactionType.COD_CREDIT, vexaroMargin, {
          shipmentId:  cod.shipmentId,
          performedBy: caller.userId,
          reference:   `COD-MARGIN-${cod._id}`,
          note:        `Admin margin from COD shipment ${shipment.awb}`,
        });
      }
    }

    // Credit Distributor with distributor margin
    if (distributorMargin > 0 && cod.distributorId) {
      await applyTransaction(session, cod.distributorId.toString(), TransactionType.COD_CREDIT, distributorMargin, {
        shipmentId:  cod.shipmentId,
        performedBy: caller.userId,
        reference:   `COD-MARGIN-${cod._id}`,
        note:        `Distributor margin from COD shipment ${shipment.awb}`,
      });
    }

    cod.status     = CODStatus.REMITTED;
    cod.remittedAt = new Date();
    cod.remittedBy = caller.userId;
    cod.note       = dto.note || null;
    await financeRepository.saveCod(cod, { session });

    await shipmentRepository.findByIdAndUpdate(
      cod.shipmentId,
      {
        codStatus: 'REMITTED',
        payoutStatus: 'PAID',
        payoutDate: new Date(),
      },
      { session }
    );

    try {
      await createNotification(cod.merchantId.toString(), {
        title: 'COD Released',
        message: `COD amount of ₹${cod.codAmount.toFixed(2)} has been released to your wallet. Shipping cost ₹${shippingCost.toFixed(2)} deducted.`,
        type: 'PAYMENT',
      });
    } catch (notifErr) {
      console.error('Failed to notify COD release:', notifErr);
    }

    return cod;
  });
};

module.exports = {
  listCODService,
  remitCODService,
};
