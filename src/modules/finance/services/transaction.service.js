'use strict';

const { UserRole } = require('../../../constants');
const { getPaginationParams } = require('../../../utils/pagination');
const financeRepository = require('../finance.repository');
const userRepository = require('../../users/user.repository');

const listTransactionsService = async (query, caller) => {
  let userId = caller.userId;
  let scopedUserIds = null;

  if (query.userId && caller.role === UserRole.SUPER_ADMIN) {
    userId = query.userId;
  } else if (!query.userId && query.scope === 'MERCHANT' && caller.role === UserRole.SUPER_ADMIN) {
    const merchants = await userRepository.findAll({ role: UserRole.MERCHANT, deletedAt: null });
    scopedUserIds = merchants.map(user => user._id);
  } else if (query.userId && caller.role === UserRole.DISTRIBUTOR) {
    const user = await userRepository.findOne({ _id: query.userId, invitedBy: caller.userId, deletedAt: null });
    if (!user) throw Object.assign(new Error('User not found or not in your scope'), { statusCode: 403 });
    userId = query.userId;
  }

  const { limit, skip } = getPaginationParams(query, 20);

  const filter = scopedUserIds ? { userId: { $in: scopedUserIds } } : { userId };
  if (query.type) filter.type = query.type;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo)   filter.createdAt.$lte = new Date(query.dateTo);
  }

  const [transactions, total] = await financeRepository.findTransactionsPaginated(filter, { skip, limit });
  return { items: transactions, total };
};

module.exports = {
  listTransactionsService,
};
