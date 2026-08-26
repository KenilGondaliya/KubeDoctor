import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { env } from "../../config/env.js";

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: "access"
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn
    }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: "refresh"
    },
    env.jwtSecret,
    {
      expiresIn: env.refreshTokenExpiresIn
    }
  );
}

export function verifyToken(token) {
  return jwt.verify(
    token,
    env.jwtSecret
  );
}