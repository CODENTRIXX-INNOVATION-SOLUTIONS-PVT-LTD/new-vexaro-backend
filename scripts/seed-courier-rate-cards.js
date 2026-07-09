/**
 * scripts/seed-courier-rate-cards.js
 *
 * Seeds one RateCard per Velocity courier partner configured in the Vexaro
 * platform shipping rules:
 *
 *   Bluedart Standard (STANDARD)      3-7 days
 *   Bluedart Air (EXPRESS)             1-3 days
 *   Ekart Standard (STANDARD)         3-7 days
 *   DTDC Standard (STANDARD)          3-7 days
 *   DTDC Standard 250G (STANDARD)     3-7 days
 *   DTDC Express (EXPRESS)            1-3 days
 *   Delhivery Standard 250G (STANDARD) 3-7 days
 *   Delhivery Standard (STANDARD)     3-7 days
 *   Delhivery Standard 2 Kg (STANDARD) 3-7 days
 *   Delhivery Standard 5 Kg (STANDARD) 3-7 days
 *   Delhivery Standard 10 Kg (STANDARD) 3-7 days
 *   Delhivery Express (EXPRESS)       1-3 days
 *   XpressBees Standard (STANDARD)    3-7 days
 *   XpressBees Standard 2Kg (STANDARD) 3-7 days
 *   XpressBees Standard 5Kg (STANDARD) 3-7 days
 *   XpressBees Standard 10Kg (STANDARD) 3-7 days
 *   Amazon Transportation (STANDARD)  3-7 days
 *   Shadowfax Standard (STANDARD)     3-7 days
 *
 * Fields used by the pricing / booking flow:
 *   weightSlabs          → slab.baseRate + slab.ratePerKg × billingWeight = baseCharge
 *   fuelSurcharge        → baseCharge × (fuelSurcharge / 100)
 *   codCharge            → flat ₹ on every COD shipment
 *   codPercent           → % of codAmount added on COD
 *   superAdminMarkupPercent → % Vexaro adds on top of carrierCost → distributorCost
 *   serviceType          → 'STANDARD' | 'EXPRESS'   (booking lookup key)
 *   name                 → unique display name matching Velocity carrier name
 *
 * Usage:
 *   node scripts/seed-courier-rate-cards.js
 *
 * Safe to run multiple times — existing records (matched by name) are skipped.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose  = require('mongoose');
const { RateCard } = require('../src/modules/rates/rate-card.model');

// ─────────────────────────────────────────────────────────────────────────────
// Weight slab templates
//
// Each courier has realistic base rates sourced from their public tariff tiers.
// Slabs follow the Velocity weight breakpoints so billingWeight → slab lookup
// always finds a match. The last slab acts as the open-ended catch-all.
//
// Formula used at runtime (pricing.service.js):
//   baseCharge  = slab.baseRate + (slab.ratePerKg × billingWeight)
//   fuelCharge  = baseCharge × (fuelSurcharge / 100)
//   codCharge   = codCharge + (codAmount × codPercent / 100)   [COD only]
//   carrierCost = baseCharge + fuelCharge + codCharge
// ─────────────────────────────────────────────────────────────────────────────

/** Standard slabs — 0.25 kg to 10 kg, covers all Velocity weight breakpoints */
const makeStandardSlabs = (base250g, ratePerKg) => [
  { upToKg: 0.25,  baseRate: base250g,                  ratePerKg: 0          },
  { upToKg: 0.5,   baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 1,     baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 2,     baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 5,     baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 10,    baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 20,    baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 50,    baseRate: base250g,                  ratePerKg: ratePerKg  },
];

