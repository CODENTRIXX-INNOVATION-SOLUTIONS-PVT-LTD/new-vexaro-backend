'use strict';

/**
 * Enterprise Validation Framework - Validation Result Caching
 * 
 * Provides high-performance validation result caching to optimize repeated validation
 * operations. Implements requirement R8.2 for validation performance optimization
 * through intelligent caching strategies, cache invalidation, and distributed caching support.
 * 
 * @module ValidationCache
 */

const crypto = require('crypto');

// ─── Cache Configuration ────────────────────────────────────────────────────────

/**
 * Default cache configuration options
 */
const DEFAULT_CACHE_CONFIG = {
  // Cache behavior
  enabled: true,
  defaultTTL: 300, // 5 minutes in seconds
  maxSize: 1000,   // Maximum number of entries
  
  // Cache strategy
  strategy: 'LRU',    // LRU | LFU | FIFO
  enableDistributed: false,
  
  // Performance settings
  enableCompression: false,
  hashAlgorithm: 'sha256',
  keyPrefix: 'vexaro:validation:',
  
  // Memory management
  memoryLimitMB: 50,
  gcInterval: 60000, // 1 minute
  enableMemoryWarning: true,
  
  // Cache statistics
  enableStats: true,
  statsInterval: 300000, // 5 minutes
  
  // Cache warming
  enablePreload: false,
  preloadPatterns: [],
};

/**
 * Cache entry structure
 */
const CACHE_ENTRY_STRUCTURE = {
  key: 'string',
  value: 'any',
  ttl: 'number',
  created: 'number',
  accessed: 'number',
  accessCount: 'number',
  size: 'number',
};

/**
 * Cache strategies enumeration
 */
const CACHE_STRATEGIES = {
  LRU: 'least-recently-used',
  LFU: 'least-frequently-used', 
  FIFO: 'first-in-first-out',
  TTL: 'time-to-live',
};

// ─── In-Memory Cache Implementation ─────────────────────────────────────────────

/**
 * High-performance in-memory validation cache
 */
class ValidationCache {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.cache = new Map();
    this.accessOrder = new Map(); // For LRU tracking
    this.accessCount = new Map(); // For LFU tracking
    this.stats = this._initializeStats();
    this.memoryUsage = 0;
    this.accessSequence = 0;
    
    // Start garbage collection if enabled
    if (this.config.gcInterval > 0) {
      this.gcTimer = setInterval(() => this._runGarbageCollection(), this.config.gcInterval);
    }
    
