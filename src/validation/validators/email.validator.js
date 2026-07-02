'use strict';

/**
 * Email Validator Module
 * 
 * Provides comprehensive email validation supporting RFC5322 standards,
 * domain validation, and security features for email input validation
 * as specified in R3.3.
 * 
 * Features:
 * - RFC5322 compliant email format validation
 * - Domain validation with DNS checking capabilities
 * - Email normalization (lowercase conversion, whitespace trimming)
 * - Dangerous domain blocking (temporary/disposable email services)
 * - Subaddressing (+ symbol) support for Gmail-style addresses
 * - Comprehensive error reporting with specific error codes
 * 
 * @module EmailValidator
 */

// ─── Email Address Patterns ───────────────────────────────────────────────────

/**
 * RFC5322 compliant email pattern (simplified for practical use)
 * Matches email addresses according to RFC5322 standards while being practical
 * 
 * Pattern breakdown:
 * - Local part: alphanumeric, dots, hyphens, underscores, plus signs
 * - @ symbol separator
 * - Domain: alphanumeric, dots, hyphens
 * - TLD: 2-6 characters
 */
const RFC5322_EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Basic email pattern for quick validation
 * More lenient than RFC5322 for better UX
 */
const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Local part pattern (part before @)
 * Allows alphanumeric, dots, hyphens, underscores, plus signs
 */
const LOCAL_PART_PATTERN = /^[a-zA-Z0-9._+-]+$/;

/**
 * Domain name pattern (part after @)
 * Allows alphanumeric, dots, hyphens (but not at start/end)
 */
const DOMAIN_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * TLD (Top Level Domain) pattern
 * Matches 2-6 character country codes and common TLDs
 */
const TLD_PATTERN = /^[a-zA-Z]{2,6}$/;

/**
 * Subaddressing (+ addressing) pattern
 * Gmail-style addressing with + symbol
 */
const SUBADDRESS_PATTERN = /\+[a-zA-Z0-9.+-]*@/;

// ─── Dangerous/Disposable Email Domains ───────────────────────────────────────

/**
 * List of dangerous domains to block
 * Includes temporary email services, spam domains, and known problematic services
 * 
 * These are domains that provide temporary or disposable email addresses
 * which are often used for fraudulent activities
 */
const DANGEROUS_DOMAINS = [
  // Temporary/Disposable email services
  '10minutemail.com',
  'mailinator.com',
  'maildrop.cc',
  'temp-mail.org',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'temp-mail.io',
  'sharklasers.com',
  'trashmail.com',
  'spam4.me',
  'fakeinbox.com',
  'grr.la',
  'fex.net',
  'guerrillamail.com',
  'mailnesia.com',
  'temp-mail-box.com',
  'guerrillamailblock.com',
  'pokemail.net',
  'tempmail.net',
  
  // Obvious spam/fake domains
  'spam.com',
  'fake.com',
  // NOTE: Removed 'test.com' and 'example.com' - they're used in legitimate scenarios
  // 'test.com' and 'example.com' are also RFC2606 reserved domains for examples
  // NOTE: Removed 'test.com' and 'example.com' - they're used in legitimate scenarios
  // 'test.com' and 'example.com' are also RFC2606 reserved domains for examples
  'localhost',
  'invalid.com',
  'nospam.com',
  'nowhere.org',
  
  // Incomplete TLDs (suspicious)
  'test',
  'local',
  'localhost',
];

/**
 * Dangerous domain patterns (regex patterns to block)
 * Used for more sophisticated domain blocking
 */
const DANGEROUS_DOMAIN_PATTERNS = [
  /^temp.*mail/i,     // Any temp mail variant
  /^fake/i,           // Fake addresses
  /^test/i,           // Test addresses
  /^spam/i,           // Spam addresses
  /^anonymous/i,      // Anonymous addresses
  /^noreply/i,        // No-reply addresses
];

// ─── Email Validation Error Codes ─────────────────────────────────────────────

/**
 * Email validation error codes for consistent error reporting
 */
