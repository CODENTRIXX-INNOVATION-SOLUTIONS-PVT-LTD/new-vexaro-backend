const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const path     = require('path');
const compression = require('compression');
const { env }  = require('./config/env');
const { requestMiddleware } = require('./middleware/request.middleware');
const { sanitizeMiddleware } = require('./validation/middleware/sanitize.middleware');
const { validateRequest } = require('./validation/middleware/validation.middleware');
const { awbParamsSchema } = require('./validation/schemas/shipments');
const {
  generalLimiter,
  authLimiter,
  shipmentLimiter,
  webhookLimiter,
  trackingLimiter,
} = require('./middleware/rate-limit.middleware');

const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const shipmentRoutes = require('./modules/shipments/shipment.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const disputeRoutes = require('./modules/disputes/dispute.routes');
const reportRoutes = require('./modules/reports/report.routes');
const supportRoutes = require('./modules/support/support.routes');
const notifRoutes = require('./modules/notifications/notification.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const platformSettingsRoutes = require('./modules/platform-settings/platform-settings.routes');
const rateRoutes = require('./modules/rates/rate.routes');
const superAdminReportRoutes = require('./modules/super-admin-report/super-admin-report.routes');
const { errorMiddleware } = require('./middleware/error.middleware');
const webhookRoutes = require('./modules/webhooks');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: {
    policy: 'same-origin',
  },
}));

const allowedOrigins = [env.FRONTEND_URL].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS Policy: Origin not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id', 'X-Idempotency-Key'],
  maxAge: 86400, // preflight cache (24 hours)
}));

app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.path.includes('/export/')) return false;
    return compression.filter(req, res);
  },
}));

app.use(requestMiddleware);
app.use('/api/webhooks', webhookLimiter, webhookRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeMiddleware({ maxDepth: 20, maxKeys: 1000 }));
app.use('/api', generalLimiter);
app.use('/api/v1/auth/login',           authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/users/invite',         authLimiter);
app.use('/api/v1/shipments',            shipmentLimiter);

app.get('/health', async (_req, res) => {
  const mongoose = require('mongoose');
  const { getClient } = require('./utils/cache');

  const mongoOk = mongoose.connection.readyState === 1;

  let redisOk = false;
  try {
    const redisClient = getClient();
    if (redisClient) {
      await redisClient.ping();
      redisOk = true;
    } else {
      redisOk = true; // Redis disabled intentionally — not a failure
    }
  } catch {
    redisOk = false;
  }

  const healthy = mongoOk; // Redis is advisory only
  return res.status(healthy ? 200 : 503).json({
    success:   healthy,
    message:   healthy ? 'Vexaro API is healthy' : 'Service degraded — database unavailable',
    checks: {
      mongodb: mongoOk ? 'ok' : 'error',
      redis:   redisOk ? 'ok' : 'error',
    },
    env:       env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

const { setupSwagger } = require('./config/swagger');
setupSwagger(app);
const { idempotency } = require('./middleware/idempotency.middleware');
app.use(idempotency());
const { trackByAWB } = require('./modules/shipments/shipment.controller');
app.get('/api/v1/track/:awb', trackingLimiter, validateRequest({ params: awbParamsSchema }), trackByAWB);
app.use((req, res, next) => {
  if (req.url.startsWith('/api/') && !req.url.startsWith('/api/v1/') && !req.url.startsWith('/api/docs')) {
    req.url = req.url.replace('/api/', '/api/v1/');
  }
  next();
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/shipments', shipmentRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/notifications', notifRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/platform-settings', platformSettingsRoutes);
app.use('/api/v1/rates', rateRoutes);
app.use('/api/v1/super-admin-report', superAdminReportRoutes);
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorMiddleware);

module.exports = app;
