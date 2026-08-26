import "./../config/";

const requiredEnv = [
  "DATABASE_URL",
  "REDIS_URL",
  "NATS_URL",
  "JWT_SECRET"
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT || 4000),

  databaseUrl: process.env.DATABASE_URL,

  redisUrl: process.env.REDIS_URL,

  natsUrl: process.env.NATS_URL,

  jwtSecret: process.env.JWT_SECRET,

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",

  refreshTokenExpiresIn:
    process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"
};