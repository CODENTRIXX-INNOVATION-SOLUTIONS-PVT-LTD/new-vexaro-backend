'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const { Shipment } = require('../shipment.model');
const { User } = require('../../users/user.model');
const { Warehouse } = require('../../users/warehouse.model');
const { UserRole } = require('../../../constants');

const money = (value) => `INR ${Number(value || 0).toFixed(2)}`;
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const formatAddress = (address) => {
  const value = address || {};
  return [
    value.address || value.addressLine,
    value.city,
    value.state,
    value.country || 'India',
  ].filter(Boolean).join(', ') + (value.pincode ? ` - ${value.pincode}` : '');
};

const findPrivateShipment = async (shipmentId, caller) => {
  if (caller.role !== UserRole.MERCHANT) {
    throw Object.assign(new Error('Customer bills are private to the owning merchant.'), { statusCode: 403 });
  }

  const shipment = await Shipment.findOne({
    _id: shipmentId,
    merchantId: caller.userId,
    deletedAt: null,
  }).select('+merchantMarkup').lean();

  if (!shipment) {
    throw Object.assign(new Error('Shipment not found.'), { statusCode: 404 });
  }
  return shipment;
};

const buildSummary = (shipment) => {
  const productAmount = roundMoney(shipment.subTotal || shipment.declaredValue);
  const shippingCost = roundMoney(shipment.merchantCost);
  const merchantMarkup = roundMoney(shipment.merchantMarkup);
  const deliveryCharge = roundMoney(shippingCost + merchantMarkup);
  const totalPayable = roundMoney(productAmount + deliveryCharge);
  return { productAmount, shippingCost, merchantMarkup, deliveryCharge, totalPayable };
};

const getCustomerBillSummaryService = async (shipmentId, caller) => {
  const shipment = await findPrivateShipment(shipmentId, caller);
  return buildSummary(shipment);
};

const makeBarcode = (text, height = 11) => bwipjs.toBuffer({
  bcid: 'code128', text: String(text), scale: 2, height, includetext: false,
  paddingwidth: 0, paddingheight: 0, backgroundcolor: 'FFFFFF',
});

