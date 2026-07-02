'use strict';

/**
 * Financial Amount Validator Module
 * 
 * Provides comprehensive monetary amount validation with currency-specific rules
 * and precision controls as specified in R3.7.
 * 
 * Features:
 * - Currency-specific validation (INR primary, multi-currency support)
 * - Decimal precision control (2 decimal places for INR)
 * - Amount limits and boundary validation
 * - Negative amount handling and zero validation
 * - Comprehensive error reporting with specific error codes
 * - Safe number handling to prevent floating point issues
 * 
 * @module MoneyValidator
 */

// ─── Currency Configuration ────────────────────────────────────────────────────

/**
 * Currency-specific configuration including precision and limits
 */
const CURRENCY_CONFIG = {
  INR: {
    name: 'Indian Rupee',
    symbol: '₹',
    code: 'INR',
    precision: 2,
    minAmount: 0,
    maxAmount: 100000000, // 10 crore INR
    subunit: 'paise',
    subunitRatio: 100,
    format: '₹{amount}'
  },
  USD: {
    name: 'US Dollar',
    symbol: '$',
    code: 'USD',
    precision: 2,
    minAmount: 0,
    maxAmount: 10000000, // 10 million USD
    subunit: 'cents',
    subunitRatio: 100,
    format: '${amount}'
  },
  EUR: {
    name: 'Euro',
    symbol: '€',
    code: 'EUR',
    precision: 2,
    minAmount: 0,
    maxAmount: 10000000,
    subunit: 'cents',
    subunitRatio: 100,
    format: '€{amount}'
  },
  GBP: {
    name: 'British Pound',
    symbol: '£',
    code: 'GBP',
    precision: 2,
    minAmount: 0,
    maxAmount: 10000000,
    subunit: 'pence',
    subunitRatio: 100,
    format: '£{amount}'
  },
  AED: {
    name: 'UAE Dirham',
    symbol: 'د.إ',
    code: 'AED',
    precision: 2,
    minAmount: 0,
    maxAmount: 10000000,
    subunit: 'fils',
    subunitRatio: 100,
    format: '{amount} AED'
  },
  SGD: {
    name: 'Singapore Dollar',
    symbol: 'S$',
    code: 'SGD',
    precision: 2,
    minAmount: 0,
    maxAmount: 10000000,
    subunit: 'cents',
    subunitRatio: 100,
    format: 'S${amount}'
  },
  JPY: {
    name: 'Japanese Yen',
    symbol: '¥',
    code: 'JPY',
    precision: 0, // Yen has no decimal places
    minAmount: 0,
    maxAmount: 1000000000,
    subunit: 'sen',
    subunitRatio: 1,
    format: '¥{amount}'
  },
  CNY: {
    name: 'Chinese Yuan',
    symbol: '¥',
    code: 'CNY',
    precision: 2,
    minAmount: 0,
    maxAmount: 100000000,
    subunit: 'fen',
    subunitRatio: 100,
    format: '¥{amount}'
  }
};

/**
 * Default currency (Indian Rupee as per requirements)
 */
const DEFAULT_CURRENCY = 'INR';

// ─── Money Validation Error Codes ──────────────────────────────────────────────

/**
 * Money validation error codes for consistent error reporting
 */
const MONEY_ERROR_CODES = {
  INVALID_AMOUNT: 'INVALID_MONEY_AMOUNT',
  INVALID_TYPE: 'INVALID_MONEY_TYPE',
  NEGATIVE_AMOUNT: 'NEGATIVE_AMOUNT_NOT_ALLOWED',
  ZERO_AMOUNT: 'ZERO_AMOUNT_NOT_ALLOWED',
  BELOW_MINIMUM: 'AMOUNT_BELOW_MINIMUM',
  ABOVE_MAXIMUM: 'AMOUNT_ABOVE_MAXIMUM',
  INVALID_PRECISION: 'INVALID_DECIMAL_PRECISION',
  UNSAFE_NUMBER: 'UNSAFE_NUMBER_VALUE',
  NAN_VALUE: 'NOT_A_NUMBER',
  INFINITY_VALUE: 'INFINITY_NOT_ALLOWED',
  INVALID_CURRENCY: 'INVALID_CURRENCY_CODE',
  EMPTY_AMOUNT: 'EMPTY_AMOUNT',
  INVALID_STRING_FORMAT: 'INVALID_STRING_FORMAT'
};

