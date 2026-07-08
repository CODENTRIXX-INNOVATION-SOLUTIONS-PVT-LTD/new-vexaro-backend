'use strict';

const REQUIRED_CSV_COLS = [
  'origin_name', 'origin_phone', 'origin_address', 'origin_city', 'origin_state', 'origin_pincode',
  'dest_name',   'dest_phone',   'dest_address',   'dest_city',   'dest_state',   'dest_pincode',
  'weight', 'length', 'breadth', 'height',
  'product_name', 'sku', 'selling_price', 'discount', 'tax',
  'declared_value', 'payment_method', 'cod_amount',
];

const REQUIRED_CSV_ONE_OF_COLS = [
  ['units', 'quantity'],
];

const UPDATABLE_FIELDS = [
  'origin', 'destination', 'weight', 'length', 'breadth', 'height',
  'declaredValue', 'isCOD', 'codAmount', 'serviceType',
  'carrier', 'carrierAWB', 'estimatedDelivery',
  'notes', 'merchantOrderRef', 'invoiceNumber', 'warehouseId',
];

module.exports = {
  REQUIRED_CSV_COLS,
  REQUIRED_CSV_ONE_OF_COLS,
  UPDATABLE_FIELDS,
};
