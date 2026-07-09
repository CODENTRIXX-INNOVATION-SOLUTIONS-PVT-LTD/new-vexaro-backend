/**
 * scripts/seed-admin.js
 *
 * Seeds the production Super Admin account for the Vexaro platform.
 *
 * ⚠️  KEEP THIS FILE OUT OF VERSION CONTROL — it is listed in .gitignore.
 *
 * Usage:
 *   node scripts/seed-admin.js
 *
 * Safe to run multiple times — if the email already exists the script skips
 * creation and exits cleanly without modifying the existing record.
 */

'use strict';

// ── Load env before any src/ imports ─────────────────────────────────────────
require('../src/config/env');

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { env }  = require('../src/config/env');
const { User } = require('../src/modules/users/user.model');
const { Wallet } = require('../src/modules/finance/finance.model');
const { UserRole } = require('../src/constants');

// ─────────────────────────────────────────────────────────────────────────────
// Admin account definition
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN = {
  email:       'vishwasgour2002@gmail.com',
  password:    'Vishwasgour2002@gmail.com',
  firstName:   'Vishwas',
  lastName:    'Gour',
  phone:       '7440943831',
  companyName: 'Vexaro Platform',
  role:        UserRole.SUPER_ADMIN,
  isActive:    true,
};

const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const run = async () => {
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize:              10,
    serverSelectionTimeoutMS: 5_000,
  });
  console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);

  // Check for existing account
  const existing = await User.findOne({ email: ADMIN.email });
  if (existing) {
    console.log(`\n⏭️  Super Admin already exists: ${ADMIN.email}`);
    console.log('   No changes made.\n');
    return;
  }

  // Hash password and create user
  const passwordHash = await bcrypt.hash(ADMIN.password, SALT_ROUNDS);
  const user = await User.create({
    email:        ADMIN.email,
    passwordHash,
    firstName:    ADMIN.firstName,
    lastName:     ADMIN.lastName,
    phone:        ADMIN.phone,
    companyName:  ADMIN.companyName,
    role:         ADMIN.role,
    isActive:     ADMIN.isActive,
  });

  console.log(`\n✅ Super Admin created: ${user.email} (id: ${user._id})`);

  // Super Admin does not strictly need a wallet but create one for consistency
  const existingWallet = await Wallet.findOne({ userId: user._id });
  if (!existingWallet) {
    await Wallet.create({ userId: user._id, balance: 0, currency: 'INR', isActive: true });
    console.log('✅ Wallet created for Super Admin');
  }

  console.log('\n─────────────────────────────────────────');
  console.log('  Admin seeded successfully.');
  console.log(`  Email   : ${ADMIN.email}`);
  console.log(`  Password: ${ADMIN.password}`);
  console.log('─────────────────────────────────────────\n');
};

run()
  .then(async () => {
    await mongoose.connection.close();
    console.log('✅ MongoDB disconnected cleanly.');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Seed failed:', err);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
  });