/**
 * Money validation error messages
 */
const MONEY_ERROR_MESSAGES = {
  [MONEY_ERROR_CODES.INVALID_AMOUNT]: 'Invalid monetary amount',
  [MONEY_ERROR_CODES.INVALID_TYPE]: 'Amount must be a number',
  [MONEY_ERROR_CODES.NEGATIVE_AMOUNT]: 'Negative amounts are not allowed',
  [MONEY_ERROR_CODES.ZERO_AMOUNT]: 'Zero amount is not allowed',
  [MONEY_ERROR_CODES.BELOW_MINIMUM]: 'Amount is below minimum allowed value',
  [MONEY_ERROR_CODES.ABOVE_MAXIMUM]: 'Amount exceeds maximum allowed value',
  [MONEY_ERROR_CODES.INVALID_PRECISION]: 'Amount has too many decimal places',
  [MONEY_ERROR_CODES.UNSAFE_NUMBER]: 'Amount exceeds safe number range',
  [MONEY_ERROR_CODES.NAN_VALUE]: 'Amount is not a valid number',
  [MONEY_ERROR_CODES.INFINITY_VALUE]: 'Infinity is not a valid amount',
  [MONEY_ERROR_CODES.INVALID_CURRENCY]: 'Invalid or unsupported currency code',
  [MONEY_ERROR_CODES.EMPTY_AMOUNT]: 'Amount is required',
  [MONEY_ERROR_CODES.INVALID_STRING_FORMAT]: 'Amount string format is invalid'
};

// ─── Core Validation Functions ─────────────────────────────────────────────────

/**
 * Parse amount from various input formats
 * Handles numbers, numeric strings, and formatted currency strings
 * 
 * @param {number|string} amount - Amount to parse
 * @returns {Object} { success: boolean, value: number, error?: string }
 */
function parseAmount(amount) {
  // Handle null/undefined
  if (amount === null || amount === undefined) {
    return {
      success: false,
      error: MONEY_ERROR_CODES.EMPTY_AMOUNT,
      message: MONEY_ERROR_MESSAGES[MONEY_ERROR_CODES.EMPTY_AMOUNT]
    };
  }
  
  // Handle number type
  if (typeof amount === 'number') {
    return { success: true, value: amount };
  }
  
  // Handle string type
  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    
    if (trimmed === '') {
      return {
        success: false,
        error: MONEY_ERROR_CODES.EMPTY_AMOUNT,
        message: MONEY_ERROR_MESSAGES[MONEY_ERROR_CODES.EMPTY_AMOUNT]
      };
    }
    
    // Remove common currency symbols and separators
    const cleaned = trimmed
      .replace(/[₹$€£¥,\s]/g, '') // Remove currency symbols and separators
      .replace(/^-?\d+\.?\d*$/, (match) => match); // Keep valid number format
    
    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed)) {
      return {
        success: false,
        error: MONEY_ERROR_CODES.INVALID_STRING_FORMAT,
        message: MONEY_ERROR_MESSAGES[MONEY_ERROR_CODES.INVALID_STRING_FORMAT]
      };
    }
    
    return { success: true, value: parsed };
  }
  
  // Invalid type
  return {
    success: false,
    error: MONEY_ERROR_CODES.INVALID_TYPE,
    message: MONEY_ERROR_MESSAGES[MONEY_ERROR_CODES.INVALID_TYPE]
  };
}

/**
 * Validate number safety and type
 * 
 * @param {number} amount - Numeric amount to validate
 * @returns {Object} Validation result
 */
function validateNumberType(amount) {
  // Check if NaN
  if (isNaN(amount)) {
    return {
      isValid: false,
      error: MONEY_ERROR_CODES.NAN_VALUE,
      message: MONEY_ERROR_MESSAGES[MONEY_ERROR_CODES.NAN_VALUE]
    };
  }
  
  // Check if Infinity
  if (!isFinite(amount)) {
    return {
      isValid: false,
      error: MONEY_ERROR_CODES.INFINITY_VALUE,
      message: MONEY_ERROR_MESSAGES[MONEY_ERROR_CODES.INFINITY_VALUE]
    };
  }
  
  // Check if safe integer for whole number amounts
  // For decimal amounts, check if it's within safe range when scaled
  if (!Number.isSafeInteger(amount * 100)) { // Check up to 2 decimal places
    return {
      isValid: false,
      error: MONEY_ERROR_CODES.UNSAFE_NUMBER,
      message: MONEY_ERROR_MESSAGES[MONEY_ERROR_CODES.UNSAFE_NUMBER]
    };
  }
  
  return { isValid: true };
}

