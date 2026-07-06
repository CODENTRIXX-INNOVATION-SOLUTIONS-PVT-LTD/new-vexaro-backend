const mongoose = require('mongoose');

let isTransactionsSupported = null;

const checkTransactionSupport = async () => {
  if (isTransactionsSupported !== null) return isTransactionsSupported;
  if (mongoose.connection.readyState !== 1) {
    return false; // Connection not ready yet
  }
  try {
    const client = mongoose.connection.client;
    const topologyType = client?.topology?.description?.type;
    if (topologyType === 'Single') {
      isTransactionsSupported = false;
      console.warn("MongoDB is running as a Standalone server. Transactions are disabled, falling back to non-transactional execution.");
    } else {
      isTransactionsSupported = true;
    }
  } catch (err) {
    isTransactionsSupported = false;
  }
  return isTransactionsSupported;
};

// ─── Retry helper ────────────────────────────────────────────────────────────
// MongoDB requires that the *application* retries transactions that fail with
// a TransientTransactionError label (e.g. WriteConflict under snapshot isolation).
// The driver does NOT retry automatically.
// See: https://www.mongodb.com/docs/manual/core/transactions-in-applications/
const MAX_RETRIES = 3;

const isTransient = (err) => {
  // err.errorLabels is set by the MongoDB driver for TransientTransactionError
  return Array.isArray(err.errorLabels) && err.errorLabels.includes('TransientTransactionError');
};

const runInTransaction = async (fn) => {
  const supported = await checkTransactionSupport();
  if (!supported) {
    // No replica-set: execute without a session (non-transactional fallback).
    // WARNING: if fn contains multiple write operations, they are NOT atomic.
    return fn(undefined);
  }

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      if (isTransient(err) && attempt < MAX_RETRIES - 1) {
        attempt++;
        // Brief exponential backoff before retrying (50ms, 100ms)
        await new Promise((r) => setTimeout(r, 50 * attempt));
        continue;
      }
      throw err;
    } finally {
      session.endSession();
    }
  }
};

module.exports = {
  checkTransactionSupport,
  runInTransaction,
};
