/**
 * scripts/create-indexes.js
 *
 * Run this script ONCE against your MongoDB to create all critical
 * missing indexes identified in the production architecture review.
 *
 * Usage:
 *   node scripts/create-indexes.js
 *
 * Safe to run multiple times — MongoDB ignores duplicate index creation.
 */

require('../src/config/env');
const mongoose = require('mongoose');
const { env }  = require('../src/config/env');

// ── Pre-load all models so their schemas are registered ──────────────────────
// Models are now in dedicated files — no need to require route files.
require('../src/modules/settings/api-key.model');
require('../src/modules/rates/rate-card.model');
require('../src/modules/rates/margin-config.model');

const run = async () => {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Connected to MongoDB:', mongoose.connection.host);

  const db = mongoose.connection.db;

  const indexes = [
    // ── CRITICAL P0: Every API-key authenticated request does a full scan
    //    without this index. Crashes at 5,000+ API key users.
    {
      collection: 'apikeys',
      index: { keyHash: 1 },
      options: { unique: true, name: 'apikeys_keyHash_unique' },
      reason: 'P0 — auth.middleware.js looks up every API-key request by keyHash',
    },

    // ── CRITICAL P0: Every shipment creation calls RateCard.findOne({ serviceType, isActive }).
    //    Without this index it scans the full rate cards collection on every booking.
    {
      collection: 'ratecards',
      index: { serviceType: 1, isActive: 1 },
      options: { name: 'ratecards_serviceType_isActive' },
      reason: 'P0 — createShipmentService calls this on every single shipment booking',
    },

    // ── CRITICAL P0: applyTransaction checks for duplicate references on EVERY
    //    financial operation (topup, charge, refund, COD, RTO, settlement).
    //    Without this, the transaction ledger full-scans grow infinitely.
    {
      collection: 'transactions',
      index: { reference: 1 },
      options: { sparse: true, name: 'transactions_reference_sparse' },
      reason: 'P0 — idempotency check in applyTransaction on every wallet operation',
    },

    // ── HIGH: Velocity webhooks look up shipments by carrierAWB. Without this
    //    index, every webhook event scans the full shipments collection.
    {
      collection: 'shipments',
      index: { carrierAWB: 1 },
      options: { sparse: true, name: 'shipments_carrierAWB_sparse' },
      reason: 'HIGH — Velocity webhook and AWB tracking lookup by carrier AWB',
    },

    // ── HIGH: MarginConfig is queried on every shipment creation to resolve
    //    distributor margins. This compound index covers the exact query used.
    {
      collection: 'marginconfigs',
      index: { distributorId: 1, rateCardId: 1 },
      options: { unique: true, name: 'marginconfigs_distributorId_rateCardId_unique' },
      reason: 'HIGH — createShipmentService queries this for every shipment with a distributor',
    },

    // ── HIGH: API key listing per user on the settings page.
    {
      collection: 'apikeys',
      index: { userId: 1 },
      options: { name: 'apikeys_userId' },
      reason: 'HIGH — GET /api/settings/api-keys lists by userId',
    },

    // ── MEDIUM: Login query filters by email and deletedAt together.
    //    The existing email unique index helps but this compound is faster.
    {
      collection: 'users',
      index: { email: 1, deletedAt: 1 },
      options: { name: 'users_email_deletedAt' },
      reason: 'MEDIUM — loginService queries { email, deletedAt: null }',
    },

    // ── MEDIUM: Weight dispute expiry job filters OPEN disputes before expiry date.
    {
      collection: 'weightdisputes',
      index: { status: 1, disputeExpiresAt: 1 },
      options: { name: 'weightdisputes_status_disputeExpiresAt' },
      reason: 'MEDIUM — closeExpiredWeightDisputes() filters { status: OPEN, disputeExpiresAt: < now }',
    },
  ];

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const { collection, index, options, reason } of indexes) {
    try {
      await db.collection(collection).createIndex(index, options);
      console.log(`  ✅ [${collection}] ${options.name}`);
      console.log(`     Reason: ${reason}`);
      created++;
    } catch (err) {
      // Code 85 = index already exists with different options
      // Code 86 = index already exists with same options (safe to ignore)
      if (err.code === 85 || err.code === 86 || err.codeName === 'IndexOptionsConflict') {
        console.log(`  ⏭️  [${collection}] ${options.name} — already exists, skipped`);
        skipped++;
      } else {
        console.error(`  ❌ [${collection}] ${options.name} — FAILED:`, err.message);
        failed++;
      }
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`  Indexes created: ${created}`);
  console.log(`  Indexes skipped: ${skipped}`);
  console.log(`  Indexes failed:  ${failed}`);
  console.log('─────────────────────────────────────────\n');

  if (failed > 0) {
    console.error('⚠️  Some indexes failed to create. Review errors above.');
    process.exit(1);
  } else {
    console.log('✅ All critical indexes are in place.');
    process.exit(0);
  }
};

run().catch((err) => {
  console.error('Fatal error during index creation:', err);
  process.exit(1);
});