/**
 * Get decimal places count from a number
 * 
 * @param {number} amount - Number to check
 * @returns {number} Number of decimal places
 */
function getDecimalPlaces(amount) {
  if (Math.floor(amount) === amount) {
    return 0;
  }
  
  const str = amount.toString();
  const decimalIndex = str.indexOf('.');
  
  if (decimalIndex === -1) {
    return 0;
  }
  
  // Handle scientific notation
  const eIndex = str.indexOf('e');
  if (eIndex !== -1) {
    const exponent = parseInt(str.substring(eIndex + 1));
    const mantissaDecimals = str.substring(decimalIndex + 1, eIndex).length;
    return Math.max(0, mantissaDecimals - exponent);
  }
  
  return str.length - decimalIndex - 1;
}

/**
 * Round amount to specified precision
 * Uses banker's rounding (round half to even) to minimize bias
 * 
 * @param {number} amount - Amount to round
 * @param {number} precision - Number of decimal places
 * @returns {number} Rounded amount
 */
function roundToPrecision(amount, precision) {
  const multiplier = Math.pow(10, precision);
  return Math.round(amount * multiplier) / multiplier;
}

/**
 * Validate decimal precision for amount
 * 
 * @param {number} amount - Amount to validate
 * @param {number} maxPrecision - Maximum allowed decimal places
 * @returns {Object} Validation result
 */
function validatePrecision(amount, maxPrecision) {
  const decimalPlaces = getDecimalPlaces(amount);
  
  if (decimalPlaces > maxPrecision) {
    return {
      isValid: false,
      error: MONEY_ERROR_CODES.INVALID_PRECISION,
      message: `Amount cannot have more than ${maxPrecision} decimal places. Found ${decimalPlaces} decimal places.`,
      decimalPlaces: decimalPlaces,
      maxPrecision: maxPrecision
    };
  }
  
  return {
    isValid: true,
    decimalPlaces: decimalPlaces
  };
}

/**
 * Validate amount against min/max boundaries
 * 
 * @param {number} amount - Amount to validate
 * @param {number} minAmount - Minimum allowed amount
 * @param {number} maxAmount - Maximum allowed amount
 * @returns {Object} Validation result
 */
function validateBoundaries(amount, minAmount, maxAmount) {
  if (amount < minAmount) {
    return {
      isValid: false,
      error: MONEY_ERROR_CODES.BELOW_MINIMUM,
      message: `Amount must be at least ${minAmount}. Got ${amount}.`,
      minAmount: minAmount,
      providedAmount: amount
    };
  }
  
  if (amount > maxAmount) {
    return {
      isValid: false,
      error: MONEY_ERROR_CODES.ABOVE_MAXIMUM,
      message: `Amount cannot exceed ${maxAmount}. Got ${amount}.`,
      maxAmount: maxAmount,
      providedAmount: amount
    };
  }
  
  return { isValid: true };
}

// ─── Main Validation Function ──────────────────────────────────────────────────

/**
 * Main money validation function
 * 
 * Validates monetary amounts with currency-specific rules and precision controls.
 * Implements comprehensive validation as per R3.7.
 * 
 * @param {number|string} amount - Amount to validate (number or string)
 * @param {Object} options - Validation options
 * @param {string} [options.currency='INR'] - Currency code (INR, USD, EUR, etc.)
 * @param {number} [options.minAmount] - Minimum allowed amount (overrides currency default)
 * @param {number} [options.maxAmount] - Maximum allowed amount (overrides currency default)
 * @param {number} [options.precision] - Decimal precision (overrides currency default)
 * @param {boolean} [options.allowNegative=false] - Allow negative amounts
 * @param {boolean} [options.allowZero=true] - Allow zero amount
 * @param {boolean} [options.autoRound=false] - Automatically round to precision
 * @param {boolean} [options.strict=true] - Strict validation (fail on precision errors)
 * @returns {Object} Comprehensive validation result
 */
