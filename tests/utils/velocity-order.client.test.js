'use strict';

jest.mock('axios', () => ({ post: jest.fn() }));

const axios = require('axios');
const VelocityOrderClient = require('../../src/utils/velocity/order.client');

describe('VelocityOrderClient forward-order tax mapping', () => {
  test('converts Vexaro currency tax into the percentage Velocity expects', async () => {
    axios.post.mockResolvedValue({
      data: { status: 1, payload: { awb_code: 'AWB1', shipment_id: 'SHIP1', order_id: 'ORDER1' } },
    });
    const client = new VelocityOrderClient({
      baseUrl: 'https://velocity.test/',
      getHeaders: jest.fn().mockResolvedValue({ Authorization: 'test' }),
    });
    const shipment = {
      awb: 'VX-1', merchantOrderRef: 'ORDER-1', createdAt: new Date('2026-07-22T00:00:00Z'),
      destination: { name: 'Customer', addressLine: 'Address', city: 'Bhopal', pincode: '462010', state: 'MP', country: 'India', phone: '9876543210' },
      paymentMethod: 'PREPAID', subTotal: 251, totalDiscount: 1,
      orderItems: [{ productName: 'Product', sku: 'SKU-1', quantity: 1, sellingPrice: 250, discount: 1, tax: 2 }],
      length: 10, breadth: 10, height: 10, weight: 0.5,
    };
    const merchant = { email: 'merchant@example.com', companyName: 'Merchant' };
    const warehouse = { velocityWarehouseId: 'WH1', warehouseId: 'WH1', name: 'Main', phone: '9876543210', address: 'Pickup', city: 'Bhopal', state: 'MP', country: 'India', pincode: '462023' };

    await client.createForwardOrder(shipment, merchant, warehouse, 'CARRIER1');

    const payload = axios.post.mock.calls[0][1];
    expect(payload.sub_total).toBe(251);
    expect(payload.order_items[0]).toMatchObject({
      selling_price: 250,
      discount: 1,
      tax: 0.8032,
    });
  });
});