    // Start statistics reporting if enabled
    if (this.config.enableStats && this.config.statsInterval > 0) {
      this.statsTimer = setInterval(() => this._reportStats(), this.config.statsInterval);
    }
  }
  
  /**
   * Get cached validation result
   * 
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    if (!this.config.enabled) {
      return null;
    }
    
    const hashedKey = this._hashKey(key);
    const entry = this.cache.get(hashedKey);
    
    if (!entry) {
      this._recordStats('miss');
      return null;
    }
    
    // Check TTL expiration
    const now = Date.now();
    if (entry.ttl > 0 && now > entry.created + (entry.ttl * 1000)) {
      this.delete(key);
      this._recordStats('expired');
      return null;
    }
    
    // Update access tracking
    this._updateAccess(hashedKey, entry);
    this._recordStats('hit');
    
    return this._decompressValue(entry.value);
  }
  
  /**
   * Store validation result in cache
   * 
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} [ttl] - Time to live in seconds (optional)
   * @returns {boolean} Success status
   */
  set(key, value, ttl) {
    if (!this.config.enabled) {
      return false;
    }
    
    const hashedKey = this._hashKey(key);
    const now = Date.now();
    const effectiveTTL = ttl !== undefined ? ttl : this.config.defaultTTL;
    
    // Check memory limits before storing
    const entrySize = this._calculateSize(value);
    if (!this._checkMemoryLimits(entrySize)) {
      this._recordStats('memory_limit');
      return false;
    }
    
    // Remove existing entry if it exists
    if (this.cache.has(hashedKey)) {
      this._removeEntry(hashedKey);
    }
    
    // Check cache size limits and evict if necessary
    if (this.cache.size >= this.config.maxSize) {
      this._evictEntries(1);
    }
    
    // Create and store new entry
    const entry = {
      key: hashedKey,
      value: this._compressValue(value),
      ttl: effectiveTTL,
      created: now,
      accessed: ++this.accessSequence,
      accessCount: 1,
      size: entrySize,
    };
    
    this.cache.set(hashedKey, entry);
    this.accessOrder.set(hashedKey, entry.accessed);
    this.accessCount.set(hashedKey, 1);
    this.memoryUsage += entrySize;
    
    this._recordStats('set');
    return true;
  }
  
  /**
   * Delete entry from cache
   * 
   * @param {string} key - Cache key
   * @returns {boolean} Success status
   */
  delete(key) {
    const hashedKey = this._hashKey(key);
    return this._removeEntry(hashedKey);
  }
  
  /**
   * Check if key exists in cache (without affecting access stats)
   * 
   * @param {string} key - Cache key
   * @returns {boolean} Existence status
   */
  has(key) {
    if (!this.config.enabled) {
      return false;
    }
    
    const hashedKey = this._hashKey(key);
    const entry = this.cache.get(hashedKey);
    
    if (!entry) {
      return false;
    }
    
    // Check TTL without updating access
    const now = Date.now();
    if (entry.ttl > 0 && now > entry.created + (entry.ttl * 1000)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCount.clear();
    this.memoryUsage = 0;
    this._recordStats('clear');
  }
  
  /**
   * Get cache statistics
   * 
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsage: this.memoryUsage,
      memoryLimit: this.config.memoryLimitMB * 1024 * 1024,
      hitRate: this.stats.hits > 0 ? (this.stats.hits / (this.stats.hits + this.stats.misses)) : 0,
    };
  }
  
  /**
   * Get cache configuration
   * 
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * Update cache configuration
   * 
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Restart timers if intervals changed
    if (newConfig.gcInterval !== undefined) {
      if (this.gcTimer) {
        clearInterval(this.gcTimer);
      }
      if (this.config.gcInterval > 0) {
        this.gcTimer = setInterval(() => this._runGarbageCollection(), this.config.gcInterval);
      }
    }
    
    if (newConfig.statsInterval !== undefined) {
      if (this.statsTimer) {
        clearInterval(this.statsTimer);
      }
      if (this.config.enableStats && this.config.statsInterval > 0) {
        this.statsTimer = setInterval(() => this._reportStats(), this.config.statsInterval);
      }
    }
  }
  
  /**
   * Warm cache with predefined entries
   * 
   * @param {Array<Object>} entries - Array of {key, value, ttl} objects
   */
  warmCache(entries) {
    if (!this.config.enablePreload) {
      return;
    }
    
    for (const entry of entries) {
      this.set(entry.key, entry.value, entry.ttl);
    }
    
    this._recordStats('preload', entries.length);
  }
  
  /**
   * Export cache data for backup/migration
   * 
   * @returns {Array} Array of cache entries
   */
  export() {
    const entries = [];
    const now = Date.now();
    
    for (const [hashedKey, entry] of this.cache) {
      // Skip expired entries
      if (entry.ttl > 0 && now > entry.created + (entry.ttl * 1000)) {
        continue;
      }
      
      entries.push({
        key: hashedKey,
        value: this._decompressValue(entry.value),
        ttl: entry.ttl,
        created: entry.created,
        accessed: entry.accessed,
        accessCount: entry.accessCount,
      });
    }
    
    return entries;
  }
  
  /**
   * Import cache data from backup
   * 
   * @param {Array} entries - Array of cache entries
   */
  import(entries) {
    for (const entry of entries) {
      const hashedKey = entry.key;
      const now = Date.now();
      
      // Skip if expired
      if (entry.ttl > 0 && now > entry.created + (entry.ttl * 1000)) {
        continue;
      }
      
      const cacheEntry = {
        key: hashedKey,
        value: this._compressValue(entry.value),
        ttl: entry.ttl,
        created: entry.created,
        accessed: entry.accessed || now,
        accessCount: entry.accessCount || 1,
        size: this._calculateSize(entry.value),
      };
      
      this.cache.set(hashedKey, cacheEntry);
      this.accessOrder.set(hashedKey, cacheEntry.accessed);
      this.accessCount.set(hashedKey, cacheEntry.accessCount);
      this.memoryUsage += cacheEntry.size;
    }
  }
  
  /**
   * Clean up resources and stop timers
   */
  destroy() {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    
    this.clear();
  }
  
  // ─── Private Methods ──────────────────────────────────────────────────────────
  
  /**
   * Initialize statistics object
   * @private
   */
  _initializeStats() {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      expired: 0,
      memoryLimits: 0,
      clears: 0,
      preloads: 0,
      gcRuns: 0,
      startTime: Date.now(),
    };
  }
  
  /**
   * Record cache operation statistics
   * @private
   */
  _recordStats(operation, count = 1) {
    if (this.config.enableStats) {
      const statNames = {
        hit: 'hits', miss: 'misses', set: 'sets', delete: 'deletes', eviction: 'evictions',
        expired: 'expired', memory_limit: 'memoryLimits', clear: 'clears', preload: 'preloads', gc: 'gcRuns',
      };
      const statName = statNames[operation] || operation;
      if (!this.stats[statName]) {
        this.stats[statName] = 0;
      }
      this.stats[statName] += count;
    }
  }
  
  /**
   * Hash cache key for consistent storage
   * @private
   */
  _hashKey(key) {
    const keyString = typeof key === 'string' ? key : JSON.stringify(key);
    const fullKey = this.config.keyPrefix + keyString;
    
    return crypto
      .createHash(this.config.hashAlgorithm)
      .update(fullKey)
      .digest('hex');
  }
  
  /**
   * Update access tracking for cache entry
   * @private
   */
  _updateAccess(hashedKey, entry) {
    entry.accessed = ++this.accessSequence;
    entry.accessCount += 1;
    
    this.accessOrder.set(hashedKey, entry.accessed);
    this.accessCount.set(hashedKey, entry.accessCount);
  }
  
  /**
   * Calculate approximate size of value in bytes
   * @private
   */
  _calculateSize(value) {
    if (value === null || value === undefined) {
      return 0;
    }
    
    const jsonString = JSON.stringify(value);
    return Buffer.byteLength(jsonString, 'utf8');
  }
  
  /**
   * Check memory limits before adding entry
   * @private
   */
  _checkMemoryLimits(newEntrySize) {
    const memoryLimitBytes = this.config.memoryLimitMB * 1024 * 1024;
    
    if (this.memoryUsage + newEntrySize > memoryLimitBytes) {
      if (this.config.enableMemoryWarning) {
        console.warn(`ValidationCache: Memory limit approaching. Current: ${Math.round(this.memoryUsage / 1024 / 1024)}MB, Limit: ${this.config.memoryLimitMB}MB`);
      }
      
      // Try to free some memory by evicting entries
      const targetEvictions = Math.ceil(this.cache.size * 0.1); // Evict 10%
      this._evictEntries(targetEvictions);
      
      // Check again after eviction
      if (this.memoryUsage + newEntrySize > memoryLimitBytes) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Evict entries based on configured strategy
   * @private
   */
  _evictEntries(count) {
    const entries = Array.from(this.cache.entries());
    let toEvict = [];
    
    switch (this.config.strategy) {
      case 'LRU':
        toEvict = entries
          .sort((a, b) => a[1].accessed - b[1].accessed)
          .slice(0, count);
        break;
        
      case 'LFU':
        toEvict = entries
          .sort((a, b) => a[1].accessCount - b[1].accessCount)
          .slice(0, count);
        break;
        
      case 'FIFO':
        toEvict = entries
          .sort((a, b) => a[1].created - b[1].created)
          .slice(0, count);
        break;
        
      case 'TTL':
        const now = Date.now();
        toEvict = entries
          .filter(([, entry]) => entry.ttl > 0)
          .sort((a, b) => {
            const expiresA = a[1].created + (a[1].ttl * 1000);
            const expiresB = b[1].created + (b[1].ttl * 1000);
            return expiresA - expiresB;
          })
          .slice(0, count);
        break;
        
      default:
        // Default to LRU
        toEvict = entries
          .sort((a, b) => a[1].accessed - b[1].accessed)
          .slice(0, count);
    }
    
    for (const [hashedKey] of toEvict) {
      this._removeEntry(hashedKey);
      this._recordStats('evictions');
    }
  }
  
  /**
   * Remove entry from cache and cleanup tracking
   * @private
   */
  _removeEntry(hashedKey) {
    const entry = this.cache.get(hashedKey);
    
    if (entry) {
      this.cache.delete(hashedKey);
      this.accessOrder.delete(hashedKey);
      this.accessCount.delete(hashedKey);
      this.memoryUsage -= entry.size;
      this._recordStats('deletes');
      return true;
    }
    
    return false;
  }
  
  /**
   * Compress value if compression is enabled
   * @private
   */
  _compressValue(value) {
    if (!this.config.enableCompression) {
      return value;
    }
    
    // Simple compression using JSON.stringify for now
    // In production, consider using zlib or similar
    return JSON.stringify(value);
  }
  
  /**
   * Decompress value if compression is enabled
   * @private
   */
  _decompressValue(value) {
    if (!this.config.enableCompression) {
      return value;
    }
    
    try {
      return JSON.parse(value);
    } catch {
      return value; // Return as-is if parsing fails
    }
  }
  
  /**
   * Run garbage collection to clean expired entries
   * @private
   */
  _runGarbageCollection() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [hashedKey, entry] of this.cache) {
      if (entry.ttl > 0 && now > entry.created + (entry.ttl * 1000)) {
        expiredKeys.push(hashedKey);
      }
    }
    
    for (const hashedKey of expiredKeys) {
      this._removeEntry(hashedKey);
      this._recordStats('expired');
    }
    
    this._recordStats('gcRuns');
  }
  
  /**
   * Report cache statistics
   * @private
   */
  _reportStats() {
    if (this.config.enableStats) {
      const stats = this.getStats();
      console.info('ValidationCache Stats:', {
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
        size: `${stats.size}/${stats.maxSize}`,
        memory: `${Math.round(stats.memoryUsage / 1024 / 1024)}MB/${this.config.memoryLimitMB}MB`,
        operations: {
          hits: stats.hits,
          misses: stats.misses,
          sets: stats.sets,
          evictions: stats.evictions,
        },
      });
    }
  }
}