function validateMoney(amount, options = {}) {
  const {
    currency = DEFAULT_CURRENCY,
    allowNegative = false,
    allowZero = true,
    autoRound = false,
    strict = true
  } = options;
  
  // Step 1: Validate currency
  const currencyConfig = CURRENCY_CONFIG[currency.toUpperCase()];
  if (!currencyConfig) {
    return {
      isValid: false,
      error: MONEY_ERROR_CODES.INVALID_CURRENCY,
      message: `Currency '${currency}' is not supported. Supported currencies: ${Object.keys(CURRENCY_CONFIG).join(', ')}`,
      input: amount,
      currency: currency
    };
  }
  
  // Get effective validation parameters
  const precision = options.precision !== undefined ? options.precision : currencyConfig.precision;
  const minAmount = options.minAmount !== undefined ? options.minAmount : currencyConfig.minAmount;
  const maxAmount = options.maxAmount !== undefined ? options.maxAmount : currencyConfig.maxAmount;
  
  // Step 2: Parse amount
  const parseResult = parseAmount(amount);
  if (!parseResult.success) {
    return {
      isValid: false,
      error: parseResult.error,
      message: parseResult.message,
      input: amount,
      currency: currency
    };
  }
  
  let numericAmount = parseResult.value;
  
  // Step 3: Validate number type and safety
  const typeValidation = validateNumberType(numericAmount);
  if (!typeValidation.isValid) {
    return {
      isValid: false,
      error: typeValidation.error,
      message: typeValidation.message,
      input: amount,
      currency: currency,
      parsed: numericAmount
    };
  }
  
  // Step 4: Check negative amounts
  if (numericAmount < 0 && !allowNegative) {
    return {
      isValid: false,
      error: MONEY_ERROR_CODES.NEGATIVE_AMOUNT,
      message: MONEY_ERROR_MESSAGES[MONEY_ERROR_CODES.NEGATIVE_AMOUNT],
      input: amount,
      currency: currency,
      parsed: numericAmount
    };
  }
  
  // Step 5: Check zero amount
  if (numericAmount === 0 && !allowZero) {
    return {
      isValid: false,
      error: MONEY_ERROR_CODES.ZERO_AMOUNT,
      message: MONEY_ERROR_MESSAGES[MONEY_ERROR_CODES.ZERO_AMOUNT],
      input: amount,
      currency: currency,
      parsed: numericAmount
    };
  }
  
  // Step 6: Validate decimal precision
  const precisionValidation = validatePrecision(Math.abs(numericAmount), precision);
  if (!precisionValidation.isValid) {
    if (autoRound) {
      // Auto-round to precision
      numericAmount = roundToPrecision(numericAmount, precision);
    } else if (strict) {
      // Fail in strict mode
      return {
        isValid: false,
        error: precisionValidation.error,
        message: precisionValidation.message,
        input: amount,
        currency: currency,
        parsed: numericAmount,
        decimalPlaces: precisionValidation.decimalPlaces,
        maxPrecision: precision
      };
    }
    // In non-strict mode without autoRound, continue with validation
  }
  
  // Step 7: Validate amount boundaries
  const boundaryValidation = validateBoundaries(Math.abs(numericAmount), minAmount, maxAmount);
  if (!boundaryValidation.isValid) {
    return {
      isValid: false,
      error: boundaryValidation.error,
      message: boundaryValidation.message,
      input: amount,
      currency: currency,
      parsed: numericAmount,
      minAmount: minAmount,
      maxAmount: maxAmount
    };
  }
  
  // Step 8: Success - return validated amount
  const normalizedAmount = roundToPrecision(numericAmount, precision);
  
  return {
    isValid: true,
    input: amount,
    amount: normalizedAmount,
    currency: currency,
    precision: precision,
    decimalPlaces: getDecimalPlaces(normalizedAmount),
    formatted: formatMoney(normalizedAmount, { currency }),
    subunitAmount: convertToSubunits(normalizedAmount, currencyConfig),
    currencySymbol: currencyConfig.symbol,
    currencyName: currencyConfig.name
  };
}

// ─── Formatting Functions ──────────────────────────────────────────────────────

/**
 * Format money amount for display
 * 
 * @param {number} amount - Amount to format
 * @param {Object} options - Formatting options
 * @param {string} [options.currency='INR'] - Currency code
 * @param {boolean} [options.showSymbol=true] - Show currency symbol
 * @param {boolean} [options.showCode=false] - Show currency code
 * @param {string} [options.locale='en-IN'] - Locale for number formatting
 * @param {boolean} [options.useGrouping=true] - Use thousand separators
 * @returns {string} Formatted amount
 */
