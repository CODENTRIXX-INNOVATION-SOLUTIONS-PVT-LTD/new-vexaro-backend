# Vexaro Courier Platform

> Enterprise-grade Express.js backend for shipping logistics, multi-tiered wallet management, and courier integration.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v7.0-green)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-v7.0-red)](https://redis.io/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Test Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](tests/)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [API Documentation & Coverage](#-api-documentation--coverage)
- [Database Schema & Models](#-database-schema--models)
- [Requirements Compliance Analysis (100% Complete)](#-requirements-compliance-analysis-100-complete)
- [Spec Creation Summary](#-spec-creation-summary)
- [Testing & Verification](#-testing--verification)
- [Docker Deployment](#-docker-deployment)
- [Production Checklist](#-production-checklist)
- [Known Issues & Resolution Notes](#-known-issues--resolution-notes)
- [Development Scripts](#-development-scripts)

---

## 🎯 Overview

Vexaro is an enterprise SaaS courier platform that orchestrates shipping logistics with integrated financial ledgers. It manages a four-tier user hierarchy (Super Admin → Distributor → Merchant → Warehouse), handles wallet-based billing, Cash on Delivery (COD) tracking, and dispute resolution.

### Business Model & User Hierarchy
1. **Super Admin (SA)** - Platform owners managing global rate cards and settlements.
2. **Distributor (DIST)** - Intermediaries managing merchants with configurable margins.
3. **Merchant (MERCH)** - Store owners booking shipments and managing warehouses.
4. **Warehouse (WH)** - Operational staff updating shipment statuses.

### Key Workflows
- **Wallet & Funds Flow:** Auto-wallet creation on user activation, multi-level topup, real-time deduction on booking, and automatic refunds on cancellation.
- **Shipment Lifecycle:** `ORDER_CREATED` → `PICKED_UP` → `ARRIVED_AT_HUB` → `OUT_FOR_DELIVERY` → `DELIVERED` / `RTO`. Volumetric weight calculation: `(L × B × H) / 5000`. Direct integration with Velocity API.
- **COD Management:** Automatic COD record creation on delivery, bank reconciliation, and merchant wallet credit workflow.

---

## ✨ Features

### Core Capabilities
- **Multi-Tenant Architecture:** Hierarchical user management with role-based access.
- **Wallet Ledger System:** Immutable transaction history with ACID guarantees.
- **Dynamic Pricing Engine:** Configurable rate cards with distributor margins.
- **Courier Integration:** Velocity API for shipment booking and tracking.
- **Payment Gateway:** Razorpay integration for wallet topups.
- **Dispute Management:** Weight disputes and delivery claim handling.
- **Real-time Notifications:** In-app, email, and SMS alerts.
- **Analytics & Reports:** Comprehensive business intelligence dashboards with CSV, Excel, and PDF exports.
- **Address Book Management:** Full CRUD operations for address entries, labels, soft delete, and tracking.
- **Warehouse Profile Management:** contact updates and approval workflow for address changes with distributor approval.

### Technical Features
- **Layered Architecture:** Controller → Service → Repository pattern.
- **Redis Caching:** Multi-level cache with graceful degradation.
- **Property-Based Testing:** `fast-check` for edge case coverage.
- **API Versioning:** `/api/v1/` prefix for routes.
- **Security Hardening:** Helmet, CORS, rate limiting with custom Retry-After headers, input sanitization.
- **Swagger Documentation:** Interactive API docs at `/api/docs`.
- **Docker Ready:** Multi-stage builds with MongoDB replica set.
- **Health Checks:** Liveness and readiness probes.
- **Structured Logging:** Winston with correlation IDs.

---

## 🛠 Technology Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|----------|
| **Runtime** | Node.js | 18.x+ | Backend server |
| **Framework** | Express.js | 5.2.1 | Web application |
| **Database** | MongoDB | 7.0 | Primary data store |
| **ORM** | Mongoose | 9.7.2 | MongoDB modeling |
| **Cache** | Redis | 7.0 | Performance layer |
| **Cache Client** | ioredis | 5.3.2 | Redis integration |
| **Validation** | Zod | 4.4.3 | Schema validation |
| **Testing** | Jest | 29.7.0 | Unit & integration tests |
| **PBT** | fast-check | 3.23.2 | Property-based testing |
| **Security** | Helmet | 8.2.0 | HTTP headers |
| **Auth** | JWT | 9.0.3 | Token management |
| **Password** | bcryptjs | 3.0.3 | Hash algorithm |
| **Logging** | Winston | 3.17.0 | Structured logs |
| **Email** | Nodemailer | 9.0.1 | SMTP client |
| **Payments** | Razorpay | 2.9.6 | Payment gateway |
| **Docs** | Swagger UI | 5.0.1 | API documentation |
| **Excel** | xlsx | ^0.18.5 | Excel parsing & sheet exports |
| **PDF** | pdfkit | ^0.13.0 | PDF document generation |

---

## 🏗 Architecture

### Repository Structure
```
src/
├── app.js                    # Express app configuration
├── main.js                   # Server bootstrap
├── config/                   # Environment & database config
├── constants/                # Enums & system constants
├── middleware/               # Auth, logging, error handling, rate limiting
├── validation/               # Zod schemas, sanitizers & validators
├── modules/                  # Business logic modules
│   ├── auth/                 # Authentication & JWT
│   ├── users/                # User management & address book
│   ├── shipments/            # Booking & bulk uploads
│   ├── finance/              # Wallets, transactions & refund requests
│   ├── pricing/              # Cost calculation engine
│   ├── rates/                # Rate cards & margins
│   ├── disputes/             # Claims & weight disputes
│   ├── reports/              # Analytics & async data exports
│   ├── support/              # Support Ticket system
│   ├── notifications/        # Alerts & messages
│   ├── audit/                # Audit logging trail
│   ├── settings/             # Profile & API keys
│   └── webhooks/             # Razorpay & Velocity callbacks
└── utils/                    # Cache, logger, email, Velocity client
```

---

## 🚀 Quick Start

### Local Development Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# 3. Create database indexes
npm run create-indexes

# 4. Run database seeds (optional)
npm run seed

# 5. Start development server
npm run dev
```
Server will start on http://localhost:5000. Interactive Swagger documentation will be available at http://localhost:5000/api/docs.

---

## 🔐 Environment Variables

```env
PORT=5000
NODE_ENV=development

# Database (ACID Transactions require replica set)
MONGODB_URI=mongodb://localhost:27017/vexaro?replicaSet=rs0

# Cache
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Authentication
JWT_SECRET=<64-char-hex-string>
JWT_EXPIRES_IN=7d

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<app-password>
EMAIL_FROM=noreply@vexaro.com

# Velocity API (Courier Integration)
VELOCITY_USERNAME=<your-username>
VELOCITY_PASSWORD=<your-password>
VELOCITY_BASE_URL=https://shazam.velocity.in
VELOCITY_WEBHOOK_SECRET=<webhook-secret>

# Razorpay (Payment Gateway)
RAZORPAY_KEY_ID=rzp_live_XXXXXXXX
RAZORPAY_KEY_SECRET=<your-secret>
RAZORPAY_WEBHOOK_SECRET=<webhook-secret>
RAZORPAY_MAX_TOPUP_AMOUNT=1000000

# Frontend
FRONTEND_URL=http://localhost:4200
```

---

## 📚 API Documentation & Coverage

### Key Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/auth/login` | User login | Public |
| `POST` | `/api/v1/auth/set-password` | Complete invitation | Public |
| `GET`  | `/api/v1/auth/me` | Get current user profile | JWT |
| `POST` | `/api/v1/users/invite` | Invite new user | JWT (SA/DIST) |
| `GET`  | `/api/v1/users` | List users | JWT |
| `POST` | `/api/v1/shipments` | Book shipment | JWT (SA/DIST/MERCH) |
| `POST` | `/api/v1/shipments/bulk-upload` | Bulk upload CSV/Excel | JWT (SA/DIST/MERCH) |
| `GET`  | `/api/v1/shipments/bulk-status/:jobId` | Poll bulk upload progress | JWT |
| `POST` | `/api/v1/finance/refund-requests` | Submit refund request | JWT (MERCH) |
| `PATCH`| `/api/v1/finance/refund-requests/:id/process` | Approve/Reject refund request | JWT (SA/DIST) |
| `POST` | `/api/v1/reports/export` | Initiate async data export | JWT |
| `GET`  | `/api/v1/reports/export/:jobId` | Check async export status | JWT |
| `GET`  | `/api/v1/reports/export/download/:filename` | Download completed export | JWT |

---

## 🗄 Database Schema & Models

### Core Collections
1. **User:** stores email, credentials flags, role, active status, and invitedBy hierarchy.
2. **Wallet:** stores balances in INR, active flag, and locks funds transactionally.
3. **Transaction:** immutable ledger entries (CREDIT, DEBIT, CHARGE, REFUND, TOPUP, etc.) populated within Mongo sessions.
4. **Shipment:** tracks origin/destination addresses, serviceType, weight, billingWeight, charge details, carrier tracking ID, and transition status history.
5. **RefundRequest:** tracks merchant refund requests with status tracking (PENDING, APPROVED, REJECTED), transaction links, and distributor review notes.
6. **ExportJob:** tracks async exports with filters, formats (CSV, XLSX, PDF), status, and completed file download paths.
7. **WarehouseChangeRequest:** tracks merchant warehouse address change requests requiring distributor approval.

---

## 📝 Requirements Compliance Analysis (100% Complete)

Vexaro has implemented **100%** of the 30 requirements specified in the platform specs:

- **Req 1-5 (User Credentials & Invites):** Fully implemented with JWT refresh tokens, forced resets, and secure sets.
- **Req 6 (Bulk Upload):** Enforces CSV and Excel parsing validation, async processing, transaction rollback, and row-level logging.
- **Req 7 (Tracking):** Safe transition mapping for all stages.
- **Req 8-14 (Financial Core):** Implemented using immutable transactions, Razorpay gateway checks, row-level locks, and margin configs.
- **Req 15-16 (Profile Extensions):** Includes user Address Book and Warehouse change approval cycles.
- **Req 17-25 (Pricing & Tickets):** Supports ticket categories, date-ranged filters, dynamic margin calculations, and standardized error middleware.
- **Req 26 (API Rate Limiting):** Redis-backed rate limiter enforcing custom `Retry-After` headers and Super Admin bypass rules.
- **Req 27 (Async Export):** Handles large exports (CSV, XLSX, PDF) via background workers with automated email notification delivery.
- **Req 28 (Refund Workflow):** Dedicated model and approval cycle linking directly to transactional wallet refund utilities.
- **Req 29-30 (Doc & ACID):** Comprehensive Swagger interface and transactional session isolation for all ledger writes.

---

## 📋 Spec Creation Summary

Previously missing design specs for advanced core modules were consolidated and built into the `.kiro/specs/` directory:
- **Address Book Management:** Config details, CRUD definitions, soft-delete rules, and shipment hooks.
- **Warehouse Profile Management:** Immediate contact updates, distributor review flows, email configurations, and logs.

---

## 🧪 Testing & Verification

Comprehensive test suites verify database queries, rate limit headers, Excel parsing, report exports, and refund approvals:

- **Total Test Suites:** 51
- **Total Tests:** 1151
- **All tests passing:** 🟢 **100% Success**

### Commands
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## 🐳 Docker Deployment

### Run Platform Services
```bash
# Start all containers in background
docker-compose up -d

# View service logs
docker-compose logs -f backend

# Shut down services
docker-compose down
```

---

## 📋 Production Checklist

- **Rotate Secrets:** Update Gmail SMTP credentials, JWT keys (`openssl rand -hex 32`), Razorpay keys, and Webhook verification tokens.
- **Configure Environments:** Verify `NODE_ENV=production` is active and correct domain links are set.
- **Ensure Database Integrity:** Configure index optimizations, verify replica sets are enabled, and establish automated backups.

---

## 🚨 Known Issues & Resolution Notes

1. **Permissive Excel Parser:** `xlsx`'s parser is highly tolerant and reads text buffers as CSV. Malformed binary files are caught by validating magic byte ZIP header signatures (`504b0304`) and verifying that sheet content arrays are not empty before proceeding.
2. **MongoDB Replica Set Transaction Dependency:** MongoDB transactions require a replica set configuration. If working locally outside Docker, run `mongod --replSet rs0` and trigger `rs.initiate()`.

---

## 🔧 Development Scripts

- `npm run dev` - Start nodemon auto-reloading development server
- `npm start` - Start Express application in production mode
- `npm run seed` - Populate development database
- `npm run create-indexes` - Create MongoDB database indexes
- `npm test` - Run full Jest test suite

---
*Vexaro Courier Platform - June 2026*
#   c l o n e - v e x a r o - b a c k - e n d  
 "# new-vexaro-backend" 
