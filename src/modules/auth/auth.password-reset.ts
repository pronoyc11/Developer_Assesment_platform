import crypto from "node:crypto";
import { getRedisClient } from "../../lib/redis";
import { hashToken } from "../../utils/token";

const RESET_TOKEN_TTL_SECONDS = 15 * 60;

const getResetKey = (token: string): string =>
  `auth:password-reset:${hashToken(token)}`;

export const createPasswordResetToken = async (
  userId: string,
): Promise<string> => {
  const token = crypto.randomBytes(32).toString("hex");
  const redis = await getRedisClient();
  await redis.set(getResetKey(token), userId, { EX: RESET_TOKEN_TTL_SECONDS });
  return token;
};

export const consumePasswordResetToken = async (
  token: string,
): Promise<string | null> => {
  const redis = await getRedisClient();
  const key = getResetKey(token);
  const userId = await redis.get(key);
  if (userId) {
    await redis.del(key);
  }
  return userId;
};