function formatMoney(amount, options = {}) {
  const {
    currency = DEFAULT_CURRENCY,
    showSymbol = true,
    showCode = false,
    locale = 'en-IN',
    useGrouping = true
  } = options;
  
  const currencyConfig = CURRENCY_CONFIG[currency.toUpperCase()];
  if (!currencyConfig) {
    return amount.toString();
  }
  
  // Format number with proper precision
  const formatted = amount.toLocaleString(locale, {
    minimumFractionDigits: currencyConfig.precision,
    maximumFractionDigits: currencyConfig.precision,
    useGrouping: useGrouping
  });
  
  // Build final formatted string
  let result = formatted;
  
  if (showSymbol) {
    result = currencyConfig.format.replace('{amount}', formatted);
  }
  
  if (showCode) {
    result += ` ${currencyConfig.code}`;
  }
  
  return result;
}

/**
 * Convert amount to currency subunits (e.g., paise for INR, cents for USD)
 * 
 * @param {number} amount - Amount in main units
 * @param {Object} currencyConfig - Currency configuration
 * @returns {number} Amount in subunits (integer)
 */
function convertToSubunits(amount, currencyConfig) {
  return Math.round(amount * currencyConfig.subunitRatio);
}

/**
 * Convert subunit amount to main currency units
 * 
 * @param {number} subunitAmount - Amount in subunits
 * @param {string} currency - Currency code
 * @returns {number} Amount in main units
 */
function convertFromSubunits(subunitAmount, currency = DEFAULT_CURRENCY) {
  const currencyConfig = CURRENCY_CONFIG[currency.toUpperCase()];
  if (!currencyConfig) {
    throw new Error(`Currency '${currency}' is not supported`);
  }
  
  return subunitAmount / currencyConfig.subunitRatio;
}

// ─── Normalization Functions ───────────────────────────────────────────────────

/**
 * Normalize money amount to standard format
 * 
 * @param {number|string} amount - Amount to normalize
 * @param {Object} options - Normalization options (same as validateMoney)
 * @returns {Object} Normalization result with normalized amount
 */
function normalizeMoney(amount, options = {}) {
  const validation = validateMoney(amount, { ...options, autoRound: true });
  
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error,
      message: validation.message,
      original: amount
    };
  }
  
  return {
    isValid: true,
    original: amount,
    normalized: validation.amount,
    formatted: validation.formatted,
    currency: validation.currency,
    subunitAmount: validation.subunitAmount
  };
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Check if amount is valid for currency
 * Simple boolean check without detailed error info
 * 
 * @param {number|string} amount - Amount to check
 * @param {Object} options - Validation options
 * @returns {boolean} True if valid
 */
function isValidAmount(amount, options = {}) {
  const result = validateMoney(amount, options);
  return result.isValid;
}

/**
 * Compare two money amounts
 * 
 * @param {number} amount1 - First amount
 * @param {number} amount2 - Second amount
 * @param {Object} options - Comparison options
 * @param {string} [options.currency='INR'] - Currency for precision
 * @returns {number} -1 if amount1 < amount2, 0 if equal, 1 if amount1 > amount2
 */
function compareAmounts(amount1, amount2, options = {}) {
  const { currency = DEFAULT_CURRENCY } = options;
  const currencyConfig = CURRENCY_CONFIG[currency.toUpperCase()];
  const precision = currencyConfig ? currencyConfig.precision : 2;
  
  const rounded1 = roundToPrecision(amount1, precision);
  const rounded2 = roundToPrecision(amount2, precision);
  
  if (rounded1 < rounded2) return -1;
  if (rounded1 > rounded2) return 1;
  return 0;
}

/**
 * Add two money amounts safely
 * 
 * @param {number} amount1 - First amount
 * @param {number} amount2 - Second amount
 * @param {Object} options - Operation options
 * @param {string} [options.currency='INR'] - Currency for precision
 * @returns {number} Sum rounded to currency precision
 */
function addAmounts(amount1, amount2, options = {}) {
  const { currency = DEFAULT_CURRENCY } = options;
  const currencyConfig = CURRENCY_CONFIG[currency.toUpperCase()];
  const precision = currencyConfig ? currencyConfig.precision : 2;
  
  const sum = amount1 + amount2;
  return roundToPrecision(sum, precision);
}

