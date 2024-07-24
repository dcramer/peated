import { tmpdir } from "node:os";

export default {
  ENV: process.env.NODE_ENV === "production" ? "production" : "development",
  DEBUG: !!process.env.DEBUG,
  PORT: process.env.PORT || 4000,
  HOST: process.env.HOST || "localhost",
  CORS_HOST: process.env.CORS_HOST || "http://localhost:3000",
  JWT_SECRET: process.env.JWT_SECRET || "",
  API_SERVER: process.env.API_SERVER || "http://localhost:4000",
  URL_PREFIX: process.env.URL_PREFIX || "http://localhost:3000",
  REDIS_URL: process.env.REDIS_URL || "redis://@localhost:6379",

  SMTP_FROM: process.env.SMTP_FROM || "no-reply@peated.com",
  SMTP_REPLY_TO: process.env.SMTP_REPLY_TO || "no-reply@peated.com",
  SMTP_HOST: process.env.SMTP_HOST || "localhost",
  SMTP_PORT: Number(process.env.SMTP_PORT || "465"),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM_NAME: "Peated",

  VERSION: process.env.VERSION || "",

  SENTRY_DSN: process.env.SENTRY_DSN || "",
  SENTRY_SERVICE: process.env.SENTRY_SERVICE || "@peated/server",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  UPLOAD_PATH: process.env.UPLOAD_PATH || tmpdir(),

  USE_GCS_STORAGE: !!process.env.USE_GCS_STORAGE,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  GCS_BUCKET_PATH: process.env.GCS_BUCKET_PATH,

  GCP_CREDENTIALS: process.env.GCP_CREDENTIALS
    ? JSON.parse(process.env.GCP_CREDENTIALS)
    : null,

  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_HOST: process.env.OPENAI_HOST || "https://api.openai.com/v1",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o",
  OPENAI_ORGANIZATION:
    process.env.OPENAI_ORGANIZATION || "org-c11AVkF35wixZcGri1YBH9Pq",
  OPENAI_PROJECT: process.env.OPENAI_PROJECT || null,

  DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK,
};
