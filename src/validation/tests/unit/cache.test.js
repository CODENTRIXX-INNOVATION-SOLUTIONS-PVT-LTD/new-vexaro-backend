'use strict';

/**
 * Unit Tests for Validation Cache Helper
 * 
 * Tests caching functionality, performance optimization, cache strategies,
 * and distributed caching support as required by R8.2.
 */

const {
  ValidationCache,
  generateValidationCacheKey,
  generateSchemaCacheKey,
  generateBusinessRuleCacheKey,
  createCachedValidator,
  createCachedSchemaCompiler,
  getGlobalCache,
  configureGlobalCache,
  clearGlobalCache,
  destroyGlobalCache,
  DEFAULT_CACHE_CONFIG,
  CACHE_STRATEGIES,
} = require('../../helpers/cache');

describe('Validation Cache Helper', () => {
  describe('ValidationCache Class', () => {
    let cache;
    
    beforeEach(() => {
      cache = new ValidationCache({
        defaultTTL: 60, // 1 minute for tests
        maxSize: 100,
        gcInterval: 0, // Disable automatic GC for tests
        statsInterval: 0, // Disable automatic stats reporting
      });
    });
    
    afterEach(() => {
      cache.destroy();
    });
    
    describe('Basic Cache Operations', () => {
      test('should store and retrieve values', () => {
        const key = 'test-key';
        const value = { result: 'success', data: [1, 2, 3] };
        
        expect(cache.set(key, value)).toBe(true);
        expect(cache.get(key)).toEqual(value);
      });
      
      test('should return null for non-existent keys', () => {
        expect(cache.get('non-existent-key')).toBe(null);
      });
      
      test('should check key existence', () => {
        const key = 'test-key';
        const value = 'test-value';
        
        expect(cache.has(key)).toBe(false);
        
        cache.set(key, value);
        expect(cache.has(key)).toBe(true);
      });
      
      test('should delete values', () => {
        const key = 'test-key';
        const value = 'test-value';
        
        cache.set(key, value);
        expect(cache.has(key)).toBe(true);
        
        expect(cache.delete(key)).toBe(true);
        expect(cache.has(key)).toBe(false);
        expect(cache.get(key)).toBe(null);
      });
      
      test('should clear all values', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');
        
        expect(cache.getStats().size).toBe(3);
        
        cache.clear();
        expect(cache.getStats().size).toBe(0);
        expect(cache.get('key1')).toBe(null);
      });
    });
    
    describe('TTL (Time To Live)', () => {
      test('should respect default TTL', (done) => {
        const testCache = new ValidationCache({
          defaultTTL: 0.1, // 0.1 seconds
          gcInterval: 0,
        });
        
        testCache.set('key', 'value');
        expect(testCache.get('key')).toBe('value');
        
        setTimeout(() => {
          expect(testCache.get('key')).toBe(null);
          testCache.destroy();
          done();
        }, 150); // Wait 150ms
      });
      
      test('should respect custom TTL', (done) => {
        const testCache = new ValidationCache({
          defaultTTL: 60,
          gcInterval: 0,
        });
        
        testCache.set('key', 'value', 0.1); // 0.1 seconds TTL
        expect(testCache.get('key')).toBe('value');
        
        setTimeout(() => {
          expect(testCache.get('key')).toBe(null);
          testCache.destroy();
          done();
        }, 150);
      });
      
      test('should handle zero TTL (no expiration)', (done) => {
        cache.set('key', 'value', 0);
        expect(cache.get('key')).toBe('value');
        
        // Should still be there after some time
        setTimeout(() => {
          expect(cache.get('key')).toBe('value');
          done();
        }, 100);
      });
    });
    
    describe('Cache Size Limits', () => {
      test('should enforce maximum cache size', () => {
        const smallCache = new ValidationCache({
          maxSize: 3,
          gcInterval: 0,
        });
        
        // Fill cache to max capacity
        smallCache.set('key1', 'value1');
        smallCache.set('key2', 'value2');
        smallCache.set('key3', 'value3');
        
        expect(smallCache.getStats().size).toBe(3);
        
        // Adding another item should evict one
        smallCache.set('key4', 'value4');
        expect(smallCache.getStats().size).toBe(3);
        
        smallCache.destroy();
      });
      
      test('should evict entries using LRU strategy', () => {
        const lruCache = new ValidationCache({
          maxSize: 2,
          strategy: 'LRU',
          gcInterval: 0,
        });
        
        lruCache.set('key1', 'value1');
        lruCache.set('key2', 'value2');
        
        // Access key1 to make it recently used
        lruCache.get('key1');
        
        // Adding key3 should evict key2 (least recently used)
        lruCache.set('key3', 'value3');
        
        expect(lruCache.has('key1')).toBe(true);
        expect(lruCache.has('key2')).toBe(false);
        expect(lruCache.has('key3')).toBe(true);
        
        lruCache.destroy();
      });
    });
    
    describe('Memory Management', () => {
      test('should track memory usage', () => {
        const largeValue = { data: 'x'.repeat(1000) };
        
        cache.set('large-key', largeValue);
        
        const stats = cache.getStats();
        expect(stats.memoryUsage).toBeGreaterThan(0);
      });
      
      test('should respect memory limits', () => {
        const limitedCache = new ValidationCache({
          memoryLimitMB: 0.001, // Very small limit (1KB)
          enableMemoryWarning: false,
          gcInterval: 0,
        });
        
        const largeValue = { data: 'x'.repeat(10000) }; // ~10KB
        
        // Should refuse to store value that exceeds memory limit
        expect(limitedCache.set('large-key', largeValue)).toBe(false);
        
        limitedCache.destroy();
      });
    });
    
    describe('Access Tracking', () => {
      test('should track access count', () => {
        cache.set('key', 'value');
        
        // Access the key multiple times
        cache.get('key');
        cache.get('key');
        cache.get('key');
        
        const stats = cache.getStats();
        expect(stats.hits).toBe(3);
        expect(stats.misses).toBe(0);
      });
      
      test('should track cache misses', () => {
        cache.get('non-existent-1');
        cache.get('non-existent-2');
        
        const stats = cache.getStats();
        expect(stats.misses).toBe(2);
        expect(stats.hits).toBe(0);
      });
      
      test('should calculate hit rate', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        
        // 2 hits, 1 miss
        cache.get('key1');
        cache.get('key2');
        cache.get('non-existent');
        
        const stats = cache.getStats();
        expect(stats.hitRate).toBeCloseTo(2/3, 2);
      });
    });
    
    describe('Configuration Management', () => {
      test('should get current configuration', () => {
        const config = cache.getConfig();
        
        expect(config.defaultTTL).toBe(60);
        expect(config.maxSize).toBe(100);
        expect(config.strategy).toBe('LRU');
      });
      
      test('should update configuration', () => {
        cache.updateConfig({
          defaultTTL: 120,
          maxSize: 200,
        });
        
        const config = cache.getConfig();
        expect(config.defaultTTL).toBe(120);
        expect(config.maxSize).toBe(200);
      });
    });
    
    describe('Import/Export', () => {
      test('should export cache data', () => {
        cache.set('key1', 'value1');
        cache.set('key2', { complex: 'object' });
        
        const exported = cache.export();
        
        expect(Array.isArray(exported)).toBe(true);
        expect(exported.length).toBe(2);
        
        const entry = exported.find(e => e.value === 'value1');
        expect(entry).toBeDefined();
        expect(entry.key).toBeDefined();
        expect(entry.created).toBeDefined();
      });
      
      test('should import cache data', () => {
        const importData = [
          {
            key: 'imported-key-1',
            value: 'imported-value-1',
            ttl: 300,
            created: Date.now(),
            accessed: Date.now(),
            accessCount: 1,
          },
          {
            key: 'imported-key-2',
            value: { imported: 'object' },
            ttl: 300,
            created: Date.now(),
            accessed: Date.now(),
            accessCount: 1,
          },
        ];
        
        cache.import(importData);
        
        // Note: We can't directly test the imported values because keys are hashed
        // But we can verify the cache size increased
        expect(cache.getStats().size).toBe(2);
      });
    });
    
    describe('Disabled Cache', () => {
      test('should not store when disabled', () => {
        const disabledCache = new ValidationCache({ enabled: false });
        
        expect(disabledCache.set('key', 'value')).toBe(false);
        expect(disabledCache.get('key')).toBe(null);
        expect(disabledCache.has('key')).toBe(false);
        
        disabledCache.destroy();
      });
    });
  });
  
  describe('Cache Key Generation', () => {
    test('should generate validation cache key', () => {
      const key = generateValidationCacheKey('userSchema', { name: 'John' }, { strict: true });
      
      expect(typeof key).toBe('string');
      expect(key).toContain('validation');
      expect(key).toContain('userSchema');
      
      // Should generate same key for same inputs
      const key2 = generateValidationCacheKey('userSchema', { name: 'John' }, { strict: true });
      expect(key).toBe(key2);
      
      // Should generate different key for different inputs
      const key3 = generateValidationCacheKey('userSchema', { name: 'Jane' }, { strict: true });
      expect(key).not.toBe(key3);
    });
    
    test('should generate schema cache key', () => {
      const schemaDef = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };
      
      const key = generateSchemaCacheKey(schemaDef);
      
      expect(typeof key).toBe('string');
      expect(key).toContain('schema:');
      
      // Should generate same key for same schema
      const key2 = generateSchemaCacheKey(schemaDef);
      expect(key).toBe(key2);
    });
    
    test('should generate business rule cache key', () => {
      const key = generateBusinessRuleCacheKey('COD_LIMIT', { userId: '123', amount: 5000 });
      
      expect(typeof key).toBe('string');
      expect(key).toContain('business_rule');
      expect(key).toContain('COD_LIMIT');
      
      // Should be consistent
      const key2 = generateBusinessRuleCacheKey('COD_LIMIT', { userId: '123', amount: 5000 });
      expect(key).toBe(key2);
    });
  });
  
  describe('Cached Wrapper Functions', () => {
    test('should create cached validator', async () => {
      const mockValidator = jest.fn().mockResolvedValue({ success: true, data: 'validated' });
      const testCache = new ValidationCache({ gcInterval: 0 });
      
      const cachedValidator = createCachedValidator(mockValidator, testCache, {
        keyGenerator: (data) => `test:${JSON.stringify(data)}`,
        ttl: 300,
      });
      
      // First call should hit the validator
      const result1 = await cachedValidator({ name: 'John' });
      expect(mockValidator).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ success: true, data: 'validated' });
      
      // Second call should hit the cache
      const result2 = await cachedValidator({ name: 'John' });
      expect(mockValidator).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual({ success: true, data: 'validated' });
      
      testCache.destroy();
    });
    
    test('should create cached schema compiler', () => {
      const mockCompiler = jest.fn().mockReturnValue({ compiledSchema: true });
      const testCache = new ValidationCache({ gcInterval: 0 });
      
      const cachedCompiler = createCachedSchemaCompiler(mockCompiler, testCache, 300);
      
      const schemaDef = { type: 'string' };
      
      // First call should hit the compiler
      const result1 = cachedCompiler(schemaDef);
      expect(mockCompiler).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ compiledSchema: true });
      
      // Second call should hit the cache
      const result2 = cachedCompiler(schemaDef);
      expect(mockCompiler).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual({ compiledSchema: true });
      
      testCache.destroy();
    });
    
    test('should not cache validation errors', async () => {
      const mockValidator = jest.fn().mockRejectedValue(new Error('Validation failed'));
      const testCache = new ValidationCache({ gcInterval: 0 });
      
      const cachedValidator = createCachedValidator(mockValidator, testCache);
      
      try {
        await cachedValidator({ invalid: 'data' });
      } catch (error) {
        expect(error.message).toBe('Validation failed');
      }
      
      // Should call validator again on retry (not cached)
      try {
        await cachedValidator({ invalid: 'data' });
      } catch (error) {
        expect(mockValidator).toHaveBeenCalledTimes(2);
      }
      
      testCache.destroy();
    });
  });
  
  describe('Global Cache Management', () => {
    afterEach(() => {
      destroyGlobalCache(); // Clean up after each test
    });
    
    test('should get global cache instance', () => {
      const cache1 = getGlobalCache();
      const cache2 = getGlobalCache();
      
      expect(cache1).toBe(cache2); // Should return same instance
      expect(cache1).toBeInstanceOf(ValidationCache);
    });
    
    test('should configure global cache', () => {
      configureGlobalCache({
        defaultTTL: 120,
        maxSize: 500,
      });
      
      const cache = getGlobalCache();
      const config = cache.getConfig();
      
      expect(config.defaultTTL).toBe(120);
      expect(config.maxSize).toBe(500);
    });
    
    test('should clear global cache', () => {
      const cache = getGlobalCache();
      cache.set('key', 'value');
      
      expect(cache.getStats().size).toBe(1);
      
      clearGlobalCache();
      
      expect(cache.getStats().size).toBe(0);
    });
    
    test('should destroy global cache', () => {
      const cache = getGlobalCache();
      expect(cache).toBeDefined();
      
      destroyGlobalCache();
      
      // Should create new instance on next call
      const newCache = getGlobalCache();
      expect(newCache).not.toBe(cache);
    });
  });
  
  describe('Configuration Constants', () => {
    test('should have default configuration', () => {
      expect(DEFAULT_CACHE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CACHE_CONFIG.defaultTTL).toBe(300);
      expect(DEFAULT_CACHE_CONFIG.strategy).toBe('LRU');
      expect(DEFAULT_CACHE_CONFIG.maxSize).toBe(1000);
    });
    
    test('should have cache strategies', () => {
      expect(CACHE_STRATEGIES.LRU).toBe('least-recently-used');
      expect(CACHE_STRATEGIES.LFU).toBe('least-frequently-used');
      expect(CACHE_STRATEGIES.FIFO).toBe('first-in-first-out');
      expect(CACHE_STRATEGIES.TTL).toBe('time-to-live');
    });
  });
  
  describe('Performance Features', () => {
    test('should handle high-frequency operations', () => {
      const perfCache = new ValidationCache({
        maxSize: 1000,
        gcInterval: 0,
        enableStats: true,
      });
      
      // Perform many operations
      for (let i = 0; i < 500; i++) {
        perfCache.set(`key-${i}`, `value-${i}`);
      }
      
      for (let i = 0; i < 500; i++) {
        expect(perfCache.get(`key-${i}`)).toBe(`value-${i}`);
      }
      
      const stats = perfCache.getStats();
      expect(stats.size).toBe(500);
      expect(stats.hits).toBe(500);
      expect(stats.sets).toBe(500);
      
      perfCache.destroy();
    });
    
    test('should handle concurrent operations', async () => {
      const concurrentCache = new ValidationCache({ gcInterval: 0 });
      
      // Simulate concurrent set operations
      const setPromises = [];
      for (let i = 0; i < 100; i++) {
        setPromises.push(
          new Promise(resolve => {
            setTimeout(() => {
              concurrentCache.set(`key-${i}`, `value-${i}`);
              resolve();
            }, Math.random() * 10);
          })
        );
      }
      
      await Promise.all(setPromises);
      
      // Verify all values were set
      for (let i = 0; i < 100; i++) {
        expect(concurrentCache.get(`key-${i}`)).toBe(`value-${i}`);
      }
      
      concurrentCache.destroy();
    });
  });
});