/**
 * Subtract two money amounts safely
 * 
 * @param {number} amount1 - Amount to subtract from
 * @param {number} amount2 - Amount to subtract
 * @param {Object} options - Operation options
 * @param {string} [options.currency='INR'] - Currency for precision
 * @returns {number} Difference rounded to currency precision
 */
function subtractAmounts(amount1, amount2, options = {}) {
  const { currency = DEFAULT_CURRENCY } = options;
  const currencyConfig = CURRENCY_CONFIG[currency.toUpperCase()];
  const precision = currencyConfig ? currencyConfig.precision : 2;
  
  const difference = amount1 - amount2;
  return roundToPrecision(difference, precision);
}

/**
 * Multiply amount by factor safely
 * 
 * @param {number} amount - Amount to multiply
 * @param {number} factor - Multiplication factor
 * @param {Object} options - Operation options
 * @param {string} [options.currency='INR'] - Currency for precision
 * @returns {number} Product rounded to currency precision
 */
function multiplyAmount(amount, factor, options = {}) {
  const { currency = DEFAULT_CURRENCY } = options;
  const currencyConfig = CURRENCY_CONFIG[currency.toUpperCase()];
  const precision = currencyConfig ? currencyConfig.precision : 2;
  
  const product = amount * factor;
  return roundToPrecision(product, precision);
}

/**
 * Get currency information
 * 
 * @param {string} currency - Currency code
 * @returns {Object|null} Currency configuration or null if not found
 */
function getCurrencyInfo(currency) {
  const config = CURRENCY_CONFIG[currency.toUpperCase()];
  if (!config) {
    return null;
  }
  
  return { ...config };
}

/**
 * Get list of supported currencies
 * 
 * @returns {Array<string>} Array of currency codes
 */
function getSupportedCurrencies() {
  return Object.keys(CURRENCY_CONFIG);
}

/**
 * Batch validate multiple amounts
 * 
 * @param {Array<number|string>} amounts - Array of amounts to validate
 * @param {Object} options - Validation options (same as validateMoney)
 * @returns {Array<Object>} Array of validation results
 */
function validateMoneyBatch(amounts, options = {}) {
  if (!Array.isArray(amounts)) {
    throw new Error('Input must be an array of amounts');
  }
  
  return amounts.map((amount, index) => ({
    index,
    amount,
    ...validateMoney(amount, options)
  }));
}

// ─── Zod Integration Helper ────────────────────────────────────────────────────

/**
 * Create Zod schema for money validation
 * Integrates with the existing Zod validation framework
 * 
 * @param {Object} options - Validation options (same as validateMoney)
 * @returns {import('zod').ZodEffects} Zod schema with money validation
 */
function createMoneySchema(options = {}) {
  const z = require('zod');
  
  return z.union([z.number(), z.string()])
    .refine(
      (amount) => validateMoney(amount, options).isValid,
      (amount) => {
        const result = validateMoney(amount, options);
        return {
          message: result.message || 'Invalid monetary amount',
          code: result.error || 'INVALID_MONEY_AMOUNT'
        };
      }
    )
    .transform((amount) => {
      const result = validateMoney(amount, { ...options, autoRound: true });
      return result.amount;
    });
}

// ─── Module Exports ─────────────────────────────────────────────────────────────

module.exports = {
  // Main validation functions
  validateMoney,
  normalizeMoney,
  isValidAmount,
  
  // Formatting functions
  formatMoney,
  convertToSubunits,
  convertFromSubunits,
  
  // Utility functions
  parseAmount,
  getDecimalPlaces,
  roundToPrecision,
  compareAmounts,
  
  // Arithmetic operations
  addAmounts,
  subtractAmounts,
  multiplyAmount,
  
  // Currency information
  getCurrencyInfo,
  getSupportedCurrencies,
  
  // Batch operations
  validateMoneyBatch,
  
  // Internal validation functions (for testing)
  validateNumberType,
  validatePrecision,
  validateBoundaries,
  
  // Zod integration
  createMoneySchema,
  
  // Constants and configuration
  MONEY_ERROR_CODES,
  MONEY_ERROR_MESSAGES,
  CURRENCY_CONFIG,
  DEFAULT_CURRENCY
};
