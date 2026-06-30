# Enterprise Validation Framework

This directory contains the centralized validation framework for the Vexaro backend application, providing enterprise-grade validation, sanitization, and input integrity.

## Overview

The validation framework provides:

- **Centralized Schema Management**: All validation schemas organized by domain
- **Flexible Middleware**: Configurable validation middleware for Express routes
- **Framework Configuration**: Customizable validation behavior and error handling
- **CommonJS Compatibility**: Full CommonJS support as required by the project

## Quick Start

```javascript
const validation = require('./src/validation');

// Initialize framework with custom configuration
validation.initializeFramework({
  errorFormat: 'detailed',
  sanitizeInput: true,
  abortEarly: false
});

// Use domain-specific schemas
const { loginSchema } = validation.authSchemas;
const { createShipmentSchema } = validation.shipmentSchemas;

// Create validation middleware
const validateLogin = validation.createValidator(loginSchema, 'body');
const validateCreateShipment = validation.createValidator(createShipmentSchema, 'body');

// Apply to Express routes
app.post('/auth/login', validateLogin, authController.login);
app.post('/shipments', validateCreateShipment, shipmentController.create);
```

## Main Exports

### Schema Collections (`validation.schemas`)

- `auth` - Authentication and authorization schemas
- `shipments` - Shipment management schemas  
- `users` - User management schemas
- `finance` - Financial and wallet schemas
- `disputes` - Dispute resolution schemas
- `support` - Support ticket schemas
- `reports` - Report generation schemas
- `notifications` - Notification schemas
- `rates` - Rate calculation schemas
- `settings` - Application settings schemas
- `common` - Shared utility schemas (mongoIdSchema, etc.)

### Middleware Functions (`validation.middleware`)

- `validate(schema, source)` - Core validation middleware
- `createValidator(schema, source, options)` - Enhanced validator with configuration
- `createMultiValidator(schemas, options)` - Multi-target validation (body, query, params)

### Configuration Functions (`validation.utils`)

- `initializeFramework(config)` - Initialize with custom configuration
- `getFrameworkConfig()` - Get current configuration
- `resetFrameworkConfig()` - Reset to default configuration  
- `formatValidationError(error, requestId)` - Format validation errors

### Constants (`validation.constants`)

- `DEFAULT_CONFIG` - Default framework configuration
- `ERROR_CODES` - Standard validation error codes
- `LIMITS` - Validation limits and constraints

## Directory Structure

```
src/validation/
├── index.js                 # Main framework exports (✅ Implemented)
├── middleware/              # Validation middleware (📋 Planned)
├── schemas/                 # Domain-specific schemas (📋 Planned)
├── validators/              # Custom validation functions (📋 Planned)
├── sanitizers/              # Input sanitization (📋 Planned)
├── constants/               # Validation constants (📋 Planned)
├── helpers/                 # Validation utilities (📋 Planned)
└── tests/                   # Test suite (✅ Implemented)
```

## Framework Configuration

The framework can be configured with the following options:

```javascript
const config = {
  // Error handling
  errorFormat: 'detailed',        // 'detailed' | 'simple'
  includeStackTrace: false,       // Include stack traces in errors
  
  // Performance
  enableCaching: false,           // Enable validation result caching
  cacheTimeout: 300,              // Cache timeout in seconds
  
  // Security  
  maxRequestSize: '10mb',         // Maximum request body size
  sanitizeInput: true,            // Enable input sanitization
  
  // Validation behavior
  abortEarly: false,              // Continue validation after first error
  stripUnknown: false,            // Remove unknown fields
  validationTargets: ['body', 'query', 'params'], // Request parts to validate
};
```

## Error Response Format

### Detailed Format (Default)

```javascript
{
  "success": false,
  "requestId": "req_1640995200000_abc123",
  "timestamp": "2023-12-31T23:59:59.999Z", 
  "message": "Validation failed",
  "error": "ValidationError",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "invalid_string"
    }
  ]
}
```

### Simple Format

```javascript
{
  "success": false,
  "requestId": "req_1640995200000_abc123", 
  "timestamp": "2023-12-31T23:59:59.999Z",
  "message": "Validation failed",
  "error": "ValidationError"
}
```

## Testing

Run the validation framework tests:

```bash
npm test -- src/validation/tests/index.test.js
```

## Future Implementation

The following components are planned for future implementation:

1. **Custom Validators** (`validators/`) - Phone, email, PIN code validation
2. **Input Sanitizers** (`sanitizers/`) - String cleaning, HTML sanitization  
3. **Enhanced Middleware** (`middleware/`) - File upload, sanitization middleware
4. **Schema Definitions** (`schemas/`) - Complete domain-specific schemas
5. **Performance Optimization** - Validation caching and async validation
6. **Security Features** - Enhanced injection prevention and file validation

## Requirements Compliance

This implementation satisfies the following requirements:

- **R1.3**: Centralized validation framework exports ✅
- **R10.2**: Reusable validation components ✅  
- **CommonJS Syntax**: Full CommonJS compatibility ✅
- **Framework Configuration**: Initialization and configuration functions ✅
- **Organized Exports**: Logical export structure for easy consumption ✅

## Integration Examples

### Using with Express Routes

```javascript
const validation = require('./src/validation');
const express = require('express');
const app = express();

// Configure framework
validation.initializeFramework({
  errorFormat: 'detailed',
  sanitizeInput: true
});

// Single field validation
app.post('/auth/login', 
  validation.createValidator(validation.authSchemas.loginSchema, 'body'),
  authController.login
);

// Multi-target validation  
app.get('/shipments',
  ...validation.createMultiValidator({
    query: validation.shipmentSchemas.listShipmentsQuerySchema,
    params: validation.schemas.common.mongoIdSchema
  }),
  shipmentController.list
);
```

### Custom Error Handling

```javascript
const validation = require('./src/validation');

app.use((error, req, res, next) => {
  if (error.statusCode === 400) {
    const formattedError = validation.utils.formatValidationError(error, req.id);
    return res.status(400).json(formattedError);
  }
  next(error);
});
```

This validation framework provides a solid foundation for enterprise-grade input validation while maintaining compatibility with the existing Vexaro codebase.