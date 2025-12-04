const { createClient } = require('redis');

class RedisCache {
    constructor() {
        console.log('🔧 Initializing Redis Cache Client for serverless...');
        
        // Simplified Redis configuration for serverless
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
            console.log('📡 Using REDIS_URL with minimal config');
            this.client = createClient({ 
                url: redisUrl,
                socket: {
                    reconnectStrategy: false, // Disable reconnection
                    connectTimeout: 2000,
                    lazyConnect: true
                }
            });
        } else {
            const username = process.env.REDIS_USERNAME;
            const password = process.env.REDIS_PASSWORD;
            const host = process.env.REDIS_HOST || 'localhost';
            const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
            const tls = process.env.REDIS_TLS === 'true';
            const db = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0;
            
            console.log('📡 Redis Config:', { host, port, username, tls, db });
            
            if (username) {
                const scheme = tls ? 'rediss' : 'redis';
                const userEnc = encodeURIComponent(username);
                const passEnc = password ? encodeURIComponent(password) : '';
                const url = `${scheme}://${userEnc}:${passEnc}@${host}:${port}/${db}`;
                console.log('🔗 Using URL-based connection (with DB):', url.replace(passEnc, '***'));
                this.client = createClient({ url });
            } else {
                console.log('🔗 Using socket-based connection');
                this.client = createClient({
                    socket: {
                        host,
                        port,
                        tls: tls || undefined
                    },
                    password: password || undefined,
                    database: db
                });
            }
        }

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
                console.log('🔄 Attempting Redis connection with timeout...');
                
                // Set a connection timeout for serverless
                const connectPromise = this.client.connect();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
                );
                
                await Promise.race([connectPromise, timeoutPromise]);
                console.log('🔄 Redis cache client connected successfully');
                
                // Quick ping test with timeout
                const pingPromise = this.client.ping();
                const pingTimeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Redis ping timeout')), 2000)
                );
                
                await Promise.race([pingPromise, pingTimeoutPromise]);
                console.log('🏓 Redis PING successful');
            }
        } catch (error) {
            console.warn('⚠️ Redis connection failed, falling back to memory cache:', error.message);
            // Don't throw error - let app continue without Redis
            return false;
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