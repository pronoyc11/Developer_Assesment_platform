import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../generated/prisma/client";

export type AccessTokenPayload = {
  userId: string;
  role: Role;
  email?: string;
  name?: string;
};

export type RefreshTokenPayload = {
  userId: string;
  tokenId: string;
};

export const signAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as unknown as NonNullable<
      SignOptions["expiresIn"]
    >,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as unknown as NonNullable<
      SignOptions["expiresIn"]
    >,
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

export const verifyAccessToken = (
  token: string,
): AccessTokenPayload & JwtPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload &
    JwtPayload;
};

export const verifyRefreshToken = (
  token: string,
): RefreshTokenPayload & JwtPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload &
    JwtPayload;
};
