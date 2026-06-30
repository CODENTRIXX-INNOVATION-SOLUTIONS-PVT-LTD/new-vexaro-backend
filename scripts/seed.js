/**
 * scripts/seed.js
 *
 * Seeds the database with initial data required to run the Vexaro platform:
 *   - One Super Admin user (platform owner)
 *   - One default Distributor user
 *   - Three default RateCards (STANDARD, EXPRESS, SAME_DAY)
 *   - Wallets for any user roles that need them (DISTRIBUTOR)
 *
 * Usage:
 *   node scripts/seed.js
 *
 * Safe to run multiple times — existing records are detected and skipped.
 * Connects via src/config/database.js and disconnects cleanly on finish.
 */

'use strict';

// ── 1. Load env first (must be before any src/ imports) ──────────────────────
require('../src/config/env');

const mongoose            = require('mongoose');
const bcrypt              = require('bcryptjs');
const { env }             = require('../src/config/env');
const { User }            = require('../src/modules/users/user.model');
const { Wallet }          = require('../src/modules/finance/finance.model');
const { RateCard }        = require('../src/modules/rates/rate-card.model');
const { UserRole, ShipmentServiceType } = require('../src/constants');

// ─────────────────────────────────────────────────────────────────────────────
// Seed data definitions
// ─────────────────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

/** Default Super Admin credentials — change immediately after first login. */
const SUPER_ADMIN_SEED = {
  email:     'admin@vexaro.com',
  password:  'Admin@123456',
  firstName: 'Super',
  lastName:  'Admin',
  phone:     '+911234567890',
  companyName: 'Vexaro Platform',
  role:      UserRole.SUPER_ADMIN,
  isActive:  true,
};

/** Default Distributor credentials — change immediately after first login. */
const DISTRIBUTOR_SEED = {
  email:     'distributor@vexaro.com',
  password:  'Distributor@123',
  firstName: 'Default',
  lastName:  'Distributor',
  phone:     '+919876543210',
  companyName: 'Vexaro Logistics Pvt Ltd',
  role:      UserRole.DISTRIBUTOR,
  isActive:  true,
};

