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

const runInTransaction = async (fn) => {
  const supported = await checkTransactionSupport();
  if (!supported) {
    return fn(undefined);
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = {
  checkTransactionSupport,
  runInTransaction,
};
