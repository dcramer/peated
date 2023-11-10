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

  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_HOST: process.env.SMTP_HOST || "localhost",
  SMTP_PORT: Number(process.env.SMTP_PORT || "465"),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM_NAME: "Peated",

  VERSION: process.env.VERSION || "",

  SENTRY_DSN: process.env.SENTRY_DSN || "",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  UPLOAD_PATH: process.env.UPLOAD_PATH || tmpdir(),

  USE_GCS_STORAGE: !!process.env.USE_GCS_STORAGE,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  GCS_BUCKET_PATH: process.env.GCS_BUCKET_PATH,

  GCP_CREDENTIALS: process.env.GCP_CREDENTIALS
    ? JSON.parse(process.env.GCP_CREDENTIALS)
    : null,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};