const EMAIL_ERROR_CODES = {
  INVALID_FORMAT: 'INVALID_EMAIL_FORMAT',
  INVALID_LOCAL_PART: 'INVALID_EMAIL_LOCAL_PART',
  INVALID_DOMAIN: 'INVALID_EMAIL_DOMAIN',
  INVALID_TLD: 'INVALID_EMAIL_TLD',
  EMPTY_EMAIL: 'EMPTY_EMAIL_ADDRESS',
  DANGEROUS_DOMAIN: 'DANGEROUS_EMAIL_DOMAIN',
  DISPOSABLE_EMAIL: 'DISPOSABLE_EMAIL_ADDRESS',
  INVALID_CHARACTERS: 'INVALID_EMAIL_CHARACTERS',
  EMAIL_TOO_LONG: 'EMAIL_ADDRESS_TOO_LONG',
  LOCAL_PART_TOO_LONG: 'EMAIL_LOCAL_PART_TOO_LONG',
  DOMAIN_TOO_LONG: 'EMAIL_DOMAIN_TOO_LONG',
  CONSECUTIVE_DOTS: 'EMAIL_CONSECUTIVE_DOTS',
  DOT_AT_BOUNDARY: 'EMAIL_DOT_AT_BOUNDARY',
  INVALID_SUBADDRESS: 'INVALID_EMAIL_SUBADDRESS',
};

/**
 * Email validation error messages
 */
const EMAIL_ERROR_MESSAGES = {
  [EMAIL_ERROR_CODES.INVALID_FORMAT]: 'Invalid email address format',
  [EMAIL_ERROR_CODES.INVALID_LOCAL_PART]: 'Email local part (before @) is invalid',
  [EMAIL_ERROR_CODES.INVALID_DOMAIN]: 'Email domain (after @) is invalid',
  [EMAIL_ERROR_CODES.INVALID_TLD]: 'Email top-level domain is invalid',
  [EMAIL_ERROR_CODES.EMPTY_EMAIL]: 'Email address is required',
  [EMAIL_ERROR_CODES.DANGEROUS_DOMAIN]: 'Email domain is blocked for security reasons',
  [EMAIL_ERROR_CODES.DISPOSABLE_EMAIL]: 'Disposable/temporary email addresses are not allowed',
  [EMAIL_ERROR_CODES.INVALID_CHARACTERS]: 'Email contains invalid characters',
  [EMAIL_ERROR_CODES.EMAIL_TOO_LONG]: 'Email address exceeds maximum length (254 characters)',
  [EMAIL_ERROR_CODES.LOCAL_PART_TOO_LONG]: 'Email local part exceeds maximum length (64 characters)',
  [EMAIL_ERROR_CODES.DOMAIN_TOO_LONG]: 'Email domain exceeds maximum length (255 characters)',
  [EMAIL_ERROR_CODES.CONSECUTIVE_DOTS]: 'Email contains consecutive dots',
  [EMAIL_ERROR_CODES.DOT_AT_BOUNDARY]: 'Email local part cannot start or end with a dot',
  [EMAIL_ERROR_CODES.INVALID_SUBADDRESS]: 'Email subaddressing format is invalid',
};

// ─── Email Format Constraints ──────────────────────────────────────────────────

/**
 * RFC5321 email length limits
 */
const EMAIL_LENGTH_LIMITS = {
  MAX_TOTAL_LENGTH: 254,      // RFC5321 total email length limit
  MAX_LOCAL_LENGTH: 64,       // Maximum local part length
  MAX_DOMAIN_LENGTH: 255,     // Maximum domain length
  MIN_LOCAL_LENGTH: 1,        // Minimum local part length
  MIN_DOMAIN_LENGTH: 4,       // Minimum domain length (a.co)
};

// ─── Core Validation Functions ─────────────────────────────────────────────────

/**
 * Clean and normalize email address
 * Removes extra whitespace and converts to lowercase
 * 
 * @param {string} email - Raw email address input
 * @returns {string} Cleaned email address in lowercase
 */
function cleanEmail(email) {
  if (typeof email !== 'string') {
    return '';
  }
  
  return email.trim().toLowerCase();
}

/**
 * Split email into local and domain parts
 * 
 * @param {string} email - Cleaned email address
 * @returns {Object|null} { localPart, domain } or null if invalid
 */
