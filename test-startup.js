console.log('Step 1: Loading env...');
require('./src/config/env');
console.log('Step 2: Env loaded successfully');

const { env } = require('./src/config/env');
console.log('Step 3: Got env object');

console.log('Step 4: Connecting to MongoDB...');
const { connectDB } = require('./src/config/database');

(async () => {
  try {
    await connectDB();
    console.log('Step 5: MongoDB connected successfully');
    
    console.log('Step 6: Checking transaction support...');
    const { checkTransactionSupport } = require('./src/utils/transaction');
    const txSupported = await checkTransactionSupport();
    console.log('Step 7: Transaction support:', txSupported);
    
    console.log('Step 8: Connecting to Redis...');
    const { connect: connectRedis } = require('./src/utils/cache');
    await connectRedis();
    console.log('Step 9: Redis connection attempted');
    
    console.log('Step 10: Loading app...');
    const app = require('./src/app');
    console.log('Step 11: App loaded successfully');
    
    console.log('\n✅ All startup steps completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error at startup:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
