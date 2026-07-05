'use strict';

/**
 * Seed a default STANDARD rate card so shipment creation works end-to-end.
 * Safe to run multiple times — skips creation if STANDARD card already exists.
 *
 * Usage:  node scripts/seed-rate-card.js
 */

const mongoose = require('mongoose');
const path     = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { RateCard } = require('../src/modules/rates/rate-card.model');

const STANDARD_CARD = {
  name:        'Standard Rate Card',
  serviceType: 'STANDARD',
  description: 'Default carrier rate card for standard shipments',

  // Weight slabs — covers 0–50 kg in realistic courier tiers
  weightSlabs: [
    { upToKg: 0.5,  baseRate: 40,  ratePerKg: 0   },
    { upToKg: 1,    baseRate: 55,  ratePerKg: 15  },
    { upToKg: 2,    baseRate: 75,  ratePerKg: 20  },
    { upToKg: 3,    baseRate: 95,  ratePerKg: 20  },
    { upToKg: 5,    baseRate: 120, ratePerKg: 18  },
    { upToKg: 10,   baseRate: 175, ratePerKg: 15  },
    { upToKg: 20,   baseRate: 290, ratePerKg: 12  },
    { upToKg: 50,   baseRate: 500, ratePerKg: 10  },
  ],

  codCharge:               25,   // flat ₹25 on every COD shipment
  codPercent:              1,    // + 1% of COD amount
  fuelSurcharge:           2,    // 2% fuel surcharge on base rate
  superAdminMarkupPercent: 25,   // SA earns 25% on top of carrier cost

  isActive: true,
};

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vexaro';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB:', uri.replace(/\/\/.*@/, '//***@'));

  const existing = await RateCard.findOne({ serviceType: 'STANDARD', isActive: true });

  if (existing) {
    console.log('✓ STANDARD rate card already exists — skipping creation.');
    console.log('  ID:', existing._id.toString());
    console.log('  Name:', existing.name);
    console.log('  Slabs:', existing.weightSlabs.length);
  } else {
    const card = await RateCard.create(STANDARD_CARD);
    console.log('✓ STANDARD rate card created successfully.');
    console.log('  ID:', card._id.toString());
    console.log('  Name:', card.name);
    console.log('  Weight slabs:', card.weightSlabs.length);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
