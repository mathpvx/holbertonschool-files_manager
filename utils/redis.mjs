import redis from 'redis';

class RedisClient {
  constructor() {
    this._client = redis.createClient();
    this._client.on('error', (err) => console.error('Redis error:', err));
  }

  isAlive() {
    return this._client && this._client.connected;
  }

  get(key) {
    return new Promise((resolve, reject) => {
      this._client.get(key, (err, reply) => {
        if (err) reject(err);
        resolve(reply);
      });
    });
  }

  set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this._client.setex(key, duration, String(value), (err) => {
        if (err) return reject(err);
        return resolve();
      });
    });
  }

  del(key) {
    return new Promise((resolve, reject) => {
      this._client.del(key, (err) => {
        if (err) return reject(err);
        return resolve();
      });
    });
  }
}

const redisClient = new RedisClient();
export default redisClient;
