'use strict';

const REQUIRED_CSV_COLS = [
  'origin_name', 'origin_phone', 'origin_address', 'origin_city', 'origin_state', 'origin_pincode',
  'dest_name',   'dest_phone',   'dest_address',   'dest_city',   'dest_state',   'dest_pincode',
  'weight',
];

const UPDATABLE_FIELDS = [
  'origin', 'destination', 'weight', 'length', 'breadth', 'height',
  'declaredValue', 'isCOD', 'codAmount', 'serviceType',
  'carrier', 'carrierAWB', 'estimatedDelivery',
  'notes', 'merchantOrderRef', 'invoiceNumber', 'warehouseId',
];

module.exports = {
  REQUIRED_CSV_COLS,
  UPDATABLE_FIELDS,
};