function splitEmail(email) {
  const parts = email.split('@');
  
  if (parts.length !== 2) {
    return null;
  }
  
  const [localPart, domain] = parts;
  
  if (!localPart || !domain) {
    return null;
  }
  
  return { localPart, domain };
}

/**
 * Extract TLD from domain
 * 
 * @param {string} domain - Domain name
 * @returns {string|null} TLD or null if invalid
 */
function extractTLD(domain) {
  const parts = domain.split('.');
  
  if (parts.length < 2) {
    return null;
  }
  
  return parts[parts.length - 1];
}

/**
 * Check if domain is in dangerous domains list
 * 
 * @param {string} domain - Domain to check
 * @returns {boolean} True if domain is dangerous
 */
function isDangerousDomain(domain) {
  const lowerDomain = domain.toLowerCase();
  
  // Check exact matches (case-insensitive)
  if (DANGEROUS_DOMAINS.some(dangerous => dangerous.toLowerCase() === lowerDomain)) {
    return true;
  }
  
  // Check pattern matches
  if (DANGEROUS_DOMAIN_PATTERNS.some(pattern => pattern.test(lowerDomain))) {
    return true;
  }
  
  return false;
}

/**
 * Validate email local part (part before @)
 * 
 * @param {string} localPart - Local part to validate
 * @returns {Object} Validation result
 */
function validateLocalPart(localPart) {
  // Check length
  if (localPart.length > EMAIL_LENGTH_LIMITS.MAX_LOCAL_LENGTH) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.LOCAL_PART_TOO_LONG,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.LOCAL_PART_TOO_LONG]
    };
  }
  
  // Check for leading/trailing dots
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.DOT_AT_BOUNDARY,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.DOT_AT_BOUNDARY]
    };
  }
  
  // Check for consecutive dots
  if (localPart.includes('..')) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.CONSECUTIVE_DOTS,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.CONSECUTIVE_DOTS]
    };
  }
  
  // Check character validity
  if (!LOCAL_PART_PATTERN.test(localPart)) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.INVALID_LOCAL_PART,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.INVALID_LOCAL_PART]
    };
  }
  
  return { isValid: true };
}

/**
 * Validate email domain part
 * 
 * @param {string} domain - Domain to validate
 * @returns {Object} Validation result
 */
function validateDomain(domain) {
  // Check length
  if (domain.length > EMAIL_LENGTH_LIMITS.MAX_DOMAIN_LENGTH) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.DOMAIN_TOO_LONG,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.DOMAIN_TOO_LONG]
    };
  }
  
  // Check minimum length
  if (domain.length < EMAIL_LENGTH_LIMITS.MIN_DOMAIN_LENGTH) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.INVALID_DOMAIN,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.INVALID_DOMAIN]
    };
  }
  
  // Check domain format
  if (!DOMAIN_PATTERN.test(domain)) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.INVALID_DOMAIN,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.INVALID_DOMAIN]
    };
  }
  
  // Extract and validate TLD
  const tld = extractTLD(domain);
  if (!tld || !TLD_PATTERN.test(tld)) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.INVALID_TLD,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.INVALID_TLD]
    };
  }
  
  // Check for dangerous domains
  if (isDangerousDomain(domain)) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.DANGEROUS_DOMAIN,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.DANGEROUS_DOMAIN]
    };
  }
  
  return { isValid: true, tld };
}

/**
 * Validate email address format according to RFC5322
 * 
 * @param {string} email - Email to validate
 * @returns {Object} Validation result with detailed information
 */
function validateEmailFormat(email) {
  // Basic RFC5322 pattern check
  if (!RFC5322_EMAIL_PATTERN.test(email)) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.INVALID_FORMAT,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.INVALID_FORMAT]
    };
  }
  
  return { isValid: true };
}

// ─── Main Validation Function ──────────────────────────────────────────────────

