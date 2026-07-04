'use strict';

const mongoose = require('mongoose');

async function fixIndex() {
  await mongoose.connect('mongodb://localhost:27017/vexaro');
  const col = mongoose.connection.db.collection('payments');

  // Show current indexes
  const indexes = await col.indexes();
  console.log('Current indexes on payments collection:');
  indexes.forEach(i => console.log(' ', JSON.stringify(i)));

  // Drop the bad non-sparse unique index
  try {
    await col.dropIndex('razorpayPaymentId_1');
    console.log('\n✓ Dropped razorpayPaymentId_1');
  } catch (e) {
    console.log('\n⚠ Could not drop index:', e.message);
  }

  // Recreate as sparse + unique — null values are excluded from the index
  await col.createIndex(
    { razorpayPaymentId: 1 },
    { unique: true, sparse: true, name: 'razorpayPaymentId_1' }
  );
  console.log('✓ Recreated razorpayPaymentId_1 as { unique: true, sparse: true }');
  console.log('\nNew indexes:');
  (await col.indexes()).forEach(i => console.log(' ', JSON.stringify(i)));

  await mongoose.disconnect();
  process.exit(0);
}

fixIndex().catch(e => { console.error(e); process.exit(1); });
