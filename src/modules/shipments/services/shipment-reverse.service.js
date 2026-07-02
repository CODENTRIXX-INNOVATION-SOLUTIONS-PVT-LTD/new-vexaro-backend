'use strict';

const { Shipment } = require('../shipment.model');
const { UserRole, ShipmentStatus } = require('../../../constants');
const { Warehouse } = require('../../users/warehouse.model');
const userRepository = require('../../users/user.repository');
const { velocityClient } = require('../../../utils/velocity');
const { createNotification } = require('../../notifications/notification.service');

const createReverseShipmentService = async (dto, caller) => {
  let merchantId;
  if (caller.role === UserRole.MERCHANT) {
    merchantId = caller.userId;
  } else {
    if (!dto.merchantId) {
      throw Object.assign(new Error('merchantId is required when booking on behalf of a merchant.'), { statusCode: 400 });
    }
    merchantId = dto.merchantId;
  }

  const merchant = await userRepository.findOne({ _id: merchantId, deletedAt: null });
  if (!merchant) {
    throw Object.assign(new Error('Merchant account not found.'), { statusCode: 404 });
  }

  const warehouse = dto.warehouseId
    ? await Warehouse.findById(dto.warehouseId)
    : await Warehouse.findOne({ merchantId, isActive: true });

  if (!warehouse) {
    throw Object.assign(new Error('Active warehouse not found for this merchant.'), { statusCode: 400 });
  }

  if (!warehouse.velocityWarehouseId) {
    throw Object.assign(
      new Error(`Warehouse "${warehouse.warehouseId}" has not been synced to Velocity. Contact your admin.`),
      { statusCode: 422 },
    );
  }

  const qcItems = (dto.orderItems || []).filter(item => item.qc_enable);
  if (qcItems.length > 0) {
    if (dto.orderItems.length > 2) {
      throw Object.assign(
        new Error('QC return shipments cannot have more than 2 items. Remove QC flag or reduce item count.'),
        { statusCode: 400 },
      );
    }
    for (const item of qcItems) {
      if (!item.qc_product_image) {
        throw Object.assign(
          new Error(`QC is enabled for item "${item.name}" but qc_product_image is missing. It is required for QC items.`),
          { statusCode: 400 },
        );
      }
    }
  }

  const orderId = dto.orderId || `RET-VX-${Date.now()}`;
  const velocityResult = await velocityClient.createReverseOrder(
    { ...dto, orderId },
    warehouse.velocityWarehouseId,
    dto.carrierId || '',
  );

  let awb = Shipment.generateAWB();
  const existingAwb = await Shipment.findOne({ awb });
  if (existingAwb) awb = Shipment.generateAWB();

  let distributorId = null;
  if (caller.role === UserRole.DISTRIBUTOR) {
    distributorId = caller.userId;
  } else if (merchant.invitedBy) {
    distributorId = merchant.invitedBy.toString();
  }

  const shipment = await Shipment.create({
    awb,
    merchantId,
    distributorId,
    warehouseId:        warehouse._id.toString(),
    isReturn:           true,
    carrierAWB:         velocityResult.awb,
    carrier:            velocityResult.carrierName,
    velocityShipmentId: velocityResult.shipmentId,
    velocityOrderId:    velocityResult.velocityOrderId,
    velocityReturnId:   velocityResult.returnId || null,
    velocityBooked:     true,
    velocityBookedAt:   new Date(),
    origin: {
      name:        dto.pickupFirstName + ' ' + (dto.pickupLastName || ''),
      phone:       dto.pickupPhone,
      addressLine: dto.pickupAddress,
      city:        dto.pickupCity,
      state:       dto.pickupState,
      pincode:     dto.pickupPincode,
      country:     dto.pickupCountry || 'India',
    },
    destination: {
      name:        warehouse.contactPerson,
      phone:       warehouse.phone || merchant.phone || '9999999999',
      addressLine: warehouse.address,
      city:        warehouse.city,
      state:       warehouse.state,
      pincode:     warehouse.pincode,
      country:     warehouse.country || 'India',
    },
    weight:        dto.weight,
    length:        dto.length,
    breadth:       dto.breadth,
    height:        dto.height,
    declaredValue: dto.subTotal || 0,
    isCOD:         false,
    codAmount:     0,
    codStatus:     'REMITTED',
    payoutStatus:  'PAID',
    merchantCost:  0,
    carrierCost:   0,
    distributorCost: 0,
    status:        ShipmentStatus.ORDER_CREATED,
    statusHistory: [{
      status:    ShipmentStatus.ORDER_CREATED,
      updatedBy: caller.userId,
      note:      'Reverse pickup shipment created',
    }],
    merchantOrderRef: dto.orderId || null,
    notes:            'Return shipment',
  });

  try {
    await createNotification(merchantId, {
      title: 'Return Shipment Created',
      message: `Return pickup ${awb} booked via ${velocityResult.carrierName}. Carrier AWB: ${velocityResult.awb}.`,
      type: 'SHIPMENT',
    });
  } catch (notifErr) {
    console.error('Failed to create reverse shipment notification:', notifErr);
  }

  return shipment;
};

module.exports = {
  createReverseShipmentService,
};
