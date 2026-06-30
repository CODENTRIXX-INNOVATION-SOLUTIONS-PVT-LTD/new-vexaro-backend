'use strict';

const {
  getWarehousesService,
  getWarehouseByIdService,
  updateContactService,
} = require('./warehouse.service');
const {
  createAddressChangeRequestService,
  listChangeRequestsService,
  approveAddressChangeRequestService,
  rejectAddressChangeRequestService,
  cancelAddressChangeRequestService,
} = require('./warehouse-change-request.service');
const { success, created, paginated } = require('../../utils/response');
const { wrapController } = require('../../utils/errors');
const { UserRole } = require('../../constants');

const withErrorHandling = wrapController;

// ─── 1. GET /api/users/warehouses ──────────────────────────────────────────────
const getWarehouses = withErrorHandling(async (req, res) => {
  const merchantId = req.user.userId;
  const warehouses = await getWarehousesService(merchantId);
  success(res, 'Warehouses retrieved successfully', { warehouses });
});

// ─── 2. GET /api/users/warehouses/:id ─────────────────────────────────────────
const getWarehouseById = withErrorHandling(async (req, res) => {
  const { id } = req.validated.params;
  const merchantId = req.user.userId;
  const warehouse = await getWarehouseByIdService(id, merchantId);
  success(res, 'Warehouse retrieved successfully', warehouse);
});

// ─── 3. PATCH /api/users/warehouses/:id/contact ────────────────────────────────
const updateContact = withErrorHandling(async (req, res) => {
  const { id } = req.validated.params;
  const dto = req.validated.body;
  const merchantId = req.user.userId;
  const updatedWarehouse = await updateContactService(id, dto, merchantId);
  success(res, 'Contact information updated successfully', updatedWarehouse);
});

// ─── 4. POST /api/users/warehouses/:id/address-change-request ───────────────
const createAddressChangeRequest = withErrorHandling(async (req, res) => {
  const { id } = req.validated.params;
  const dto = req.validated.body;
  const merchantId = req.user.userId;
  const request = await createAddressChangeRequestService(id, dto, merchantId);
  created(res, 'Address change request submitted successfully', request);
});

// ─── 5. GET /api/users/warehouses/address-change-requests ────────────────────
const listMerchantRequests = withErrorHandling(async (req, res) => {
  const query = req.validated.query;
  const merchantId = req.user.userId;
  const { requests, pagination } = await listChangeRequestsService(query, merchantId, UserRole.MERCHANT);
  paginated(res, 'Requests retrieved successfully', { requests }, pagination);
});

// ─── 6. GET /api/users/distributor/warehouse-change-requests ─────────────────
const listDistributorRequests = withErrorHandling(async (req, res) => {
  const query = req.validated.query;
  const distributorId = req.user.userId;
  const { requests, pagination } = await listChangeRequestsService(query, distributorId, UserRole.DISTRIBUTOR);
  paginated(res, 'Requests retrieved successfully', { requests }, pagination);
});

// ─── 7. POST /api/users/distributor/warehouse-change-requests/:requestId/approve
const approveRequest = withErrorHandling(async (req, res) => {
  const { requestId } = req.validated.params;
  const distributorId = req.user.userId;
  const request = await approveAddressChangeRequestService(requestId, distributorId);
  success(res, 'Address change request approved successfully', request);
});

// ─── 8. POST /api/users/distributor/warehouse-change-requests/:requestId/reject
const rejectRequest = withErrorHandling(async (req, res) => {
  const { requestId } = req.validated.params;
  const { reason } = req.validated.body;
  const distributorId = req.user.userId;
  const request = await rejectAddressChangeRequestService(requestId, reason, distributorId);
  success(res, 'Address change request rejected', request);
});

// ─── 9. POST /api/users/warehouses/address-change-requests/:requestId/cancel
const cancelRequest = withErrorHandling(async (req, res) => {
  const { requestId } = req.validated.params;
  const merchantId = req.user.userId;
  const request = await cancelAddressChangeRequestService(requestId, merchantId);
  success(res, 'Address change request cancelled', request);
});

module.exports = {
  getWarehouses,
  getWarehouseById,
  updateContact,
  createAddressChangeRequest,
  listMerchantRequests,
  listDistributorRequests,
  approveRequest,
  rejectRequest,
  cancelRequest,
};