// ─── Cache Key Generation Utilities ─────────────────────────────────────────────

/**
 * Generate cache key from validation parameters
 * 
 * @param {string} schemaName - Schema identifier
 * @param {any} data - Data being validated
 * @param {Object} options - Validation options
 * @returns {string} Generated cache key
 */
function generateValidationCacheKey(schemaName, data, options = {}) {
  const keyParts = [
    'validation',
    schemaName,
    crypto.createHash('md5').update(JSON.stringify(data)).digest('hex'),
  ];
  
  if (Object.keys(options).length > 0) {
    keyParts.push(crypto.createHash('md5').update(JSON.stringify(options)).digest('hex'));
  }
  
  return keyParts.join(':');
}

/**
 * Generate cache key from schema definition
 * 
 * @param {Object} schemaDef - Schema definition object
 * @returns {string} Generated schema cache key
 */
function generateSchemaCacheKey(schemaDef) {
  const schemaString = JSON.stringify(schemaDef);
  const hash = crypto.createHash('sha256').update(schemaString).digest('hex');
  return `schema:${hash}`;
}

/**
 * Generate cache key for business rule validation
 * 
 * @param {string} ruleName - Business rule name
 * @param {Object} context - Rule context data
 * @returns {string} Generated business rule cache key
 */
function generateBusinessRuleCacheKey(ruleName, context) {
  const contextHash = crypto.createHash('md5').update(JSON.stringify(context)).digest('hex');
  return `business_rule:${ruleName}:${contextHash}`;
}

