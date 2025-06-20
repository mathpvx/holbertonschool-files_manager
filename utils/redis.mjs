import { createClient } from 'redis';

class RedisClient{
	constructor() {
		this.client = null;
	}

	async connect() {
		const conn = await createClient()
			conn.on('error', err => console.log('Redis errrrrur', err));
			await conn.connect();
		this.client = conn;
	}

	isAlive() {
		return this.client !== null && this.client.isOpen;
	}

	async get(key) {
		return await this.client.get(key);
	}

	async set(key, value, duration) {
		await this.client.set(key, value, { EX: duration });
	}

	async del(key) {
		await this.client.del(key);
	}
}

const redisClient = new RedisClient();
export default redisClient;
