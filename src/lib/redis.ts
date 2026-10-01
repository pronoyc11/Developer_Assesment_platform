import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env";

const redisClient = createClient({
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD,
  socket: {
    host: env.REDIS_HOST,
    port: Number(env.REDIS_PORT)
  }
});

redisClient.on("error", (error) => {
  console.error("Redis client error:", error);
});

export const getRedisClient = async (): Promise<RedisClientType> => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
};

export const connectRedis = async (): Promise<void> => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis connected successfully");
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient.isOpen) {
    await redisClient.quit();
    console.log("Redis disconnected cleanly");
  }
};
