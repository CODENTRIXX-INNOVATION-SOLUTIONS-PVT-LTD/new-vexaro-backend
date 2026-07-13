'use strict';

const userRepository = require("./user.repository");
const warehouseRepository = require("./warehouse.repository");
const { UserRole } = require("../../constants");
const { generateToken, hashToken, tokenExpiry } = require("../../utils");
const { sendInviteEmail } = require("../../utils/email");
const { env } = require("../../config/env");
const { getPaginationParams } = require("../../utils/pagination");
const { runInTransaction } = require("../../utils/transaction");
const { velocityClient } = require("../../utils/velocity");
const { del, KEYS } = require("../../utils/cache");
const logger = require("../../utils/logger");

// ─── Role Permission Map ───────────────────────────────────────────────────────
const INVITE_PERMISSIONS = {
  [UserRole.SUPER_ADMIN]: [
    UserRole.DISTRIBUTOR,
    UserRole.MERCHANT,
    UserRole.WAREHOUSE,
  ],
  [UserRole.DISTRIBUTOR]: [UserRole.MERCHANT, UserRole.WAREHOUSE],
};

const assertCanManage = (callerRole, targetRole) => {
  const allowed = INVITE_PERMISSIONS[callerRole] ?? [];
  if (!allowed.includes(targetRole)) {
    const err = new Error(
      `Access denied. A ${callerRole} cannot manage ${targetRole} users.`,
    );
    err.statusCode = 403;
    throw err;
  }
};

// ─── Build scoped query filter ─────────────────────────────────────────────────
const getInviteOwnerId = (targetRole, caller) => {
  if (targetRole === UserRole.MERCHANT && caller.role === UserRole.SUPER_ADMIN) {
    return undefined;
  }
  return caller.userId;
};

const buildListFilter = (caller, query) => {
  const filter = { deletedAt: null };

  if (caller.role === UserRole.SUPER_ADMIN) {
    const rolesVisible = [
      UserRole.DISTRIBUTOR,
      UserRole.MERCHANT,
      UserRole.WAREHOUSE,
    ];
    filter.role =
      query.role && rolesVisible.includes(query.role)
        ? query.role
        : { $in: rolesVisible };
  } else if (caller.role === UserRole.DISTRIBUTOR) {
    filter.role =
      query.role && [UserRole.MERCHANT, UserRole.WAREHOUSE].includes(query.role)
        ? query.role
        : { $in: [UserRole.MERCHANT, UserRole.WAREHOUSE] };
    filter.invitedBy = caller.userId;
  } else {
    const err = new Error("Access denied.");
    err.statusCode = 403;
    throw err;
  }

  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { companyName: regex },
    ];
  }

  return filter;
};

// ─── Scoped access check for single-user operations ───────────────────────────
const findUserWithAccess = async (targetId, caller) => {
  const targetUser = await userRepository.findById(targetId, true);

  if (!targetUser || targetUser.deletedAt) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  if (caller.role === UserRole.SUPER_ADMIN) {
    const manageable = [
      UserRole.DISTRIBUTOR,
      UserRole.MERCHANT,
      UserRole.WAREHOUSE,
    ];
    if (!manageable.includes(targetUser.role)) {
      const err = new Error("Access denied.");
      err.statusCode = 403;
      throw err;
    }
  } else if (caller.role === UserRole.DISTRIBUTOR) {
    if (
      ![UserRole.MERCHANT, UserRole.WAREHOUSE].includes(targetUser.role) ||
      !targetUser.invitedBy ||
      targetUser.invitedBy._id.toString() !== caller.userId
    ) {
      const err = new Error("Access denied.");
      err.statusCode = 403;
      throw err;
    }
  } else if (caller.role === UserRole.MERCHANT) {
    if (targetUser._id.toString() !== caller.userId) {
      const err = new Error("Access denied.");
      err.statusCode = 403;
      throw err;
    }
  } else {
    const err = new Error("Access denied.");
    err.statusCode = 403;
    throw err;
  }

  return targetUser;
};

// ─── Task 1: POST /api/users/invite ───────────────────────────────────────────
const syncWarehouseWithVelocityAsync = (warehouse, dto) => {
  setImmediate(async () => {
    try {
      const velocityWHId = await velocityClient.createWarehouse(
        warehouse,
        `${dto.firstName} ${dto.lastName}`,
      );
      await warehouseRepository.findByIdAndUpdate(warehouse._id, {
        velocityWarehouseId: velocityWHId,
        velocitySyncedAt: new Date(),
      });
      console.log(
        `[Velocity] Warehouse synced for merchant ${dto.email}: ${velocityWHId}`,
      );
    } catch (syncErr) {
      console.error(
        `[Velocity] Warehouse sync failed for merchant ${dto.email}:`,
        syncErr.message,
      );
    }
  });
};

