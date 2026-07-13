'use strict';

const { UserRole, SystemConfig } = require('../../constants');
const financeRepository = require('./finance.repository');

const formatInr = (amount) => `INR ${Number(amount || 0).toLocaleString('en-IN')}`;

const isTrainingWalletRole = (role) =>
  role === UserRole.MERCHANT || role === UserRole.DISTRIBUTOR;

const getWalletBalance = (wallet) => Number(wallet?.balance || 0);

const getWalletTopupPolicy = async (wallet, role, session = null) => {
  if (!isTrainingWalletRole(role)) {
    return {
      phase: 'standard',
      completedTopups: 0,
      reserveEstablished: false,
      reserveAmount: 0,
      minAmount: 1,
      maxAmount: null,
      message: null,
    };
  }

  const balance = getWalletBalance(wallet);
  const completedTopups = wallet?._id
    ? await financeRepository.countCompletedRecharges(wallet._id, session)
    : 0;
  const reserveEstablished =
    completedTopups >= 2 ||
    (completedTopups >= 1 && balance >= SystemConfig.WALLET_RESERVE_START_BALANCE);

  if (completedTopups === 0 && !reserveEstablished) {
    return {
      phase: 'training_first_topup',
      completedTopups,
      reserveEstablished: false,
      reserveAmount: 0,
      minAmount: SystemConfig.WALLET_TRAINING_TOPUP_MIN,
      maxAmount: SystemConfig.WALLET_TRAINING_TOPUP_MAX,
      message: `First training top-up can be any amount from ${formatInr(SystemConfig.WALLET_TRAINING_TOPUP_MIN)} to ${formatInr(SystemConfig.WALLET_TRAINING_TOPUP_MAX)}.`,
    };
  }

  if (!reserveEstablished) {
    const minAmount = Math.max(1, SystemConfig.WALLET_RESERVE_START_BALANCE - balance);
    return {
      phase: 'reserve_completion_topup',
      completedTopups,
      reserveEstablished: false,
      reserveAmount: 0,
      minAmount,
      maxAmount: null,
      message: `Please top up at least ${formatInr(minAmount)} so your wallet balance becomes ${formatInr(SystemConfig.WALLET_RESERVE_START_BALANCE)} and the ${formatInr(SystemConfig.WALLET_RESERVE_AMOUNT)} reserve can be maintained.`,
    };
  }

  return {
    phase: 'standard',
    completedTopups,
    reserveEstablished: true,
    reserveAmount: SystemConfig.WALLET_RESERVE_AMOUNT,
    minAmount: 1,
    maxAmount: null,
    message: `${formatInr(SystemConfig.WALLET_RESERVE_AMOUNT)} is maintained as a mandatory wallet reserve.`,
  };
};

const validateTopupAmountForPolicy = async ({ wallet, role, amount, session = null }) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw Object.assign(new Error('Top-up amount must be greater than zero.'), { statusCode: 400 });
  }

  const policy = await getWalletTopupPolicy(wallet, role, session);

  if (policy.phase === 'training_first_topup') {
    if (numericAmount < policy.minAmount || numericAmount > policy.maxAmount) {
      throw Object.assign(
        new Error(`First training top-up must be between ${formatInr(policy.minAmount)} and ${formatInr(policy.maxAmount)}.`),
        { statusCode: 400 },
      );
    }
  } else if (policy.phase === 'reserve_completion_topup' && numericAmount < policy.minAmount) {
    throw Object.assign(new Error(policy.message), { statusCode: 400 });
  }

  return policy;
};

const decorateWalletForRole = async (wallet, role, session = null) => {
  const plainWallet = wallet?.toObject ? wallet.toObject() : { ...(wallet || {}) };
  const policy = await getWalletTopupPolicy(wallet, role, session);
  const reserve = policy.reserveEstablished ? SystemConfig.WALLET_RESERVE_AMOUNT : 0;

  plainWallet.reservedBalance = reserve;
  plainWallet.availableBalance = Math.max(0, Number(plainWallet.balance || 0) - reserve);
  plainWallet.topupPolicy = {
    phase: policy.phase,
    completedTopups: policy.completedTopups,
    reserveEstablished: policy.reserveEstablished,
    reserveAmount: reserve,
    minAmount: policy.minAmount,
    maxAmount: policy.maxAmount,
    message: policy.message,
  };

  return plainWallet;
};

module.exports = {
  getWalletTopupPolicy,
  validateTopupAmountForPolicy,
  decorateWalletForRole,
  isTrainingWalletRole,
};
