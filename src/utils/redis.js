const { createClient } = require('redis');

class RedisCache {
    constructor() {
        console.log('🔧 Initializing Redis Cache Client...');\n        \n        // Use same configuration as app.js for consistency\n        const redisUrl = process.env.REDIS_URL;\n        if (redisUrl) {\n            console.log('📡 Using REDIS_URL for connection');\n            this.client = createClient({ url: redisUrl });\n        } else {\n            const username = process.env.REDIS_USERNAME;\n            const password = process.env.REDIS_PASSWORD;\n            const host = process.env.REDIS_HOST || 'localhost';\n            const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;\n            const tls = process.env.REDIS_TLS === 'true';\n            const db = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0;\n            \n            console.log('📡 Redis Config:', { host, port, username, tls, db });\n            \n            if (username) {\n                const scheme = tls ? 'rediss' : 'redis';\n                const userEnc = encodeURIComponent(username);\n                const passEnc = password ? encodeURIComponent(password) : '';\n                const url = `${scheme}://${userEnc}:${passEnc}@${host}:${port}/${db}`;\n                console.log('🔗 Using URL-based connection (with DB):', url.replace(passEnc, '***'));\n                this.client = createClient({ url });\n            } else {\n                console.log('🔗 Using socket-based connection');\n                this.client = createClient({\n                    socket: {\n                        host,\n                        port,\n                        tls: tls || undefined\n                    },\n                    password: password || undefined,\n                    database: db\n                });\n            }\n        }

        this.client.on('error', (err) => {
            console.error('Redis Cache Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('Redis Cache Client connected');
        });
    }

    async connect() {
        try {
            if (!this.client.isOpen) {
                await this.client.connect();
                console.log('🔄 Redis cache client connected successfully');
                
                // Test the connection
                await this.client.ping();
                console.log('🏓 Redis PING successful');
            }
        } catch (error) {
            console.error('❌ Failed to connect Redis cache client:', error);
            throw error;
        }
    }

    async set(key, value, expireInSeconds = 3600) {
        try {
            if (!this.client.isOpen) {
                console.log('Redis client not connected, attempting to connect...');
                await this.connect();
            }
            
            const serializedValue = JSON.stringify(value);
            await this.client.setEx(key, expireInSeconds, serializedValue);
            console.log(`✅ Redis SET successful: ${key} (expires in ${expireInSeconds}s)`);
            return true;
        } catch (error) {
            console.error('❌ Redis SET error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            if (!this.client.isOpen) {
                console.log('Redis client not connected for GET, attempting to connect...');
                await this.connect();
            }
            
            const value = await this.client.get(key);
            if (value) {
                console.log(`✅ Redis GET hit: ${key}`);
                return JSON.parse(value);
            } else {
                console.log(`⚪ Redis GET miss: ${key}`);
                return null;
            }
        } catch (error) {
            console.error('❌ Redis GET error:', error);
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

    // Debug method to get Redis info
    async getDebugInfo() {
        try {
            if (!this.client.isOpen) {
                return { connected: false, error: 'Client not connected' };
            }

            const ping = await this.client.ping();
            const keys = await this.client.keys('*');
            const info = await this.client.info('server');
            
            return {
                connected: true,
                ping,
                totalKeys: keys.length,
                keys: keys.slice(0, 10), // First 10 keys
                serverInfo: info.split('\n').slice(0, 5).join('\n') // First few lines
            };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }
}

module.exports = new RedisCache();