/** Express slabs — premium rates for 1-3 day delivery */
const makeExpressSlabs = (base250g, ratePerKg) => [
  { upToKg: 0.25,  baseRate: base250g,                  ratePerKg: 0          },
  { upToKg: 0.5,   baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 1,     baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 2,     baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 5,     baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 10,    baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 20,    baseRate: base250g,                  ratePerKg: ratePerKg  },
  { upToKg: 50,    baseRate: base250g,                  ratePerKg: ratePerKg  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Courier rate card definitions
// velocityName must match exactly what Velocity API returns as carrier_name
// so the frontend merge (getVelocityRatesService) can link them correctly.
// ─────────────────────────────────────────────────────────────────────────────

const COURIER_RATE_CARDS = [

  // ── Bluedart ──────────────────────────────────────────────────────────────
  {
    name:                    'Bluedart Standard',
    description:             'Bluedart Surface Standard · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(45, 38),
    codCharge:               40,
    codPercent:              1.5,
    fuelSurcharge:           18,   // Bluedart charges ~18% fuel surcharge
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'Bluedart Air',
    description:             'Bluedart Air Express · 1-3 business days · Call before delivery',
    serviceType:             'EXPRESS',
    weightSlabs:             makeExpressSlabs(75, 65),
    codCharge:               50,
    codPercent:              2,
    fuelSurcharge:           18,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },

  // ── Ekart ─────────────────────────────────────────────────────────────────
  {
    name:                    'Ekart Standard',
    description:             'Ekart Logistics Standard · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(35, 28),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },

  // ── DTDC ──────────────────────────────────────────────────────────────────
  {
    name:                    'DTDC Standard',
    description:             'DTDC Standard · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(38, 30),
    codCharge:               35,
    codPercent:              1.5,
    fuelSurcharge:           8,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'DTDC Standard 250G',
    description:             'DTDC Standard (up to 250 g) · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(28, 30),  // lower base for sub-250g packets
    codCharge:               35,
    codPercent:              1.5,
    fuelSurcharge:           8,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'DTDC Express',
    description:             'DTDC Express Priority · 1-3 business days · Call before delivery',
    serviceType:             'EXPRESS',
    weightSlabs:             makeExpressSlabs(65, 55),
    codCharge:               45,
    codPercent:              2,
    fuelSurcharge:           8,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },

  // ── Delhivery ─────────────────────────────────────────────────────────────
  {
    name:                    'Delhivery Standard 250G',
    description:             'Delhivery Standard (up to 250 g) · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(30, 26),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'Delhivery Standard',
    description:             'Delhivery Surface Standard · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(35, 28),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'Delhivery Standard 2 Kg',
    description:             'Delhivery Standard (up to 2 kg) · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(38, 28),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'Delhivery Standard 5 Kg',
    description:             'Delhivery Standard (up to 5 kg) · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(48, 26),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'Delhivery Standard 10 Kg',
    description:             'Delhivery Standard (up to 10 kg) · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(58, 24),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'Delhivery Express',
    description:             'Delhivery Express · 1-3 business days · Call before delivery',
    serviceType:             'EXPRESS',
    weightSlabs:             makeExpressSlabs(60, 52),
    codCharge:               45,
    codPercent:              2,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },

  // ── XpressBees ────────────────────────────────────────────────────────────
  {
    name:                    'XpressBees Standard',
    description:             'XpressBees Standard · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(33, 27),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'XpressBees Standard 2Kg',
    description:             'XpressBees Standard (up to 2 kg) · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(36, 27),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'XpressBees Standard 5Kg',
    description:             'XpressBees Standard (up to 5 kg) · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(46, 25),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
  {
    name:                    'XpressBees Standard 10Kg',
    description:             'XpressBees Standard (up to 10 kg) · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(56, 23),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },

  // ── Amazon Transportation ─────────────────────────────────────────────────
  {
    name:                    'Amazon Transportation',
    description:             'Amazon Transportation Services · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(32, 26),
    codCharge:               30,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },

  // ── Shadowfax ─────────────────────────────────────────────────────────────
  {
    name:                    'Shadowfax Standard',
    description:             'Shadowfax Standard · 3-7 business days · Call before delivery',
    serviceType:             'STANDARD',
    weightSlabs:             makeStandardSlabs(30, 25),
    codCharge:               25,
    codPercent:              1.5,
    fuelSurcharge:           5,
    superAdminMarkupPercent: 25,
    isActive:                true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertRateCard(data) {
  const existing = await RateCard.findOne({ name: data.name });
  if (existing) {
    console.log(`  ⏭️  Already exists  : "${data.name}" (${data.serviceType})`);
    return existing;
  }
  const card = await RateCard.create(data);
  console.log(`  ✅ Created          : "${data.name}" (${data.serviceType}) — id: ${card._id}`);
  return card;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vexaro';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
  console.log(`\n✅ MongoDB connected: ${uri.replace(/\/\/.*@/, '//***@')}`);
  console.log(`\n── Seeding ${COURIER_RATE_CARDS.length} courier rate cards ──\n`);

  let created = 0;
  let skipped = 0;

  for (const card of COURIER_RATE_CARDS) {
    const existing = await RateCard.findOne({ name: card.name });
    if (existing) {
      console.log(`  ⏭️  Already exists  : "${card.name}"`);
      skipped++;
    } else {
      const doc = await RateCard.create(card);
      console.log(`  ✅ Created          : "${card.name}" · serviceType=${card.serviceType} · id=${doc._id}`);
      created++;
    }
  }

  console.log(`\n─────────────────────────────────────────────────────`);
  console.log(`  Done.  Created: ${created}   Skipped (already existed): ${skipped}`);
  console.log(`  Total courier rate cards in DB now: ${await RateCard.countDocuments({ isActive: true })}`);
  console.log(`─────────────────────────────────────────────────────\n`);
}

run()
  .then(async () => {
    await mongoose.connection.close();
    console.log('✅ MongoDB disconnected cleanly.');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n❌ Seed failed:', err.message);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
  });