const ensureMerchantWarehouse = async (merchantId, dto, session) => {
  const warehouseData = {
    address: dto.warehouse.address,
    pincode: dto.warehouse.pincode,
    city: dto.warehouse.city,
    state: dto.warehouse.state,
    country: dto.warehouse.country || "India",
    contactPerson: dto.warehouse.contactPerson,
    name: dto.warehouse.name || `${dto.firstName} ${dto.lastName}'s Warehouse`,
    phone: dto.phone || "",
    email: dto.email,
    gstNo: dto.warehouse.gstNo || null,
    isActive: true,
  };

  const existingWarehouse = await warehouseRepository.findOne(
    { merchantId },
    session,
  );
  if (existingWarehouse) {
    Object.assign(existingWarehouse, warehouseData);
    await warehouseRepository.save(
      existingWarehouse,
      session ? { session } : {},
    );
    return existingWarehouse;
  }

  const warehouseId = await warehouseRepository.generateWarehouseId(
    dto.warehouse.state,
  );
  const createdWarehouseArr = await warehouseRepository.createInSession(
    {
      warehouseId,
      merchantId,
      ...warehouseData,
    },
    session,
  );
  return createdWarehouseArr[0];
};

const inviteUserService = async (dto, caller) => {
  assertCanManage(caller.role, dto.role);
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const inviteOwnerId = getInviteOwnerId(dto.role, caller);

  const {
    createNotification,
  } = require("../notifications/notification.service");

  let userObj;
  let warehouseToSync = null;
  const existing = await userRepository.findByEmail(dto.email);

  if (existing) {
    if (existing.deletedAt) {
      const err = new Error(
        "A deactivated user with that email already exists.",
      );
      err.statusCode = 409;
      throw err;
    }

    if (existing.role !== dto.role) {
      const err = new Error(
        `A ${existing.role} user with that email already exists.`,
      );
      err.statusCode = 409;
      throw err;
    }

    if (existing.isActive) {
      const err = new Error("An active user with that email already exists.");
      err.statusCode = 409;
      throw err;
    }

    if (
      caller.role === UserRole.DISTRIBUTOR &&
      (!existing.invitedBy || existing.invitedBy.toString() !== caller.userId)
    ) {
      const err = new Error("A user with that email already exists.");
      err.statusCode = 409;
      throw err;
    }

    await runInTransaction(async (session) => {
      existing.firstName = dto.firstName;
      existing.lastName = dto.lastName;
      existing.phone = dto.phone;
      existing.companyName = dto.companyName;
      existing.inviteTokenHash = tokenHash;
      existing.inviteTokenExpiry = tokenExpiry(env.INVITE_TOKEN_EXPIRES_HOURS);
      existing.invitedBy = existing.invitedBy || inviteOwnerId;
      await userRepository.save(existing, session ? { session } : {});

      if (dto.role === UserRole.DISTRIBUTOR || dto.role === UserRole.MERCHANT) {
        const { createWalletService } = require("../finance/finance.service");
        await createWalletService(existing._id, session);
      }

      if (dto.role === UserRole.MERCHANT) {
        warehouseToSync = await ensureMerchantWarehouse(
          existing._id,
          dto,
          session,
        );
      }
    });

    userObj = existing;

    if (warehouseToSync && !warehouseToSync.velocityWarehouseId) {
      syncWarehouseWithVelocityAsync(warehouseToSync, dto);
    }
  } else {
    await runInTransaction(async (session) => {
      const newUser = await userRepository.createInSession(
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          role: dto.role,
          phone: dto.phone,
          companyName: dto.companyName,
          isActive: false,
          inviteTokenHash: tokenHash,
          inviteTokenExpiry: tokenExpiry(env.INVITE_TOKEN_EXPIRES_HOURS),
          invitedBy: inviteOwnerId,
        },
        session,
      );

      userObj = newUser[0];

      // Auto wallet creation for Distributors and Merchants using centralized service
      if (dto.role === UserRole.DISTRIBUTOR || dto.role === UserRole.MERCHANT) {
        const { createWalletService } = require("../finance/finance.service");
        await createWalletService(userObj._id, session);
      }

      // Auto warehouse creation for Merchants
      if (dto.role === UserRole.MERCHANT) {
        warehouseToSync = await ensureMerchantWarehouse(
          userObj._id,
          dto,
          session,
        );
      }
    });

    if (warehouseToSync) {
      syncWarehouseWithVelocityAsync(warehouseToSync, dto);
    }
  }

  const { logAuditEvent } = require("../audit/audit.service");
  logAuditEvent(
    caller.userId,
    "USER_INVITED",
    { email: userObj.email, role: userObj.role },
    userObj._id,
  );

  try {
    await createNotification(userObj._id, {
      senderId: caller.userId,
      title: "Vexaro Account Invite",
      message: `You have been invited as a ${dto.role}.`,
      type: "INVITE",
    });
  } catch (notifErr) {
    console.error("Failed to create invite notification:", notifErr);
  }

  try {
    await sendInviteEmail({
      to: userObj.email,
      firstName: userObj.firstName,
      role: userObj.role,
      inviteToken: rawToken,
      invitedBy: caller.email,
    });
  } catch (emailErr) {
    console.error("Failed to send invite email:", emailErr);
    if (env.NODE_ENV === "development") {
      console.log(
        `Invite URL: ${env.FRONTEND_URL}/set-password?token=${rawToken}&email=${encodeURIComponent(userObj.email)}`,
      );
    }
  }

  return userObj.getPublicProfile();
};