// ─── Cache Wrapper Functions ────────────────────────────────────────────────────

/**
 * Create cached validation function
 * 
 * @param {Function} validationFn - Original validation function
 * @param {ValidationCache} cache - Cache instance
 * @param {Object} options - Caching options
 * @returns {Function} Cached validation function
 */
function createCachedValidator(validationFn, cache, options = {}) {
  const { keyGenerator, ttl } = options;
  
  return async (data, validationOptions) => {
    // Generate cache key
    const cacheKey = keyGenerator 
      ? keyGenerator(data, validationOptions)
      : generateValidationCacheKey('default', data, validationOptions);
    
    // Try to get from cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult !== null) {
      return cachedResult;
    }
    
    // Perform validation and cache result
    try {
      const result = await validationFn(data, validationOptions);
      
      // Only cache successful validations
      if (result && result.success !== false) {
        cache.set(cacheKey, result, ttl);
      }
      
      return result;
    } catch (error) {
      // Don't cache validation errors
      throw error;
    }
  };
}

/**
 * Create cached schema compilation function
 * 
 * @param {Function} compileFn - Original schema compilation function
 * @param {ValidationCache} cache - Cache instance
 * @param {number} [ttl] - Time to live for cached schemas
 * @returns {Function} Cached schema compilation function
 */
