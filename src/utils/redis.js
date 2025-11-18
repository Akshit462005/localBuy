const { createClient } = require('redis');

class RedisCache {
    constructor() {
        this.client = createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: process.env.REDIS_DB || 0
        });

        this.client.on('error', (err) => {
            console.error('Redis Cache Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('Redis Cache Client connected');
        });
    }

    async connect() {
        try {
            await this.client.connect();
        } catch (error) {
            console.error('Failed to connect Redis cache client:', error);
        }
    }

    async set(key, value, expireInSeconds = 3600) {
        try {
            const serializedValue = JSON.stringify(value);
            await this.client.setEx(key, expireInSeconds, serializedValue);
            return true;
        } catch (error) {
            console.error('Redis SET error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Redis GET error:', error);
            return null;
        }
    }

    async del(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis DELETE error:', error);
            return false;
        }
    }

    async exists(key) {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Redis EXISTS error:', error);
            return false;
        }
    }

    async flushAll() {
        try {
            await this.client.flushAll();
            return true;
        } catch (error) {
            console.error('Redis FLUSHALL error:', error);
            return false;
        }
    }

    async disconnect() {
        try {
            await this.client.disconnect();
        } catch (error) {
            console.error('Redis disconnect error:', error);
        }
    }
}

module.exports = new RedisCache();