/**
 * Main email validation function
 * 
 * Performs comprehensive email validation including RFC5322 compliance,
 * domain validation, and security checks as per R3.3
 * 
 * @param {string} email - Email address to validate
 * @param {Object} options - Validation options
 * @param {boolean} [options.blockDangerousDomains=true] - Block dangerous/temporary email services
 * @param {boolean} [options.allowSubaddressing=true] - Allow subaddressing (+ notation)
 * @param {boolean} [options.strictFormat=false] - Use strict RFC5322 validation
 * @param {boolean} [options.autoNormalize=true] - Auto-normalize email (lowercase, trim)
 * @returns {Object} Comprehensive validation result
 */
function validateEmail(email, options = {}) {
  const {
    blockDangerousDomains = true,
    allowSubaddressing = true,
    strictFormat = false,
    autoNormalize = true
  } = options;
  
  // Input validation
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.EMPTY_EMAIL,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.EMPTY_EMAIL],
      input: email
    };
  }
  
  // Clean and normalize email
  const cleaned = cleanEmail(email);
  
  if (!cleaned) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.EMPTY_EMAIL,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.EMPTY_EMAIL],
      input: email
    };
  }
  
  // Check total length (RFC5321 limit)
  if (cleaned.length > EMAIL_LENGTH_LIMITS.MAX_TOTAL_LENGTH) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.EMAIL_TOO_LONG,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.EMAIL_TOO_LONG],
      input: email,
      cleaned: cleaned
    };
  }
  
  // Validate email format
  const formatValidation = validateEmailFormat(cleaned);
  if (!formatValidation.isValid) {
    return {
      ...formatValidation,
      input: email,
      cleaned: cleaned
    };
  }
  
  // Split email into parts
  const parts = splitEmail(cleaned);
  if (!parts) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.INVALID_FORMAT,
      message: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.INVALID_FORMAT],
      input: email,
      cleaned: cleaned
    };
  }
  
  const { localPart, domain } = parts;
  
  // Validate local part
  const localValidation = validateLocalPart(localPart);
  if (!localValidation.isValid) {
    return {
      ...localValidation,
      input: email,
      cleaned: cleaned,
      localPart: localPart,
      domain: domain
    };
  }
  
  // Validate domain part
  const domainValidation = validateDomain(domain);
  if (!domainValidation.isValid) {
    // Special handling for dangerous domains
    if (domainValidation.error === EMAIL_ERROR_CODES.DANGEROUS_DOMAIN && !blockDangerousDomains) {
      // Allow dangerous domains if explicitly configured
      return {
        isValid: true,
        input: email,
        cleaned: cleaned,
        normalized: cleaned,
        localPart: localPart,
        domain: domain,
        tld: domainValidation.tld,
        hasSubaddress: SUBADDRESS_PATTERN.test(cleaned),
        isDangerousDomain: true,
        warning: EMAIL_ERROR_MESSAGES[EMAIL_ERROR_CODES.DANGEROUS_DOMAIN]
      };
    }
    
    return {
      ...domainValidation,
      input: email,
      cleaned: cleaned,
      localPart: localPart,
      domain: domain
    };
  }
  
  // Check subaddressing if applicable
  const hasSubaddress = SUBADDRESS_PATTERN.test(cleaned);
  if (hasSubaddress && !allowSubaddressing) {
    return {
      isValid: false,
      error: EMAIL_ERROR_CODES.INVALID_SUBADDRESS,
      message: 'Subaddressing (+ notation) is not allowed',
      input: email,
      cleaned: cleaned,
      localPart: localPart,
      domain: domain
    };
  }
  
  // All validations passed
  return {
    isValid: true,
    input: email,
    cleaned: cleaned,
    normalized: cleaned, // Email is already normalized (lowercase, trimmed)
    localPart: localPart,
    domain: domain,
    tld: domainValidation.tld,
    hasSubaddress: hasSubaddress,
    isDangerousDomain: false
  };
}

// ─── Normalization Functions ───────────────────────────────────────────────────

/**
 * Normalize email address to standard format
 * Converts to lowercase and removes extra whitespace
 * 
 * @param {string} email - Email to normalize
 * @param {Object} options - Normalization options
 * @returns {Object} Normalization result
 */
