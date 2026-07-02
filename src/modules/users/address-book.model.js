/**
 * @swagger
 * components:
 *   schemas:
 *     AddressBook:
 *       type: object
 *       description: A saved address book entry belonging to a merchant
 *       properties:
 *         _id:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *         id:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *         merchantId:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           example: "John Doe"
 *         phone:
 *           type: string
 *           example: "9876543210"
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           example: "john@example.com"
 *         addressLine:
 *           type: string
 *           example: "123 Main Street, Near City Mall"
 *         city:
 *           type: string
 *           example: "Mumbai"
 *         state:
 *           type: string
 *           example: "Maharashtra"
 *         pincode:
 *           type: string
 *           example: "400001"
 *         country:
 *           type: string
 *           default: "India"
 *           example: "India"
 *         label:
 *           type: string
 *           enum: [Home, Office, Store, Warehouse, Customer, Other]
 *           default: Other
 *           example: "Store"
 *         lastUsedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp of the last time this address was used in a shipment
 *           example: null
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Set when the address is soft-deleted; null means active
 *           example: null
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-20T14:45:00.000Z"
 *     PaginationMeta:
 *       type: object
 *       description: Pagination metadata returned alongside list responses
 *       properties:
 *         total:
 *           type: integer
 *           description: Total number of matching records
 *           example: 42
 *         page:
 *           type: integer
 *           description: Current page number (1-indexed)
 *           example: 2
 *         limit:
 *           type: integer
 *           description: Number of items per page
 *           example: 10
 *         pages:
 *           type: integer
 *           description: Total number of pages
 *           example: 5
 *         hasNextPage:
 *           type: boolean
 *           example: true
 *         hasPrevPage:
 *           type: boolean
 *           example: true
 */

const mongoose = require('mongoose');


const addressLabels = ['Home', 'Office', 'Store', 'Warehouse', 'Customer', 'Other'];

const addressBookSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Merchant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Phone must be 10 digits starting with 6, 7, 8, or 9'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      default: null,
    },
    addressLine: {
      type: String,
      required: [true, 'Address line is required'],
      trim: true,
      maxlength: [200, 'Address line cannot exceed 200 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [50, 'City cannot exceed 50 characters'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [50, 'State cannot exceed 50 characters'],
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
      match: [/^\d{6}$/, 'Pincode must be exactly 6 digits'],
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    label: {
      type: String,
      enum: {
        values: addressLabels,
        message: '{VALUE} is not a valid label',
      },
      default: 'Other',
    },
    lastUsedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Compound indexes for efficient querying
addressBookSchema.index({ merchantId: 1, deletedAt: 1 });
addressBookSchema.index({ merchantId: 1, lastUsedAt: -1, deletedAt: 1 });
addressBookSchema.index({ merchantId: 1, label: 1, deletedAt: 1 });

const AddressBook = mongoose.model('AddressBook', addressBookSchema);

module.exports = { AddressBook };
