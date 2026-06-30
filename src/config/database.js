const mongoose = require('mongoose');
const { env } = require('./env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: env.MONGODB_POOL_SIZE,
      minPoolSize: Math.max(2, Math.floor(env.MONGODB_POOL_SIZE / 5)),
      serverSelectionTimeoutMS: 5_000,
      socketTimeoutMS:         45_000,
      heartbeatFrequencyMS:    10_000,
      connectTimeoutMS:        10_000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = { connectDB };

const gracefulShutdown = async (signal) => {
  const logger = require('../utils/logger');
  logger.info('graceful_shutdown_initiated', { signal });

  try {
    await mongoose.connection.close();
    logger.info('mongodb_connection_closed');
  } catch (err) {
    logger.error('mongodb_close_error', { error: err.message });
  }

  try {
    const { disconnect } = require('../utils/cache');
    await disconnect();
    logger.info('redis_connection_closed');
  } catch (err) {
    logger.error('redis_close_error', { error: err.message });
  }

  logger.info('graceful_shutdown_complete', { signal });
  process.exit(0);
};

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
