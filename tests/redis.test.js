const redisCache = require('../src/utils/redis');

describe('Redis Cache Utility', () => {
    // Skip Redis tests if Redis is not available
    const isRedisAvailable = () => {
        return process.env.REDIS_HOST && process.env.REDIS_PORT;
    };

    beforeAll(async () => {
        if (isRedisAvailable()) {
            await redisCache.connect();
        }
    });

    afterAll(async () => {
        if (isRedisAvailable()) {
            await redisCache.disconnect();
        }
    });

    test('should be defined', () => {
        expect(redisCache).toBeDefined();
        expect(typeof redisCache.set).toBe('function');
        expect(typeof redisCache.get).toBe('function');
        expect(typeof redisCache.del).toBe('function');
    });

    test('should set and get values', async () => {
        if (!isRedisAvailable()) {
            console.log('Skipping Redis tests - Redis not available');
            return;
        }

        const testKey = 'test:key:' + Date.now();
        const testValue = { message: 'Hello Jest!', timestamp: Date.now() };

        // Set value
        const setResult = await redisCache.set(testKey, testValue, 60);
        expect(setResult).toBe(true);

        // Get value
        const getValue = await redisCache.get(testKey);
        expect(getValue).toEqual(testValue);

        // Clean up
        await redisCache.del(testKey);
    });

    test('should return null for non-existent keys', async () => {
        if (!isRedisAvailable()) {
            return;
        }

        const nonExistentKey = 'non:existent:key:' + Date.now();
        const result = await redisCache.get(nonExistentKey);
        expect(result).toBeNull();
    });

    test('should delete keys successfully', async () => {
        if (!isRedisAvailable()) {
            return;
        }

        const testKey = 'test:delete:' + Date.now();
        const testValue = { delete: 'me' };

        // Set and verify
        await redisCache.set(testKey, testValue);
        const beforeDelete = await redisCache.get(testKey);
        expect(beforeDelete).toEqual(testValue);

        // Delete and verify
        const deleteResult = await redisCache.del(testKey);
        expect(deleteResult).toBe(true);

        const afterDelete = await redisCache.get(testKey);
        expect(afterDelete).toBeNull();
    });
});