function createCachedSchemaCompiler(compileFn, cache, ttl) {
  return (schemaDef, options) => {
    const cacheKey = generateSchemaCacheKey(schemaDef);
    
    // Try to get compiled schema from cache
    const cachedSchema = cache.get(cacheKey);
    if (cachedSchema !== null) {
      return cachedSchema;
    }
    
    // Compile schema and cache result
    const compiledSchema = compileFn(schemaDef, options);
    cache.set(cacheKey, compiledSchema, ttl);
    
    return compiledSchema;
  };
}

// ─── Global Cache Instance ──────────────────────────────────────────────────────

/**
 * Global validation cache instance
 */
let globalCache = null;

/**
 * Get or create global cache instance
 * 
 * @param {Object} [config] - Cache configuration
 * @returns {ValidationCache} Global cache instance
 */
function getGlobalCache(config = {}) {
  if (!globalCache) {
    globalCache = new ValidationCache(config);
  }
  return globalCache;
}

/**
 * Configure global cache
 * 
 * @param {Object} config - New cache configuration
 */
function configureGlobalCache(config) {
  if (globalCache) {
    globalCache.updateConfig(config);
  } else {
    globalCache = new ValidationCache(config);
  }
}

/**
 * Clear global cache
 */
function clearGlobalCache() {
  if (globalCache) {
    globalCache.clear();
  }
}

/**
 * Destroy global cache and cleanup resources
 */
function destroyGlobalCache() {
  if (globalCache) {
    globalCache.destroy();
    globalCache = null;
  }
}

// ─── Main Exports ───────────────────────────────────────────────────────────────

module.exports = {
  // Main cache class
  ValidationCache,
  
  // Cache key generation utilities
  generateValidationCacheKey,
  generateSchemaCacheKey,
  generateBusinessRuleCacheKey,
  
  // Cache wrapper functions
  createCachedValidator,
  createCachedSchemaCompiler,
  
  // Global cache management
  getGlobalCache,
  configureGlobalCache,
  clearGlobalCache,
  destroyGlobalCache,
  
  // Configuration constants
  DEFAULT_CACHE_CONFIG,
  CACHE_STRATEGIES,
  CACHE_ENTRY_STRUCTURE,
};