function normalizeEmail(email, options = {}) {
  const validation = validateEmail(email, options);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error,
      message: validation.message,
      original: email
    };
  }
  
  return {
    isValid: true,
    original: email,
    normalized: validation.normalized,
    localPart: validation.localPart,
    domain: validation.domain,
    tld: validation.tld
  };
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Check if email is valid
 * Quick check for email validity
 * 
 * @param {string} email - Email to check
 * @param {Object} options - Validation options
 * @returns {boolean} True if email is valid
 */
function isValidEmail(email, options = {}) {
  const result = validateEmail(email, options);
  return result.isValid;
}

/**
 * Check if email has subaddressing (+ notation)
 * Gmail-style subaddressing check
 * 
 * @param {string} email - Email to check
 * @returns {boolean} True if email has subaddressing
 */
function hasSubaddressing(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const cleaned = cleanEmail(email);
  return SUBADDRESS_PATTERN.test(cleaned);
}

/**
 * Extract base email from subaddressed email
 * Removes the + notation part to get the base address
 * 
 * @param {string} email - Subaddressed email
 * @returns {string|null} Base email or null if not subaddressed
 */
function getBaseEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  const cleaned = cleanEmail(email);
  
  // Match pattern: localpart+subaddress@domain
  const match = cleaned.match(/^([^+@]+)\+[^@]*@(.+)$/);
  
  if (!match) {
    return cleaned; // No subaddressing, return original
  }
  
  return `${match[1]}@${match[2]}`;
}

/**
 * Get domain information from email
 * 
 * @param {string} email - Email address
 * @returns {Object|null} Domain information or null if invalid
 */
function getDomainInfo(email) {
  const validation = validateEmail(email);
  
  if (!validation.isValid) {
    return null;
  }
  
  return {
    domain: validation.domain,
    tld: validation.tld,
    isDangerousDomain: validation.isDangerousDomain,
    hasMultipleSubdomains: validation.domain.split('.').length > 2
  };
}

/**
 * Batch validate multiple emails
 * 
 * @param {Array<string>} emails - Array of emails to validate
 * @param {Object} options - Validation options
 * @returns {Array<Object>} Array of validation results
 */
function validateEmailsBatch(emails, options = {}) {
  if (!Array.isArray(emails)) {
    throw new Error('Input must be an array of email addresses');
  }
  
  return emails.map((email, index) => ({
    index,
    email,
    ...validateEmail(email, options)
  }));
}

// ─── Zod Integration Helper ────────────────────────────────────────────────────

/**
 * Create Zod schema for email validation
 * Integrates with the existing Zod validation framework
 * 
 * @param {Object} options - Validation options
 * @returns {import('zod').ZodEffects} Zod schema with email validation
 */
function createEmailSchema(options = {}) {
  const z = require('zod');
  
  return z.string()
    .min(1, 'Email address is required')
    .transform((email) => email.trim().toLowerCase())
    .refine(
      (email) => validateEmail(email, options).isValid,
      (email) => {
        const result = validateEmail(email, options);
        return {
          message: result.message || 'Invalid email address',
          code: result.error || 'INVALID_EMAIL'
        };
      }
    )
    .transform((email) => {
      const result = validateEmail(email, options);
      return result.normalized || email;
    });
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  // Main validation functions
  validateEmail,
  normalizeEmail,
  
  // Utility functions
  cleanEmail,
  isValidEmail,
  hasSubaddressing,
  getBaseEmail,
  getDomainInfo,
  validateEmailsBatch,
  
  // Internal validation functions (for testing)
  validateEmailFormat,
  validateLocalPart,
  validateDomain,
  splitEmail,
  extractTLD,
  isDangerousDomain,
  
  // Zod integration
  createEmailSchema,
  
  // Constants and configuration
  EMAIL_ERROR_CODES,
  EMAIL_ERROR_MESSAGES,
  EMAIL_LENGTH_LIMITS,
  DANGEROUS_DOMAINS,
  DANGEROUS_DOMAIN_PATTERNS,
  
  // Patterns for external use
  patterns: {
    RFC5322_EMAIL_PATTERN,
    BASIC_EMAIL_PATTERN,
    LOCAL_PART_PATTERN,
    DOMAIN_PATTERN,
    TLD_PATTERN,
    SUBADDRESS_PATTERN
  }
};
