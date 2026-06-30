# Validation Constants

This directory contains standardized validation constants, patterns, and error codes for the Enterprise Validation Framework. These constants ensure consistency across all validation scenarios and support internationalization.

## Files

### `error-codes.js`
Standardized validation error codes with multi-language support.

**Features:**
- Base error codes for common validation scenarios
- Domain-specific error codes (auth, shipments, finance, etc.)
- Internationalization support (English, Hindi, Gujarati)
- HTTP status code mapping
- Error severity and category classification
- Template variable substitution

**Key Functions:**
- `getErrorMessage(errorCode, language, variables)` - Get localized error message
- `getAvailableLanguages()` - Get supported language codes  
- `createValidationError(errorCode, field, options)` - Create standardized error object

### `limits.js`
Validation limits and constraints for security and performance.

**Features:**
- String length limits for various field types
- Numeric range limits for financial and business data
- File size limits with type-specific configurations
- Time-based limits for sessions and processing
- Business rule limits (wallet limits, shipment constraints)
- Security constraints (password rules, API limits)
- Environment-specific limit overrides

**Key Functions:**
- `getLimit(domain, field)` - Get limit configuration for a field
- `validateLimit(value, limits, type, fieldName)` - Validate value against limits
- `getLimitWithEnvironment(domain, field, environment)` - Get environment-aware limits

### `patterns.js`
Regular expression patterns for validation tasks.

**Features:**
- Basic text and format patterns
- Indian-specific patterns (PIN codes, phone numbers, government IDs)
- Contact information patterns (email, phone, URLs)
- Address validation patterns
- Financial patterns (amounts, transaction IDs)
- Security patterns (passwords, tokens, IP addresses)
- File and media type patterns

**Key Functions:**
- `getPattern(category, name)` - Get specific pattern by category
- `testPattern(value, pattern, fieldName)` - Test value against pattern
- `cleanPhoneNumber(phone, options)` - Clean and validate phone numbers
- `validateEmail(email, options)` - Validate and format email addresses
- `validateIndianPincode(pincode)` - Validate Indian PIN codes

## Usage Examples

### Error Handling
```javascript
const { getErrorMessage, createValidationError } = require('./error-codes');

// Get localized error message
const message = getErrorMessage('AUTH_INVALID_EMAIL', 'hi');

// Create standardized error object
const error = createValidationError(
  'USER_INVALID_PHONE',
  'phone',
  { language: 'en', value: 'invalid-phone' }
);
```

### Limit Validation
```javascript
const { getLimit, validateLimit } = require('./limits');

// Get field limits
const nameLimit = getLimit('STRING', 'NAME');

// Validate value
const result = validateLimit('John', nameLimit, 'length', 'name');
if (!result.isValid) {
  console.log(result.error);
}
```

### Pattern Matching
```javascript
const { cleanPhoneNumber, validateEmail } = require('./patterns');

// Validate phone number
const phoneResult = cleanPhoneNumber('+919876543210');
console.log(phoneResult.normalized); // '+919876543210'

// Validate email
const emailResult = validateEmail('user@example.com');
console.log(emailResult.formatted); // 'user@example.com'
```

## Internationalization

The validation framework supports multiple languages:
- `en` - English (default)
- `hi` - Hindi
- `gu` - Gujarati

Error messages automatically fall back to English if translation is not available.

## Security Considerations

- Sensitive values are automatically redacted in error messages
- Pattern validation prevents injection attacks
- Limits enforce security boundaries (file sizes, string lengths)
- Rate limiting constants prevent DoS attacks

## Integration

These constants are automatically imported and available through the main validation framework:

```javascript
const { constants } = require('../validation');

// Access error codes
const errorCode = constants.errorCodes.REQUIRED;

// Access limits
const nameLimit = constants.getLimit('STRING', 'NAME');

// Access patterns
const emailPattern = constants.contactPatterns.EMAIL_BASIC;
```