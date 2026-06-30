'use strict';

const http = require('http');
process.env.REDIS_ENABLED = 'false';

const routeModules = [
  '../../../modules/auth/auth.routes', '../../../modules/users/user.routes',
  '../../../modules/shipments/shipment.routes', '../../../modules/finance/finance.routes',
  '../../../modules/disputes/dispute.routes', '../../../modules/reports/report.routes',
  '../../../modules/support/support.routes', '../../../modules/notifications/notification.routes',
  '../../../modules/settings/settings.routes', '../../../modules/rates/rate.routes',
];

describe('API validation integration', () => {
  test('every v1 module endpoint has pre-controller validation', () => {
    const uncovered = [];
    for (const modulePath of routeModules) {
      const router = require(modulePath);
      for (const layer of router.stack) {
        if (!layer.route) continue;
        const names = layer.route.stack.map((entry) => entry.handle.name);
        if (!names.includes('requestValidationMiddleware') && !names.includes('securityMiddleware')) {
          uncovered.push(`${modulePath}:${layer.route.path}`);
        }
      }
    }
    expect(uncovered).toEqual([]);
  });

  test('the real app rejects invalid auth input before controller execution', async () => {
    const app = require('../../../app');
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { port } = server.address();
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: '' }),
      });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body).toMatchObject({ success: false, error: 'ValidationError' });
      expect(body.errors.length).toBeGreaterThanOrEqual(2);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('validation overhead remains below 50ms per request', async () => {
    const { validateRequest } = require('../../middleware/validation.middleware');
    const { createShipmentSchema } = require('../../schemas/shipments');
    const payload = { destination: {
      name: 'Alice', phone: '9876543210', addressLine: '12 Example Street', city: 'Delhi', state: 'Delhi', pincode: '110001',
    }, weight: 1, declaredValue: 500, isCOD: false };
    const middleware = validateRequest({ body: createShipmentSchema });
    const start = process.hrtime.bigint();
    for (let index = 0; index < 100; index += 1) {
      await new Promise((resolve, reject) => middleware({ body: payload }, {}, (error) => error ? reject(error) : resolve()));
    }
    const averageMs = Number(process.hrtime.bigint() - start) / 1e6 / 100;
    expect(averageMs).toBeLessThan(50);
  });
});