const getLogoPath = () => {
  const candidates = [
    process.env.VEXARO_LOGO_PATH,
    path.resolve(__dirname, '../../../../../new-vexaro-frontend/src/assets/logo.png'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const generateCustomerBillService = async (shipmentId, caller) => {
  const shipment = await findPrivateShipment(shipmentId, caller);
  const { productAmount, deliveryCharge } = buildSummary(shipment);
  const [merchant, warehouse, awbBarcode, orderBarcode] = await Promise.all([
    User.findById(shipment.merchantId).select('companyName firstName lastName address').lean(),
    Warehouse.findOne({ _id: shipment.warehouseId, merchantId: shipment.merchantId }).lean(),
    makeBarcode(shipment.carrierAWB || shipment.awb, 13),
    makeBarcode(shipment.merchantOrderRef || shipment.awb, 10),
  ]);

  const merchantName = merchant?.companyName
    || `${merchant?.firstName || ''} ${merchant?.lastName || ''}`.trim()
    || 'Merchant';
  const merchantAddress = merchant?.address || formatAddress(warehouse) || formatAddress(shipment.origin);
  const gstNo = warehouse?.gstNo || 'Not provided';
  const customerAddress = formatAddress(shipment.destination);
  const orderReference = shipment.merchantOrderRef || shipment.awb;
  const displayAwb = shipment.carrierAWB || shipment.awb;
  const billDate = new Date(shipment.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  const doc = new PDFDocument({ size: [432, 648], margin: 0, info: { Title: `Customer Bill ${shipment.awb}` } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const completed = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = 18;
  const right = 414;
  const width = right - left;
  const line = (y, x1 = left, x2 = right) => doc.strokeColor('#111111').lineWidth(0.8).moveTo(x1, y).lineTo(x2, y).stroke();
  const box = (x, y, w, h) => doc.strokeColor('#111111').lineWidth(0.8).rect(x, y, w, h).stroke();

  box(left, 16, width, 616);
  const logoPath = getLogoPath();
  if (logoPath) doc.image(logoPath, 25, 23, { fit: [72, 37], align: 'left', valign: 'center' });
  else doc.fillColor('#0b4a6f').font('Helvetica-Bold').fontSize(15).text('VEXARO', 27, 33);
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(18).text('Customer Bill', 145, 29, { width: 145, align: 'center' });
  doc.fontSize(12).text(shipment.carrier || 'Shipping', 315, 33, { width: 90, align: 'right' });
  line(69);

  doc.font('Helvetica-Bold').fontSize(13).text(`AWB# ${displayAwb}`, left, 78, { width, align: 'center' });
  doc.image(awbBarcode, 114, 98, { fit: [204, 43], align: 'center', valign: 'center' });
  doc.font('Helvetica-Bold').fontSize(9).text(shipment.destination?.pincode || '', 26, 143);
  line(158);

  const addressSplit = 286;
  doc.font('Helvetica-Bold').fontSize(12).text(`Ship to: ${shipment.destination?.name || 'Customer'}`, 26, 168, { width: 250 });
  doc.font('Helvetica').fontSize(10).text(customerAddress, 26, 187, { width: 248, height: 43, ellipsis: true });
  doc.font('Helvetica-Bold').text(`PIN - ${shipment.destination?.pincode || ''}`, 26, 231);
  doc.moveTo(addressSplit, 163).lineTo(addressSplit, 250).stroke();
  doc.font('Helvetica').fontSize(10).text(shipment.paymentMethod === 'COD' ? 'COD' : 'Prepaid', 294, 170);
  doc.fontSize(8.5).text(`Invoice Value: ${money(productAmount)}`, 294, 188, { width: 112 });
  line(207, addressSplit, right);
  doc.text('Date', 294, 214);
  doc.text(billDate, 294, 230, { width: 112 });
  line(250);

  const sellerSplit = 265;
  doc.font('Helvetica-Bold').fontSize(10).text(`Seller: ${merchantName}`, 26, 259, { width: 230, height: 24, ellipsis: true });
  doc.font('Helvetica').fontSize(9).text(`GSTIN: ${gstNo}`, 26, 283, { width: 230 });
  doc.text(merchantAddress, 26, 298, { width: 230, height: 38, ellipsis: true });
  doc.moveTo(sellerSplit, 255).lineTo(sellerSplit, 345).stroke();
  doc.image(orderBarcode, 275, 266, { fit: [130, 42], align: 'center', valign: 'center' });
  doc.font('Helvetica-Bold').fontSize(8).text(orderReference, 270, 316, { width: 137, align: 'center' });
  line(345);

  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Product Name', 26, 355, { width: 205 });
  doc.text('Qty.', 250, 355, { width: 34, align: 'center' });
  doc.text('Price', 289, 355, { width: 52, align: 'right' });
  doc.fontSize(7).text('Total (incl. tax)', 344, 356, { width: 62, align: 'right' });
  let itemY = 376;
  doc.font('Helvetica').fontSize(8.5);
  for (const item of shipment.orderItems || []) {
    const itemTotal = roundMoney((item.sellingPrice * item.quantity) + item.tax);
    doc.text(`${item.productName || 'Product'}${item.sku ? ` (${item.sku})` : ''}`, 26, itemY, { width: 205, height: 25, ellipsis: true });
    doc.text(String(item.quantity || 1), 250, itemY, { width: 34, align: 'center' });
    doc.text(money(item.sellingPrice), 289, itemY, { width: 52, align: 'right' });
    doc.text(money(itemTotal), 348, itemY, { width: 58, align: 'right' });
    itemY += 29;
  }

  const totalsY = Math.max(462, itemY + 10);
  line(totalsY);
  const summaryY = totalsY + 12;
  doc.font('Helvetica').fontSize(9).text('Delivery charge', 220, summaryY, { width: 100 });
  doc.text(money(deliveryCharge), 320, summaryY, { width: 86, align: 'right' });

  doc.font('Helvetica-Bold').fontSize(9).text('Merchant Address:', 26, 588);
  doc.font('Helvetica').fontSize(8.5).text(merchantAddress, 120, 588, { width: 281, height: 32, ellipsis: true });
  doc.end();

  return { buffer: await completed, filename: `customer-bill-${shipment.awb}.pdf` };
};

module.exports = { generateCustomerBillService, getCustomerBillSummaryService };