// ─── Task 2: GET /api/users ────────────────────────────────────────────────────
const listUsersService = async (query, caller) => {
  const filter = buildListFilter(caller, query);
  const { page, limit, skip } = getPaginationParams(query, 10);

  const [users, total] = await userRepository.findPaginated(filter, {
    skip,
    limit,
  });

  return {
    items: users.map((u) => u.getPublicProfile()),
    total,
  };
};

// ─── Task 3: GET /api/users/:id ───────────────────────────────────────────────
const getUserByIdService = async (id, caller) => {
  const user = await findUserWithAccess(id, caller);
  const profile = user.getPublicProfile();
  if (user.role === UserRole.MERCHANT) {
    const warehouse = await warehouseRepository.findByMerchantId(user._id);
    if (warehouse) {
      profile.warehouse = warehouse;
    }
  }
  return profile;
};

// ─── Task 4: PATCH /api/users/:id ─────────────────────────────────────────────
const ALLOWED_UPDATE_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "companyName",
  "address",
];

const updateUserService = async (id, dto, caller) => {
  const user = await findUserWithAccess(id, caller);
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (dto[key] !== undefined) user[key] = dto[key];
  }
  await userRepository.save(user);
  await del(KEYS.userProfile(user._id.toString()));
  return user.getPublicProfile();
};

// ─── Task 5: DELETE /api/users/:id ────────────────────────────────────────────
const deactivateUserService = async (id, caller) => {
  if (caller.role === UserRole.MERCHANT) {
    const err = new Error("Access denied.");
    err.statusCode = 403;
    throw err;
  }

  const user = await findUserWithAccess(id, caller);
  if (user._id.toString() === caller.userId) {
    const err = new Error("You cannot deactivate your own account.");
    err.statusCode = 400;
    throw err;
  }

  const deletedAt = new Date();
  user.isActive = false;
  user.deletedAt = deletedAt;

  // Revoke all refresh tokens for this user
  const { RefreshToken } = require("../auth/refresh-token.model");
  let revokedUserIds = [user._id];
  if (user.role === UserRole.DISTRIBUTOR) {
    const merchants = await userRepository.findAll(
      { invitedBy: user._id, role: UserRole.MERCHANT, deletedAt: null },
      '_id',
    );
    const merchantIds = merchants.map((merchant) => merchant._id);
    if (merchantIds.length) {
      await userRepository.updateMany(
        { _id: { $in: merchantIds } },
        { isActive: false, deletedAt },
      );
      revokedUserIds = revokedUserIds.concat(merchantIds);
      await Promise.all(merchantIds.map((merchantId) => del(KEYS.userProfile(merchantId.toString()))));
    }
  }

  await RefreshToken.updateMany(
    { userId: { $in: revokedUserIds }, isRevoked: false },
    { isRevoked: true },
  );
  logger.info("user_deactivated_tokens_revoked", {
    userId: user._id,
    revokedBy: caller.userId,
  });

  await userRepository.save(user);
  await del(KEYS.userProfile(user._id.toString()));

  return { message: "User deleted successfully." };
};

