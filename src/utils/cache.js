// Lightweight cache abstraction. If REDIS_URL is provided in env, attempt to use Redis, otherwise fallback to in-memory map with TTL.
const map = new Map();

let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    // Dynamic import to avoid hard dependency when Redis not used
    const IORedis = await import('ioredis').then((m) => m.default || m);
    redisClient = new IORedis(process.env.REDIS_URL);
  } catch (e) {
    redisClient = null;
  }
}

const get = async (key) => {
  if (redisClient) {
    const v = await redisClient.get(key);
    return v ? JSON.parse(v) : null;
  }
  const entry = map.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    map.delete(key);
    return null;
  }
  return entry.value;
};

const set = async (key, value, ttlSeconds = 60) => {
  if (redisClient) {
    return redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  map.set(key, { value, expiresAt });
  return true;
};

const del = async (key) => {
  if (redisClient) {
    return redisClient.del(key);
  }
  map.delete(key);
  return true;
};

export default { get, set, del };
