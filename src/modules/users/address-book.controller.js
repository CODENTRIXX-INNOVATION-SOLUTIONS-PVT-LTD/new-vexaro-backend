'use strict';

const {
  createAddressService,
  listAddressesService,
  getAddressByIdService,
  updateAddressService,
  deleteAddressService,
} = require('./address-book.service');
const { success, created, paginated } = require('../../utils');
const { wrapController } = require('../../utils/errors');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');

const withErrorHandling = wrapController;

/**
 * @swagger
 * /api/users/address-book:
 *   post:
 *     summary: Create a new address book entry
 *     tags: [Address Book]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - addressLine
 *               - city
 *               - state
 *               - pincode
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: "John Doe"
 *               phone:
 *                 type: string
 *                 pattern: ^[6-9]\d{9}$
 *                 example: "9876543210"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               addressLine:
 *                 type: string
 *                 maxLength: 200
 *                 example: "123 Main Street, Apartment 4B"
 *               city:
 *                 type: string
 *                 maxLength: 50
 *                 example: "Mumbai"
 *               state:
 *                 type: string
 *                 maxLength: 50
 *                 example: "Maharashtra"
 *               pincode:
 *                 type: string
 *                 pattern: ^\d{6}$
 *                 example: "400001"
 *               country:
 *                 type: string
 *                 maxLength: 50
 *                 default: "India"
 *               label:
 *                 type: string
 *                 enum: [Home, Office, Store, Warehouse, Customer, Other]
 *                 default: "Other"
 *     responses:
 *       201:
 *         description: Address created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error
 *       403:
 *         description: Not authorized (non-merchant user)
 */
const createAddress = withErrorHandling(async (req, res) => {
  const dto = req.validated.body;
  const merchantId = req.user.userId;
  
  const address = await createAddressService(dto, merchantId);
  created(res, 'Address created successfully', address);
});

/**
 * @swagger
 * /api/users/address-book:
 *   get:
 *     summary: List all address book entries for the merchant
 *     tags: [Address Book]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: label
 *         schema:
 *           type: string
 *           enum: [Home, Office, Store, Warehouse, Customer, Other]
 *         description: Filter by address label
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Search term for name, phone, email, or city
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     addresses:
 *                       type: array
 *                       items:
 *                         type: object
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       403:
 *         description: Not authorized (non-merchant user)
 */
const listAddresses = withErrorHandling(async (req, res) => {
  const query = req.validated.query;
  const merchantId = req.user.userId;
  
  const { page, limit } = getPaginationParams(query, 20);
  const result = await listAddressesService(query, merchantId);
  
  const meta = buildPaginationMeta(result.pagination.total, page, limit);
  paginated(res, 'Addresses retrieved successfully', { addresses: result.addresses }, meta);
});

/**
 * @swagger
 * /api/users/address-book/{id}:
 *   get:
 *     summary: Get a specific address book entry by ID
 *     tags: [Address Book]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Address book entry ID
 *     responses:
 *       200:
 *         description: Address retrieved successfully
 *       403:
 *         description: Access denied (address belongs to another merchant)
 *       404:
 *         description: Address not found
 */
const getAddressById = withErrorHandling(async (req, res) => {
  const addressId = req.params.id;
  const merchantId = req.user.userId;
  
  const address = await getAddressByIdService(addressId, merchantId);
  success(res, 'Address retrieved successfully', address);
});

/**
 * @swagger
 * /api/users/address-book/{id}:
 *   put:
 *     summary: Update an address book entry
 *     tags: [Address Book]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Address book entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               phone:
 *                 type: string
 *                 pattern: ^[6-9]\d{9}$
 *               email:
 *                 type: string
 *                 format: email
 *               addressLine:
 *                 type: string
 *                 maxLength: 200
 *               city:
 *                 type: string
 *                 maxLength: 50
 *               state:
 *                 type: string
 *                 maxLength: 50
 *               pincode:
 *                 type: string
 *                 pattern: ^\d{6}$
 *               country:
 *                 type: string
 *                 maxLength: 50
 *               label:
 *                 type: string
 *                 enum: [Home, Office, Store, Warehouse, Customer, Other]
 *     responses:
 *       200:
 *         description: Address updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied (address belongs to another merchant)
 *       404:
 *         description: Address not found
 */
const updateAddress = withErrorHandling(async (req, res) => {
  const addressId = req.params.id;
  const dto = req.validated.body;
  const merchantId = req.user.userId;
  
  const address = await updateAddressService(addressId, dto, merchantId);
  success(res, 'Address updated successfully', address);
});

/**
 * @swagger
 * /api/users/address-book/{id}:
 *   delete:
 *     summary: Delete an address book entry (soft delete)
 *     tags: [Address Book]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Address book entry ID
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *       403:
 *         description: Access denied (address belongs to another merchant)
 *       404:
 *         description: Address not found
 */
const deleteAddress = withErrorHandling(async (req, res) => {
  const addressId = req.params.id;
  const merchantId = req.user.userId;
  
  const result = await deleteAddressService(addressId, merchantId);
  success(res, result.message);
});

module.exports = {
  createAddress,
  listAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
};
