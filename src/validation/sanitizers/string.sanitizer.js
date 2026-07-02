'use strict';

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BIDI_OVERRIDES = /[\u202A-\u202E\u2066-\u2069]/g;
const HTML_TAGS = /<[^>]*>/g;

function sanitizeString(value, options = {}) {
  if (typeof value !== 'string') return value;
  const {
    trim = true,
    normalize = true,
    removeHtml = true,
    removeControlCharacters = true,
    maxLength,
  } = options;
  let result = normalize ? value.normalize('NFKC') : value;
  if (removeControlCharacters) result = result.replace(CONTROL_CHARACTERS, '').replace(BIDI_OVERRIDES, '');
  if (removeHtml) result = result.replace(HTML_TAGS, '');
  if (trim) result = result.trim();
  if (Number.isInteger(maxLength) && maxLength >= 0) result = result.slice(0, maxLength);
  return result;
}

function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return '';
  return sanitizeString(filename, { removeHtml: true })
    .replace(/[\\/]/g, '_')
    .replace(/\.\.+/g, '.')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .slice(0, 180);
}

function sanitizeObject(value, options = {}, seen = new WeakSet(), depth = 0) {
  const { maxDepth = 20, maxKeys = 1000 } = options;
  if (typeof value === 'string') return sanitizeString(value, options);
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value) || depth > maxDepth) throw validationError('Input nesting is too deep');
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeObject(item, options, seen, depth + 1));

  const entries = Object.entries(value);
  if (entries.length > maxKeys) throw validationError('Input contains too many fields');
  const output = {};
  for (const [key, item] of entries) {
    if (key.startsWith('$') || key.includes('.') || key.includes('\0')) {
      throw validationError('Unsafe object key detected', key);
    }
    output[sanitizeString(key, { removeHtml: true, maxLength: 200 })] = sanitizeObject(item, options, seen, depth + 1);
  }
  return output;
}

function validationError(message, field = 'request') {
  return Object.assign(new Error('Validation failed'), {
    name: 'ValidationError',
    statusCode: 400,
    errors: [{ field, code: 'UNSAFE_INPUT', message }],
  });
}

module.exports = { sanitizeString, sanitizeFilename, sanitizeObject, CONTROL_CHARACTERS };