/** Default rate cards covering all three service types. */
const RATE_CARDS_SEED = [
  {
    name:        'Standard Shipping',
    description: 'Economy shipping — 3-5 business days',
    serviceType: ShipmentServiceType.STANDARD,
    weightSlabs: [
      { upToKg: 0.5,  ratePerKg: 40,  baseRate: 30  },
      { upToKg: 1,    ratePerKg: 38,  baseRate: 30  },
      { upToKg: 2,    ratePerKg: 35,  baseRate: 25  },
      { upToKg: 5,    ratePerKg: 30,  baseRate: 20  },
      { upToKg: 10,   ratePerKg: 25,  baseRate: 15  },
      { upToKg: 20,   ratePerKg: 20,  baseRate: 10  },
      { upToKg: 50,   ratePerKg: 16,  baseRate: 0   },
    ],
    codCharge:              30,
    codPercent:             1.5,
    fuelSurcharge:          5,
    superAdminMarkupPercent: 25,
    isActive: true,
  },
  {
    name:        'Express Shipping',
    description: 'Priority shipping — 1-2 business days',
    serviceType: ShipmentServiceType.EXPRESS,
    weightSlabs: [
      { upToKg: 0.5,  ratePerKg: 70,  baseRate: 60  },
      { upToKg: 1,    ratePerKg: 65,  baseRate: 55  },
      { upToKg: 2,    ratePerKg: 60,  baseRate: 50  },
      { upToKg: 5,    ratePerKg: 55,  baseRate: 40  },
      { upToKg: 10,   ratePerKg: 45,  baseRate: 30  },
      { upToKg: 20,   ratePerKg: 38,  baseRate: 20  },
      { upToKg: 50,   ratePerKg: 30,  baseRate: 0   },
    ],
    codCharge:              40,
    codPercent:             2,
    fuelSurcharge:          7,
    superAdminMarkupPercent: 25,
    isActive: true,
  },
  {
    name:        'Same Day Delivery',
    description: 'Same-day delivery within city limits',
    serviceType: ShipmentServiceType.SAME_DAY,
    weightSlabs: [
      { upToKg: 0.5,  ratePerKg: 120, baseRate: 100 },
      { upToKg: 1,    ratePerKg: 110, baseRate: 90  },
      { upToKg: 2,    ratePerKg: 100, baseRate: 80  },
      { upToKg: 5,    ratePerKg: 90,  baseRate: 70  },
      { upToKg: 10,   ratePerKg: 75,  baseRate: 50  },
    ],
    codCharge:              60,
    codPercent:             2.5,
    fuelSurcharge:          10,
    superAdminMarkupPercent: 25,
    isActive: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create (or find existing) a user, return the document.
 * If the user already exists, skips creation and returns the existing record.
 */
async function upsertUser(data) {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    console.log(`  ⏭️  User already exists: ${data.email} (${data.role})`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await User.create({
    email:       data.email,
    passwordHash,
    firstName:   data.firstName,
    lastName:    data.lastName,
    phone:       data.phone,
    companyName: data.companyName,
    role:        data.role,
    isActive:    data.isActive,
  });

  console.log(`  ✅ Created user: ${data.email} (${data.role})`);
  return user;
}

/**
 * Create a wallet for a user if one does not already exist.
 */
async function upsertWallet(userId) {
  const existing = await Wallet.findOne({ userId });
  if (existing) {
    console.log(`  ⏭️  Wallet already exists for user ${userId}`);
    return existing;
  }

  const wallet = await Wallet.create({ userId, balance: 0, currency: 'INR', isActive: true });
  console.log(`  ✅ Created wallet for user ${userId}`);
  return wallet;
}

/**
 * Create (or find existing) a RateCard by name.
 */
async function upsertRateCard(data) {
  const existing = await RateCard.findOne({ name: data.name });
  if (existing) {
    console.log(`  ⏭️  Rate card already exists: "${data.name}"`);
    return existing;
  }

  const card = await RateCard.create(data);
  console.log(`  ✅ Created rate card: "${data.name}" (${data.serviceType})`);
  return card;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main seed function
// ─────────────────────────────────────────────────────────────────────────────

const run = async () => {
  // Connect to MongoDB
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize:              10,
    serverSelectionTimeoutMS: 5_000,
  });
  console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);

  // ── Seed Users ───────────────────────────────────────────────────────────
  console.log('\n── Seeding users ──');
  const adminUser       = await upsertUser(SUPER_ADMIN_SEED);
  const distributorUser = await upsertUser(DISTRIBUTOR_SEED);

  // ── Seed Wallets ─────────────────────────────────────────────────────────
  // Super Admin does not need a wallet (they are the platform owner).
  // Distributors and Merchants require wallets to operate.
  console.log('\n── Seeding wallets ──');
  await upsertWallet(distributorUser._id);

  // ── Seed Rate Cards ──────────────────────────────────────────────────────
  console.log('\n── Seeding rate cards ──');
  for (const rateCard of RATE_CARDS_SEED) {
    await upsertRateCard(rateCard);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log('  Seed completed successfully.');
  console.log('');
  console.log('  ⚠️  IMPORTANT: Change default passwords before going to production!');
  console.log(`     Super Admin:  ${SUPER_ADMIN_SEED.email}  /  ${SUPER_ADMIN_SEED.password}`);
  console.log(`     Distributor:  ${DISTRIBUTOR_SEED.email}  /  ${DISTRIBUTOR_SEED.password}`);
  console.log('─────────────────────────────────────────\n');
};

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

run()
  .then(async () => {
    await mongoose.connection.close();
    console.log('✅ MongoDB disconnected cleanly.');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Seed failed:', err);
    try {
      await mongoose.connection.close();
    } catch (_) {
      // best-effort close
    }
    process.exit(1);
  });