// ─── Resend Invite ───────────────────────────────────────────────────────────
const resendInviteService = async (id, caller) => {
  const user = await findUserWithAccess(id, caller);
  if (user.isActive) {
    throw Object.assign(new Error("User is already active."), {
      statusCode: 400,
    });
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);

  user.inviteTokenHash = tokenHash;
  user.inviteTokenExpiry = tokenExpiry(env.INVITE_TOKEN_EXPIRES_HOURS);
  await userRepository.save(user);

  try {
    await sendInviteEmail({
      to: user.email,
      inviteToken: rawToken,
      firstName: user.firstName,
      role: user.role,
      invitedBy: caller.email || "System",
    });
  } catch (emailErr) {
    console.error("Failed to resend invite email:", emailErr.message);
    if (env.NODE_ENV === "development") {
      console.log(
        `Resend Invite URL: ${env.FRONTEND_URL}/set-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`,
      );
    }
  }

  return { message: "Invite resent successfully." };
};

// ─── Reactivate User ─────────────────────────────────────────────────────────
const reactivateUserService = async (id, caller) => {
  const user = await findUserWithAccess(id, caller);

  if (user.isActive && user.deletedAt === null) {
    throw Object.assign(new Error("User is already active and not deleted."), {
      statusCode: 400,
    });
  }

  user.isActive = true;
  user.deletedAt = null;
  await userRepository.save(user);
  await del(KEYS.userProfile(user._id.toString()));

  const {
    createNotification,
  } = require("../notifications/notification.service");
  try {
    await createNotification(user._id, {
      title: "Account Reactivated",
      message: "Your Vexaro account has been reactivated.",
      type: "SYSTEM",
    });
  } catch (err) {
    console.error("Failed to create reactivation notification:", err.message);
  }

  return user.getPublicProfile();
};

// ─── Warehouse Management ────────────────────────────────────────────────────
const getWarehouseService = async (merchantId, caller) => {
  const user = await findUserWithAccess(merchantId, caller);
  if (user.role !== UserRole.MERCHANT) {
    throw Object.assign(new Error("Target user is not a merchant."), {
      statusCode: 400,
    });
  }

  const warehouse = await warehouseRepository.findByMerchantId(merchantId);
  if (!warehouse) {
    throw Object.assign(
      new Error("Warehouse details not found for this merchant."),
      { statusCode: 404 },
    );
  }

  return warehouse;
};

const updateWarehouseService = async (merchantId, dto, caller) => {
  const user = await findUserWithAccess(merchantId, caller);
  if (user.role !== UserRole.MERCHANT) {
    throw Object.assign(new Error("Target user is not a merchant."), {
      statusCode: 400,
    });
  }

  const warehouse = await warehouseRepository.findByMerchantId(merchantId);
  if (!warehouse) {
    throw Object.assign(
      new Error("Warehouse details not found for this merchant."),
      { statusCode: 404 },
    );
  }

  const fields = [
    "address",
    "pincode",
    "city",
    "state",
    "contactPerson",
    "isActive",
  ];
  for (const field of fields) {
    if (dto[field] !== undefined) {
      warehouse[field] = dto[field];
    }
  }

  await warehouseRepository.save(warehouse);
  return warehouse;
};

// ─── Velocity Warehouse Re-sync ───────────────────────────────────────────────
const syncWarehouseToVelocityService = async (merchantId, caller) => {
  if (caller.role !== UserRole.SUPER_ADMIN) {
    throw Object.assign(
      new Error("Only Super Admin can trigger warehouse sync."),
      { statusCode: 403 },
    );
  }

  const warehouse = await warehouseRepository.findOne({
    merchantId,
    isActive: true,
  });
  if (!warehouse) {
    throw Object.assign(
      new Error("Active warehouse not found for this merchant."),
      { statusCode: 404 },
    );
  }

  const merchant = await userRepository.findOne({
    _id: merchantId,
    deletedAt: null,
  });
  if (!merchant) {
    throw Object.assign(new Error("Merchant not found."), { statusCode: 404 });
  }

  const velocityWHId = await velocityClient.createWarehouse(
    warehouse,
    `${merchant.firstName} ${merchant.lastName}`,
  );

  warehouse.velocityWarehouseId = velocityWHId;
  warehouse.velocitySyncedAt = new Date();
  await warehouseRepository.save(warehouse);

  return {
    warehouseId: warehouse.warehouseId,
    velocityWarehouseId: velocityWHId,
  };
};

module.exports = {
  inviteUserService,
  listUsersService,
  getUserByIdService,
  updateUserService,
  deactivateUserService,
  resendInviteService,
  reactivateUserService,
  getWarehouseService,
  updateWarehouseService,
  syncWarehouseToVelocityService,
};
